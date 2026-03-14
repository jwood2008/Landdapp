import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'

/**
 * Checks which wallets have trust lines for a given currency.
 * Uses XRPL account_lines to inspect each wallet.
 *
 * Query: ?wallets=rAddr1,rAddr2&currency=RLUSD
 * Returns: { results: { address, hasTrustline }[] }
 */

const RLUSD_HEX = '524C555344000000000000000000000000000000'
const RLUSD_ISSUER = 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De'

const XRPL_ENDPOINTS = [
  'https://xrplcluster.com',
  'https://s1.ripple.com:51234',
]

async function xrplRequest(body: object): Promise<Record<string, unknown> | null> {
  for (const endpoint of XRPL_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        return await res.json()
      }
    } catch {
      continue
    }
  }
  return null
}

interface TrustLineResult {
  address: string
  hasTrustline: boolean
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth && auth.error) return auth.error

  const walletsParam = req.nextUrl.searchParams.get('wallets')
  const currency = req.nextUrl.searchParams.get('currency')
  const issuerWallet = req.nextUrl.searchParams.get('issuerWallet')

  if (!walletsParam || !currency) {
    return NextResponse.json({ error: 'wallets and currency required' }, { status: 400 })
  }

  if (currency === 'XRP') {
    // XRP doesn't need trustlines
    const wallets = walletsParam.split(',')
    return NextResponse.json({
      results: wallets.map((w) => ({ address: w, hasTrustline: true })),
    })
  }

  // Determine what we're looking for
  let targetCurrency: string
  let targetIssuer: string

  if (currency === 'RLUSD') {
    targetCurrency = RLUSD_HEX
    targetIssuer = RLUSD_ISSUER
  } else {
    if (!issuerWallet) {
      return NextResponse.json({ error: 'issuerWallet required for non-RLUSD tokens' }, { status: 400 })
    }
    targetCurrency = currency
    targetIssuer = issuerWallet
  }

  const wallets = walletsParam.split(',').filter(Boolean)
  const results: TrustLineResult[] = []

  for (const address of wallets) {
    try {
      const data = await xrplRequest({
        method: 'account_lines',
        params: [{ account: address, ledger_index: 'validated' }],
      })

      if (!data || (data as Record<string, unknown>).result === undefined) {
        results.push({ address, hasTrustline: false })
        continue
      }

      const result = (data as Record<string, Record<string, unknown>>).result
      const lines = (result.lines ?? []) as Array<{ currency: string; account: string }>

      const hasTrustline = lines.some(
        (line) => line.currency === targetCurrency && line.account === targetIssuer
      )

      results.push({ address, hasTrustline })
    } catch {
      results.push({ address, hasTrustline: false })
    }
  }

  return NextResponse.json({ results })
}
