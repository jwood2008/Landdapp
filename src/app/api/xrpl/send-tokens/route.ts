import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'

/**
 * Creates a Xaman payload for a Payment transaction to send tokens
 * from the issuer wallet to an investor wallet.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if ('error' in auth && auth.error) return auth.error

  try {
    const { issuerAddress, destinationAddress, tokenSymbol, amount } = await req.json()

    if (!issuerAddress || !destinationAddress || !tokenSymbol || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (Number(amount) <= 0) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })
    }

    const apiKey = process.env.XUMM_APIKEY
    const apiSecret = process.env.XUMM_APISECRET

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Xaman API not configured' }, { status: 500 })
    }

    // Create Xaman payload for Payment transaction
    const payload = {
      txjson: {
        TransactionType: 'Payment',
        Account: issuerAddress,
        Destination: destinationAddress,
        Amount: {
          currency: tokenSymbol,
          value: String(amount),
          issuer: issuerAddress,
        },
      },
      options: {
        submit: true,
        expire: 300,
      },
      custom_meta: {
        instruction: `Send ${amount} ${tokenSymbol} tokens to ${destinationAddress.slice(0, 8)}...${destinationAddress.slice(-6)}`,
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
        { error: data.error?.message ?? 'Failed to create payload' },
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
