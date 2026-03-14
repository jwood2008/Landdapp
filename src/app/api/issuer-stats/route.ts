import { NextRequest, NextResponse } from 'next/server'

const XRPL_MAINNET = 'https://xrplcluster.com/'
const XRPL_TESTNET = 'https://s.altnet.rippletest.net:51234/'

interface TrustLine {
  account: string
  balance: string
  currency: string
  limit: string
  limit_peer: string
}

interface XrplTx {
  tx?: {
    TransactionType: string
    Destination?: string
    Amount?: unknown
    date?: number
    hash?: string
  }
  meta?: {
    TransactionResult?: string
    delivered_amount?: unknown
  }
}

async function rpc(endpoint: string, method: string, params: unknown) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, params: [params] }),
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json?.result?.error && json.result.error !== 'actNotFound') {
    throw new Error(json.result.error_message ?? json.result.error)
  }
  return json?.result
}

// Detects which network the account lives on by checking for non-empty account_lines
async function detectNetwork(address: string): Promise<string> {
  for (const [endpoint, network] of [[XRPL_MAINNET, 'mainnet'], [XRPL_TESTNET, 'testnet']] as const) {
    try {
      const result = await rpc(endpoint, 'account_info', { account: address, ledger_index: 'validated' })
      if (result?.account_data) return network
    } catch {
      continue
    }
  }
  // Default to testnet for dev wallets
  return 'testnet'
}

async function rpcOnNetwork(network: string, method: string, params: unknown) {
  const endpoint = network === 'mainnet' ? XRPL_MAINNET : XRPL_TESTNET
  return rpc(endpoint, method, params)
}

export async function POST(req: NextRequest) {
  try {
    const { issuerAddress, tokenSymbol, tokenSupply } = await req.json()
    if (!issuerAddress) return NextResponse.json({ error: 'issuerAddress required' }, { status: 400 })

    // Detect which network the issuer wallet is on
    const network = await detectNetwork(issuerAddress)

    // Fetch all trustlines from the issuer's account
    const linesResult = await rpcOnNetwork(network, 'account_lines', {
      account: issuerAddress,
      ledger_index: 'validated',
      limit: 400,
    })
    const lines: TrustLine[] = linesResult?.lines ?? []

    // Filter to the relevant token; issuer sees holder balances as negative
    const tokenLines = tokenSymbol
      ? lines.filter((l) => l.currency === tokenSymbol)
      : lines

    const holders = tokenLines
      .map((l) => ({
        address: l.account,
        balance: Math.abs(parseFloat(l.balance)), // negative from issuer perspective
        limit: parseFloat(l.limit_peer),
      }))
      .filter((h) => h.balance > 0)
      .sort((a, b) => b.balance - a.balance)

    const totalCirculating = holders.reduce((sum, h) => sum + h.balance, 0)
    const supply = tokenSupply ? Number(tokenSupply) : totalCirculating

    const holdersWithPercent = holders.map((h) => ({
      ...h,
      percent: supply > 0 ? (h.balance / supply) * 100 : 0,
    }))

    // Fetch recent transactions on the same network
    const txResult = await rpcOnNetwork(network, 'account_tx', {
      account: issuerAddress,
      limit: 50,
      ledger_index_min: -1,
      ledger_index_max: -1,
    })
    const txData: XrplTx[] = txResult?.transactions ?? []

    // Parse payment transactions (distributions sent from issuer)
    const recentPayments = txData
      .filter(
        (t) =>
          t.tx?.TransactionType === 'Payment' &&
          t.meta?.TransactionResult === 'tesSUCCESS' &&
          t.tx?.Destination !== issuerAddress
      )
      .slice(0, 20)
      .map((t) => {
        const amount = t.meta?.delivered_amount ?? t.tx?.Amount
        let amountDisplay = ''
        if (typeof amount === 'string') {
          // XRP in drops
          amountDisplay = `${(parseInt(amount) / 1_000_000).toFixed(6)} XRP`
        } else if (typeof amount === 'object' && amount !== null) {
          const a = amount as { value: string; currency: string }
          amountDisplay = `${parseFloat(a.value).toLocaleString()} ${a.currency}`
        }
        return {
          hash: t.tx?.hash ?? '',
          destination: t.tx?.Destination ?? '',
          amount: amountDisplay,
          // XRPL epoch starts 2000-01-01, Unix epoch starts 1970-01-01 (diff = 946684800)
          date: t.tx?.date ? new Date((t.tx.date + 946684800) * 1000).toISOString() : null,
        }
      })

    return NextResponse.json({
      network,
      tokenSymbol,
      totalSupply: supply,
      circulating: totalCirculating,
      reservedByIssuer: supply - totalCirculating,
      holderCount: holders.length,
      holders: holdersWithPercent.slice(0, 50),
      recentPayments,
      // Debug: raw lines so we can verify currency/balance format
      _debug: { lineCount: lines.length, rawLines: lines.slice(0, 10) },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
