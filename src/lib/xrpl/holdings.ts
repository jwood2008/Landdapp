import { getAccountLines } from './client'
import { createClient } from '@/lib/supabase/client'
import type { AssetRow } from '@/types/database'

export interface WalletHolding {
  asset: AssetRow
  tokenBalance: number
  ownershipPercent: number
  navValue: number
}

/**
 * Reads wallet trustlines from XRPL and matches them against known assets in Supabase.
 * Returns holdings for all assets the wallet has a trustline balance in.
 */
export async function getWalletHoldings(walletAddress: string): Promise<WalletHolding[]> {
  const supabase = createClient()

  // Fetch all active assets from Supabase
  const { data: assets, error } = await supabase
    .from('assets')
    .select('*')
    .eq('is_active', true)

  if (error || !assets) return []

  // Fetch trustlines from XRPL
  let trustlines: Awaited<ReturnType<typeof getAccountLines>> = []
  try {
    trustlines = await getAccountLines(walletAddress)
  } catch {
    // Wallet may not exist on ledger yet
    return []
  }

  const holdings: WalletHolding[] = []

  for (const asset of assets) {
    // Match trustline: same currency symbol + issuer wallet
    const trustline = trustlines.find(
      (line) =>
        line.currency === asset.token_symbol &&
        line.account === asset.issuer_wallet
    )

    if (trustline && parseFloat(trustline.balance) > 0) {
      const tokenBalance = parseFloat(trustline.balance)
      const ownershipPercent = (tokenBalance / asset.token_supply) * 100
      const navValue = tokenBalance * asset.nav_per_token

      holdings.push({
        asset,
        tokenBalance,
        ownershipPercent,
        navValue,
      })
    }
  }

  return holdings
}

/**
 * Syncs wallet holdings to Supabase investor_holdings table for caching.
 */
export async function syncHoldingsToSupabase(
  walletAddress: string,
  holdings: WalletHolding[]
) {
  const supabase = createClient()

  const upserts = holdings.map((h) => ({
    wallet_address: walletAddress,
    asset_id: h.asset.id,
    token_balance: h.tokenBalance,
    ownership_percent: h.ownershipPercent,
    last_synced_at: new Date().toISOString(),
  }))

  if (upserts.length > 0) {
    await supabase
      .from('investor_holdings')
      .upsert(upserts, { onConflict: 'wallet_address,asset_id' })
  }
}
