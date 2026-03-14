import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getCustodialAddress, createCustodialWallet, signAndSubmit } from '@/lib/xrpl/wallet-manager'
import { buildPaymentAmount } from '@/lib/xrpl/amount'

/**
 * Initiate a MoonPay buy flow:
 * 1. Creates a marketplace order (DB)
 * 2. Creates a pending buy record (so webhook knows to auto-execute DEX trade)
 * 3. Returns the signed MoonPay widget URL
 *
 * DEV MODE: When NEXT_PUBLIC_MOONPAY_API_KEY is not set, skips MoonPay entirely
 * and executes the DEX trade directly using the custodial wallet.
 * This lets you test the full flow without a MoonPay partner account.
 *
 * POST body: {
 *   assetId: string,
 *   tokenAmount: number,
 *   pricePerToken: number,
 *   tokenSymbol: string,
 *   issuerWallet: string,
 *   payCurrency: 'XRP' | 'RLUSD'
 * }
 */
export async function POST(req: Request) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { user, supabase } = auth

  try {
    const {
      assetId,
      tokenAmount,
      pricePerToken,
      tokenSymbol,
      issuerWallet,
      payCurrency,
    } = await req.json()

    if (!assetId || !tokenAmount || !pricePerToken || !tokenSymbol || !issuerWallet) {
      return NextResponse.json(
        { error: 'assetId, tokenAmount, pricePerToken, tokenSymbol, and issuerWallet required' },
        { status: 400 }
      )
    }

    const totalUsd = tokenAmount * pricePerToken
    const currency = payCurrency ?? 'XRP'

    // Look up the investor record
    const { data: investor } = await supabase
      .from('platform_investors')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!investor) {
      return NextResponse.json(
        { error: 'You must be a registered platform investor' },
        { status: 403 }
      )
    }

    // Ensure user has a custodial wallet
    let walletAddress = await getCustodialAddress(user.id)
    if (!walletAddress) {
      const { address } = await createCustodialWallet(user.id)
      walletAddress = address
    }

    // Create marketplace order
    const { data: order, error: orderErr } = await supabase
      .from('marketplace_orders')
      .insert({
        investor_id: investor.id,
        asset_id: assetId,
        side: 'buy',
        token_amount: tokenAmount,
        price_per_token: pricePerToken,
        currency,
        status: 'pending_payment',
      })
      .select('id')
      .single()

    if (orderErr) {
      return NextResponse.json(
        { error: `Failed to create order: ${orderErr.message}` },
        { status: 500 }
      )
    }

    // ── DEV MODE: No MoonPay keys → execute DEX trade directly ──
    const moonpayKey = process.env.NEXT_PUBLIC_MOONPAY_API_KEY
    if (!moonpayKey) {
      try {
        // Build XRPL amounts
        const tokenAmt = buildPaymentAmount(tokenSymbol, String(tokenAmount), issuerWallet)
        const payAmt = buildPaymentAmount(currency, String(totalUsd), issuerWallet)

        // Execute OfferCreate directly from custodial wallet
        const { hash, engineResult } = await signAndSubmit(user.id, {
          TransactionType: 'OfferCreate',
          TakerPays: tokenAmt,  // want tokens
          TakerGets: payAmt,    // pay with crypto
        })

        // Update order status
        await supabase
          .from('marketplace_orders')
          .update({
            xrpl_offer_tx: hash,
            status: engineResult === 'tesSUCCESS' ? 'filled' : 'open',
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id)

        return NextResponse.json({
          orderId: order.id,
          walletAddress,
          totalUsd,
          devMode: true,
          txHash: hash,
          engineResult,
        })
      } catch (err) {
        return NextResponse.json(
          { error: `DEX trade failed: ${err instanceof Error ? err.message : 'Unknown error'}` },
          { status: 500 }
        )
      }
    }

    // ── PRODUCTION: MoonPay flow ──

    // Create pending buy record for webhook to pick up
    const { error: pendingErr } = await supabase
      .from('moonpay_pending_buys')
      .insert({
        user_id: user.id,
        order_id: order.id,
        asset_id: assetId,
        token_symbol: tokenSymbol,
        token_amount: tokenAmount,
        price_per_token: pricePerToken,
        issuer_wallet: issuerWallet,
        pay_currency: currency,
        status: 'awaiting_deposit',
      })

    if (pendingErr) {
      return NextResponse.json(
        { error: `Failed to create pending buy: ${pendingErr.message}` },
        { status: 500 }
      )
    }

    // Get signed MoonPay URL
    const moonpayRes = await fetch(new URL('/api/moonpay/sign-url', req.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: req.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({
        currencyCode: currency === 'XRP' ? 'xrp' : 'rlusd',
        baseCurrencyAmount: totalUsd,
      }),
    })

    const moonpayData = await moonpayRes.json()

    if (moonpayData.error) {
      return NextResponse.json(
        { error: moonpayData.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      orderId: order.id,
      moonpayUrl: moonpayData.url,
      walletAddress: moonpayData.walletAddress,
      totalUsd,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to initiate buy' },
      { status: 500 }
    )
  }
}
