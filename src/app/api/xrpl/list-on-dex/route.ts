import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { buildPaymentAmount } from '@/lib/xrpl/amount'

/**
 * Admin endpoint: List tokens on the XRPL DEX.
 * Creates an OfferCreate from the issuer wallet to sell tokens at NAV price.
 * This is how tokens become available for investors to buy.
 *
 * Body: {
 *   assetId: string,
 *   issuerAddress: string,   // issuer wallet that holds the tokens
 *   tokenAmount: number,     // how many tokens to list
 *   tokenSymbol: string,
 *   pricePerToken: number,   // NAV price
 *   currency: string,        // RLUSD | XRP
 * }
 *
 * Returns: { uuid, qrUrl, deepLink }
 */
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if ('error' in auth && auth.error) return auth.error

  try {
    const {
      assetId,
      issuerAddress,
      tokenAmount,
      tokenSymbol,
      pricePerToken,
      currency,
    } = await req.json()

    if (!assetId || !issuerAddress || !tokenAmount || !tokenSymbol || !pricePerToken) {
      return NextResponse.json(
        { error: 'assetId, issuerAddress, tokenAmount, tokenSymbol, and pricePerToken required' },
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

    // Issuer is SELLING tokens → TakerPays = payment (what we receive), TakerGets = tokens (what we give)
    const tokenAmount_xrpl = buildPaymentAmount(tokenSymbol, String(tokenAmount), issuerAddress)
    const paymentAmount_xrpl = buildPaymentAmount(payCurrency, String(totalPayment), issuerAddress)

    const payload = {
      txjson: {
        TransactionType: 'OfferCreate',
        Account: issuerAddress,
        TakerPays: paymentAmount_xrpl,  // we receive payment
        TakerGets: tokenAmount_xrpl,     // we give tokens
      },
      options: {
        submit: true,
        expire: 600,
      },
      custom_meta: {
        instruction: `List ${tokenAmount.toLocaleString()} ${tokenSymbol} on DEX at $${pricePerToken} each (${payCurrency})`,
        identifier: `dex-listing-${assetId}`,
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
