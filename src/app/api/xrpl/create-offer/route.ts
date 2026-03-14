import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { buildPaymentAmount } from '@/lib/xrpl/amount'

/**
 * Creates a Xaman payload for an XRPL OfferCreate transaction.
 * Both buy and sell orders go on the DEX as limit orders.
 *
 * - SELL: "I have tokens, I want XRP/RLUSD" → sits on DEX until a buyer matches
 * - BUY: "I have XRP/RLUSD, I want tokens" → sits on DEX until a seller matches
 *
 * When offers cross (buy price >= sell price), the XRPL DEX fills them instantly.
 *
 * Body: {
 *   orderId: string,
 *   investorAddress: string,
 *   side: 'buy' | 'sell',
 *   tokenAmount: number,
 *   pricePerToken: number,
 *   tokenSymbol: string,
 *   issuerWallet: string,
 *   currency: string,  // RLUSD | XRP
 * }
 *
 * Returns: { uuid, qrUrl, deepLink }
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

    const apiKey = process.env.XUMM_APIKEY
    const apiSecret = process.env.XUMM_APISECRET

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Xaman API not configured' }, { status: 500 })
    }

    const totalPayment = tokenAmount * pricePerToken
    const payCurrency = currency ?? 'RLUSD'

    // Build XRPL amounts
    const tokenAmount_xrpl = buildPaymentAmount(tokenSymbol, String(tokenAmount), issuerWallet)
    const paymentAmount_xrpl = buildPaymentAmount(payCurrency, String(totalPayment), issuerWallet)

    // OfferCreate semantics:
    // TakerPays = what the taker gives us (what we receive)
    // TakerGets = what we give the taker (what we send)
    let takerPays: unknown
    let takerGets: unknown

    if (side === 'buy') {
      // Buying tokens: we send payment, we receive tokens
      takerPays = tokenAmount_xrpl    // we receive tokens
      takerGets = paymentAmount_xrpl   // we send XRP/RLUSD
    } else {
      // Selling tokens: we send tokens, we receive payment
      takerPays = paymentAmount_xrpl   // we receive XRP/RLUSD
      takerGets = tokenAmount_xrpl     // we send tokens
    }

    const truncAddr = `${investorAddress.slice(0, 8)}...${investorAddress.slice(-6)}`
    const instruction = side === 'buy'
      ? `Buy ${tokenAmount} ${tokenSymbol} at $${pricePerToken} each (${payCurrency})`
      : `Sell ${tokenAmount} ${tokenSymbol} at $${pricePerToken} each (${payCurrency})`

    const payload = {
      txjson: {
        TransactionType: 'OfferCreate',
        Account: investorAddress,
        TakerPays: takerPays,
        TakerGets: takerGets,
      },
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
