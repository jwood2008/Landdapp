import { NextRequest, NextResponse } from 'next/server'
import { xrplRpc, getNetwork } from '@/lib/xrpl/rpc'

/**
 * Checks if an XRPL account has the RequireAuth flag set.
 * Also returns unauthorized trust lines (pending investor requests).
 */
export async function POST(req: NextRequest) {
  const { issuerAddress, currency } = await req.json()
  if (!issuerAddress) {
    return NextResponse.json({ error: 'issuerAddress required' }, { status: 400 })
  }

  const network = getNetwork()

  // Fetch account info
  let accountData = null
  try {
    const json = await xrplRpc('account_info', [
      { account: issuerAddress, ledger_index: 'validated' },
    ], 10000)

    const result = json.result as Record<string, unknown>

    if (result?.error === 'actNotFound') {
      return NextResponse.json({
        error: 'Account not found on the ledger. The wallet may not be funded yet. On testnet, try generating a new wallet (the faucet funds it automatically).',
        notFunded: true,
      }, { status: 404 })
    }

    if (result?.account_data) {
      accountData = result.account_data as Record<string, unknown>
    }
  } catch (err) {
    return NextResponse.json({
      error: `Could not reach XRPL ${network}: ${err instanceof Error ? err.message : 'timeout'}`,
    }, { status: 502 })
  }

  if (!accountData) {
    return NextResponse.json({ error: `Account not found on ${network}` }, { status: 404 })
  }

  // lsfRequireAuth flag = 0x00040000 = 262144
  const flags = (accountData.Flags as number) ?? 0
  const requireAuth = (flags & 262144) !== 0

  // Fetch trust lines to find unauthorized ones
  let trustLines: Array<{
    account: string
    balance: string
    currency: string
    limit: string
    limit_peer: string
    authorized?: boolean
    peer_authorized?: boolean
  }> = []

  try {
    const json = await xrplRpc('account_lines', [
      { account: issuerAddress, ledger_index: 'validated', limit: 400 },
    ], 10000)
    const result = json.result as Record<string, unknown>
    trustLines = (result?.lines as typeof trustLines) ?? []
  } catch {
    // Non-critical — proceed without trust line data
  }

  // Filter to the specific currency if provided
  const filtered = currency
    ? trustLines.filter((l) => l.currency === currency)
    : trustLines

  const authorized = filtered.filter((l) => l.authorized === true)
  const unauthorized = filtered.filter((l) => !l.authorized && requireAuth)

  return NextResponse.json({
    network,
    requireAuth,
    accountFlags: flags,
    trustLines: {
      total: filtered.length,
      authorized: authorized.map((l) => ({
        address: l.account,
        balance: l.balance,
        currency: l.currency,
      })),
      pending: unauthorized.map((l) => ({
        address: l.account,
        balance: l.balance,
        currency: l.currency,
      })),
    },
  })
}
