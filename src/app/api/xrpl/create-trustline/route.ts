import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

/**
 * Creates a Xaman payload for a TrustSet transaction.
 * The investor must sign this before they can hold any IOU token.
 *
 * Body: {
 *   investorAddress: string,
 *   tokenSymbol: string,
 *   issuerWallet: string,
 * }
 *
 * Returns: { uuid, qrUrl, deepLink }
 */
export async function POST(req: Request) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error

  try {
    const { investorAddress, tokenSymbol, issuerWallet } = await req.json()

    if (!investorAddress || !tokenSymbol || !issuerWallet) {
      return NextResponse.json(
        { error: 'investorAddress, tokenSymbol, and issuerWallet required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.XUMM_APIKEY
    const apiSecret = process.env.XUMM_APISECRET

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Xaman API not configured' }, { status: 500 })
    }

    const payload = {
      txjson: {
        TransactionType: 'TrustSet',
        Account: investorAddress,
        LimitAmount: {
          currency: tokenSymbol,
          issuer: issuerWallet,
          value: '999999999',
        },
      },
      options: {
        submit: true,
        expire: 300,
      },
      custom_meta: {
        instruction: `Set trust line for ${tokenSymbol} tokens`,
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
        { error: data.error?.message ?? 'Failed to create TrustSet payload' },
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
