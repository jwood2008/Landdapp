import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const uuid = req.nextUrl.searchParams.get('uuid')
  if (!uuid) return NextResponse.json({ error: 'uuid required' }, { status: 400 })

  const apiKey = process.env.XUMM_APIKEY
  const apiSecret = process.env.XUMM_APISECRET

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: 'Xaman API not configured' }, { status: 503 })
  }

  const res = await fetch(`https://xumm.app/api/v1/platform/payload/${uuid}`, {
    headers: {
      'x-api-key': apiKey,
      'x-api-secret': apiSecret,
    },
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to check payload status' }, { status: res.status })
  }

  const data = await res.json()
  return NextResponse.json({
    signed: data.meta?.signed ?? false,
    expired: data.meta?.expired ?? false,
    address: data.response?.account ?? null,
    txHash: data.response?.txid ?? null,
  })
}
