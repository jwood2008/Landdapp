import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { signAndSubmit } from '@/lib/xrpl/wallet-manager'
import { buildPaymentAmount } from '@/lib/xrpl/amount'

/**
 * MoonPay webhook handler.
 *
 * When a user completes a fiat purchase through MoonPay:
 * 1. MoonPay converts USD → XRP (or RLUSD on mainnet)
 * 2. MoonPay sends crypto to the user's custodial wallet
 * 3. This webhook fires with transaction details
 * 4. We record the deposit and optionally auto-buy tokens on the DEX
 *
 * Webhook payload: https://dev.moonpay.com/docs/on-ramp-webhooks
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.text()

    // Verify webhook signature if secret is configured
    const webhookSecret = process.env.MOONPAY_WEBHOOK_SECRET
    if (webhookSecret) {
      const signature = req.headers.get('moonpay-signature-v2')
      if (!signature) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
      }

      const expected = createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex')

      if (signature !== expected) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const payload = JSON.parse(rawBody)
    const { type, data } = payload

    // We only care about completed transactions
    if (type !== 'transaction_updated' || data?.status !== 'completed') {
      return NextResponse.json({ ok: true })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const externalId = data.externalTransactionId as string | undefined
    const userId = externalId?.split('_')[0]
    const cryptoAmount = data.cryptoTransactionId ? data.quoteCurrencyAmount : null
    const currencyCode = (data.currency?.code ?? 'xrp') as string
    const walletAddress = data.walletAddress as string | undefined

    if (!userId) {
      console.warn('MoonPay webhook: no userId in externalTransactionId')
      return NextResponse.json({ ok: true })
    }

    // Record the deposit
    await supabase.from('moonpay_transactions').insert({
      user_id: userId,
      moonpay_id: data.id,
      status: data.status,
      fiat_amount: data.baseCurrencyAmount,
      fiat_currency: data.baseCurrency?.code ?? 'usd',
      crypto_amount: cryptoAmount,
      crypto_currency: currencyCode,
      wallet_address: walletAddress,
      external_id: externalId,
      raw_payload: data,
    })

    // Check if there's a pending auto-buy order for this user
    const { data: pendingBuy } = await supabase
      .from('moonpay_pending_buys')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'awaiting_deposit')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (pendingBuy && cryptoAmount) {
      // Auto-execute the DEX buy using the custodial wallet
      try {
        const tokenAmount = buildPaymentAmount(
          pendingBuy.token_symbol,
          String(pendingBuy.token_amount),
          pendingBuy.issuer_wallet
        )
        const paymentAmount = buildPaymentAmount(
          currencyCode.toUpperCase(),
          String(cryptoAmount),
          pendingBuy.issuer_wallet
        )

        const { hash, engineResult } = await signAndSubmit(userId, {
          TransactionType: 'OfferCreate',
          TakerPays: tokenAmount,   // want tokens
          TakerGets: paymentAmount, // pay with crypto from MoonPay
        })

        // Update the pending buy
        await supabase
          .from('moonpay_pending_buys')
          .update({
            status: 'executed',
            xrpl_tx_hash: hash,
            xrpl_result: engineResult,
            executed_at: new Date().toISOString(),
          })
          .eq('id', pendingBuy.id)

        // Update marketplace order if linked
        if (pendingBuy.order_id) {
          await supabase
            .from('marketplace_orders')
            .update({
              xrpl_offer_tx: hash,
              status: engineResult === 'tesSUCCESS' ? 'filled' : 'open',
              updated_at: new Date().toISOString(),
            })
            .eq('id', pendingBuy.order_id)
        }
      } catch (err) {
        console.error('MoonPay auto-buy failed:', err)
        await supabase
          .from('moonpay_pending_buys')
          .update({
            status: 'failed',
            error: err instanceof Error ? err.message : 'Auto-buy failed',
          })
          .eq('id', pendingBuy.id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('MoonPay webhook error:', err)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
