import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { buildPaymentAmount } from '@/lib/xrpl/amount'

/**
 * Creates a Xaman payload for buy orders (OfferCreate on DEX).
 *
 * SELL: No XRPL transaction needed. Sell orders are recorded in the DB only.
 *       Tokens stay in the seller's wallet until a buyer matches the order.
 *       At settlement time, the platform handles the swap.
 *
 * BUY: Signs an OfferCreate on the XRPL DEX (legacy).
 */
export async function POST(req: Request) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { supabase } = auth

  try {
    const {
      orderId,
      investorAddress,
      side,
      tokenAmount,
      pricePerToken,
      tokenSymbol,
      issuerWallet,
      currency,
    } = await req.json()

    if (!orderId || !investorAddress || !side || !tokenAmount || !pricePerToken || !tokenSymbol || !issuerWallet) {
      return NextResponse.json(
        { error: 'orderId, investorAddress, side, tokenAmount, pricePerToken, tokenSymbol, and issuerWallet required' },
        { status: 400 }
      )
    }

    if (side === 'sell') {
      // SELL: No XRPL transaction. Tokens remain in the seller's wallet.
      // The order record was already created by the marketplace orders API.
      // Tokens only transfer when a buyer matches via secondary-buy.
      console.log(`[create-offer] Sell order listed: ${tokenAmount} ${tokenSymbol} from ${investorAddress.slice(0, 8)}... at $${pricePerToken}/token`)

      return NextResponse.json({
        listed: true,
        message: `${tokenAmount} ${tokenSymbol} listed for sale at $${pricePerToken} per token.`,
      })
    }

    // BUY: OfferCreate on DEX (legacy path — prefer primary-buy)
    const apiKey = process.env.XUMM_APIKEY
    const apiSecret = process.env.XUMM_APISECRET

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Xaman API not configured' }, { status: 500 })
    }

    const truncAddr = `${investorAddress.slice(0, 8)}...${investorAddress.slice(-6)}`
    const payCurrency = currency ?? 'XRP'
    const totalPayment = tokenAmount * pricePerToken
    const tokenAmountXrpl = buildPaymentAmount(tokenSymbol, String(tokenAmount), issuerWallet)
    const paymentAmountXrpl = buildPaymentAmount(payCurrency, String(totalPayment), issuerWallet)

    const txjson = {
      TransactionType: 'OfferCreate',
      Account: investorAddress,
      TakerPays: tokenAmountXrpl,
      TakerGets: paymentAmountXrpl,
    }
    const instruction = `Buy ${tokenAmount} ${tokenSymbol} at $${pricePerToken} each`

    const payload = {
      txjson,
      options: {
        submit: true,
        expire: 300,
      },
      custom_meta: {
        instruction: `${instruction} — ${truncAddr}`,
        identifier: orderId,
      },
    }

    const res = await fetch('https://xumm.app/api/v1/platform/payload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-API-Secret': apiSecret,
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (!res.ok || !data.uuid) {
      return NextResponse.json(
        { error: data.error?.message ?? 'Failed to create Xaman payload' },
        { status: 500 }
      )
    }

    // Update the order with the Xaman tx reference
    await supabase
      .from('marketplace_orders')
      .update({ xrpl_offer_tx: data.uuid })
      .eq('id', orderId)

    return NextResponse.json({
      uuid: data.uuid,
      qrUrl: data.refs?.qr_png,
      deepLink: data.next?.always,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
