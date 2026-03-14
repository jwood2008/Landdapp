import { createClient } from '@supabase/supabase-js'

const XRPL_MAINNET = 'https://xrplcluster.com/'
const XRPL_TESTNET = 'https://s.altnet.rippletest.net:51234/'

interface TrustLine {
  account: string
  balance: string
  currency: string
}

async function getAccountLines(address: string, rpc: string): Promise<TrustLine[]> {
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'account_lines',
      params: [{ account: address, ledger_index: 'validated' }],
    }),
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) throw new Error(`XRPL RPC error: ${res.status}`)
  const json = await res.json()
  const result = json?.result

  if (result?.error) {
    if (result.error === 'actNotFound') return []
    throw new Error(result.error_message ?? result.error)
  }

  return (result?.lines ?? []) as TrustLine[]
}

/**
 * Sync a wallet's XRPL trustline balances into investor_holdings.
 * Uses service role client — no auth cookies needed.
 * Safe to call from server-side code (e.g., after trade matching).
 */
export async function syncHoldingsForWallet(walletAddress: string): Promise<{ synced: number }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch all active assets
  const { data: assets } = await supabase
    .from('assets')
    .select('id, token_symbol, issuer_wallet, token_supply, nav_per_token')
    .eq('is_active', true)

  if (!assets?.length) return { synced: 0 }

  // Try mainnet then testnet
  let trustlines: TrustLine[] = []
  try {
    trustlines = await getAccountLines(walletAddress, XRPL_MAINNET)
    if (trustlines.length === 0) {
      trustlines = await getAccountLines(walletAddress, XRPL_TESTNET)
    }
  } catch {
    try {
      trustlines = await getAccountLines(walletAddress, XRPL_TESTNET)
    } catch {
      return { synced: 0 }
    }
  }

  if (trustlines.length === 0) return { synced: 0 }

  const upserts: {
    wallet_address: string
    asset_id: string
    token_balance: number
    ownership_percent: number
    last_synced_at: string
  }[] = []

  for (const asset of assets) {
    const line = trustlines.find((l) => {
      if (l.currency !== asset.token_symbol) return false
      return l.account === asset.issuer_wallet
    })

    if (!line) continue
    const balance = parseFloat(line.balance)
    if (balance <= 0) continue

    const tokenSupply = Number(asset.token_supply)
    const ownershipPercent = tokenSupply > 0 ? (balance / tokenSupply) * 100 : 0

    upserts.push({
      wallet_address: walletAddress,
      asset_id: asset.id,
      token_balance: balance,
      ownership_percent: ownershipPercent,
      last_synced_at: new Date().toISOString(),
    })
  }

  if (upserts.length > 0) {
    await supabase
      .from('investor_holdings')
      .upsert(upserts, { onConflict: 'wallet_address,asset_id' })
  }

  return { synced: upserts.length }
}
