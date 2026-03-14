import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { buildPaymentAmount } from '@/lib/xrpl/amount'

/**
 * Creates a Xaman payload for a Payment transaction.
 * Used in the primary buy flow so the investor pays XRP/RLUSD to the issuer.
 *
 * Body: {
 *   investorAddress: string,
 *   issuerWallet: string,
 *   amount: number,        // total cost in payCurrency
 *   payCurrency: 'XRP' | 'RLUSD',
 * }
 *
 * Returns: { uuid, qrUrl, deepLink }
 */
export async function POST(req: Request) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error

  try {
    const { investorAddress, issuerWallet, amount, payCurrency } = await req.json()

    if (!investorAddress || !issuerWallet || !amount || !payCurrency) {
      return NextResponse.json(
        { error: 'investorAddress, issuerWallet, amount, and payCurrency required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.XUMM_APIKEY
    const apiSecret = process.env.XUMM_APISECRET

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Xaman API not configured' }, { status: 500 })
    }

    const xrplAmount = buildPaymentAmount(payCurrency, String(amount), issuerWallet)

    const payload = {
      txjson: {
        TransactionType: 'Payment',
        Account: investorAddress,
        Destination: issuerWallet,
        Amount: xrplAmount,
      },
      options: {
        submit: true,
        expire: 300,
      },
      custom_meta: {
        instruction: `Pay ${amount} ${payCurrency} for token purchase`,
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
        { error: data.error?.message ?? 'Failed to create payment payload' },
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
