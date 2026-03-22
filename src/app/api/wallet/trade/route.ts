import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { signAndSubmit, getCustodialAddress, signAndSubmitFromAddress } from '@/lib/xrpl/wallet-manager'
import { buildPaymentAmount } from '@/lib/xrpl/amount'

/**
 * Place a sell listing or buy order using the user's custodial wallet.
 *
 * SELL FLOW (order-book approach):
 * 1. Seller creates a sell order in the marketplace_orders table
 * 2. Tokens stay in the seller's wallet until a buyer matches
 * 3. At settlement time (secondary-buy), tokens transfer directly from seller → buyer
 *
 * BUY FLOW (legacy OfferCreate — use primary-buy or secondary-buy instead):
 * Creates an OfferCreate on the XRPL DEX for buy orders.
 */
export async function POST(req: Request) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { user, supabase } = auth

  try {
    const {
      orderId,
      side,
      tokenAmount,
      pricePerToken,
      tokenSymbol,
      issuerWallet,
      currency,
    } = await req.json()

    if (!orderId || !side || !tokenAmount || !pricePerToken || !tokenSymbol || !issuerWallet) {
      return NextResponse.json(
        { error: 'orderId, side, tokenAmount, pricePerToken, tokenSymbol, and issuerWallet required' },
        { status: 400 }
      )
    }

    const address = await getCustodialAddress(user.id)
    if (!address) {
      return NextResponse.json(
        { error: 'No custodial wallet found. Create one first.' },
        { status: 400 }
      )
    }

    if (side === 'sell') {
      // ── SELL: List tokens on the marketplace ──
      // No XRPL transaction here. Tokens remain in the seller's wallet.
      // The order record was already created by the marketplace orders API.
      // Tokens only move when a buyer matches via /api/wallet/secondary-buy.

      console.log(`[trade] Sell order listed: ${tokenAmount} ${tokenSymbol} from ${address} at $${pricePerToken}/token`)

      return NextResponse.json({
        hash: null,
        engineResult: 'listed',
        message: `${tokenAmount} ${tokenSymbol} listed for sale at $${pricePerToken} per token.`,
      })
    }

    // ── BUY: OfferCreate on DEX (legacy — prefer primary-buy/secondary-buy) ──
    const totalPaymentUsd = tokenAmount * pricePerToken
    const payCurrency = currency ?? 'XRP'

    const tokenAmount_xrpl = buildPaymentAmount(tokenSymbol, String(tokenAmount), issuerWallet)
    const paymentAmount_xrpl = buildPaymentAmount(payCurrency, String(totalPaymentUsd), issuerWallet)

    if (tokenSymbol !== 'XRP') {
      try {
        await signAndSubmit(user.id, {
          TransactionType: 'TrustSet',
          LimitAmount: { currency: tokenSymbol, issuer: issuerWallet, value: '999999999' },
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        if (!msg.includes('tecDUPLICATE') && !msg.includes('already')) {
          console.warn('[trade] TrustSet warning:', msg)
        }
      }

      try {
        await signAndSubmitFromAddress(issuerWallet, {
          TransactionType: 'TrustSet',
          LimitAmount: { currency: tokenSymbol, issuer: address, value: '0' },
          Flags: 65536,
        })
      } catch {
        // Non-fatal
      }
    }

    const { hash, engineResult } = await signAndSubmit(user.id, {
      TransactionType: 'OfferCreate',
      TakerPays: tokenAmount_xrpl,
      TakerGets: paymentAmount_xrpl,
    })

    if (orderId) {
      await supabase
        .from('marketplace_orders')
        .update({ xrpl_offer_tx: hash, updated_at: new Date().toISOString() })
        .eq('id', orderId)
    }

    return NextResponse.json({ hash, engineResult })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Trade failed' },
      { status: 500 }
    )
  }
}
