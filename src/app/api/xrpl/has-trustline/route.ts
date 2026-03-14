import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

const XRPL_RPC = process.env.XRPL_NETWORK !== 'mainnet'
  ? 'https://testnet.xrpl-labs.com/'
  : 'https://xrplcluster.com/'

/**
 * Check if a wallet has a trust line for a specific token.
 * GET /api/xrpl/has-trustline?address=rXXX&currency=PBL&issuer=rYYY
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error

  const address = req.nextUrl.searchParams.get('address')
  const currency = req.nextUrl.searchParams.get('currency')
  const issuer = req.nextUrl.searchParams.get('issuer')

  if (!address || !currency || !issuer) {
    return NextResponse.json({ error: 'address, currency, and issuer required' }, { status: 400 })
  }

  try {
    const res = await fetch(XRPL_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'account_lines',
        params: [{ account: address, peer: issuer, ledger_index: 'validated' }],
      }),
    })

    const data = await res.json()
    const lines = data?.result?.lines ?? []
    const hasTrustline = lines.some(
      (line: { currency: string; account: string }) =>
        line.currency === currency && line.account === issuer
    )

    return NextResponse.json({ hasTrustline })
  } catch {
    // If check fails, assume no trust line (will create one)
    return NextResponse.json({ hasTrustline: false })
  }
}
