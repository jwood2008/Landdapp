import { NextResponse } from 'next/server'
import { Client } from 'xrpl'

/**
 * Fetches on-chain account info + trust lines for an XRPL address.
 * Returns: XRP balance, trust line data (who holds the token, how much).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const address = searchParams.get('address')
  const currency = searchParams.get('currency')

  if (!address) {
    return NextResponse.json({ error: 'address required' }, { status: 400 })
  }

  const client = new Client('wss://s1.ripple.com')

  try {
    await client.connect()

    // Fetch account info (XRP balance, flags, etc.)
    const accountInfo = await client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated',
    })

    const xrpBalance = Number(accountInfo.result.account_data.Balance) / 1_000_000
    const flags = accountInfo.result.account_data.Flags ?? 0
    const requireAuth = (flags & 0x40000) !== 0 // lsfRequireAuth

    // Fetch trust lines where this account is the issuer (these are token holders)
    let holders: Array<{
      account: string
      balance: string
      currency: string
      limit: string
      authorized: boolean
    }> = []

    if (currency) {
      try {
        const lines = await client.request({
          command: 'account_lines',
          account: address,
          ledger_index: 'validated',
          limit: 400,
        })

        holders = (lines.result.lines ?? [])
          .filter((line) => line.currency === currency)
          .map((line) => ({
            account: line.account,
            balance: line.balance,
            currency: line.currency,
            limit: line.limit,
            authorized: line.authorized === true,
          }))
      } catch {
        // account_lines may fail on some accounts
      }
    }

    // Compute analytics
    const totalIssued = holders.reduce((sum, h) => {
      const bal = Math.abs(Number(h.balance))
      return sum + bal
    }, 0)

    const holderCount = holders.filter((h) => Math.abs(Number(h.balance)) > 0).length
    const authorizedCount = holders.filter((h) => h.authorized).length

    await client.disconnect()

    return NextResponse.json({
      address,
      xrpBalance,
      requireAuth,
      flags,
      token: currency
        ? {
            currency,
            totalIssued,
            holderCount,
            authorizedCount,
            trustLineCount: holders.length,
            holders: holders.map((h) => ({
              address: h.account,
              balance: Math.abs(Number(h.balance)),
              authorized: h.authorized,
            })),
          }
        : null,
    })
  } catch (err) {
    await client.disconnect().catch(() => {})
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'XRPL request failed' },
      { status: 500 }
    )
  }
}
