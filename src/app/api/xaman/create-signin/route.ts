import { NextResponse } from 'next/server'

export async function POST() {
  const apiKey = process.env.XUMM_APIKEY
  const apiSecret = process.env.XUMM_APISECRET

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: 'Xaman API not configured' }, { status: 503 })
  }

  const res = await fetch('https://xumm.app/api/v1/platform/payload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'x-api-secret': apiSecret,
    },
    body: JSON.stringify({ txjson: { TransactionType: 'SignIn' } }),
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `Xaman error: ${text}` }, { status: res.status })
  }

  const data = await res.json()
  return NextResponse.json({
    uuid: data.uuid,
    qr_png: data.refs?.qr_png,
    deep_link: data.next?.always,
  })
}
