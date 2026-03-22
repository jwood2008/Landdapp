import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const XRPL_MAINNET = 'https://xrplcluster.com/'
const XRPL_TESTNET = 'https://testnet.xrpl-labs.com/'
const PLACEHOLDER_ISSUER = 'rISSUER_WALLET_ADDRESS_HERE'

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
    signal: AbortSignal.timeout(5000),
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

async function getAccountLinesAnyNetwork(
  address: string
): Promise<{ trustlines: TrustLine[]; network: string }> {
  // Use the configured network first (matches wallet-manager.ts)
  const isTestnet = process.env.XRPL_NETWORK !== 'mainnet'
  const primaryRpc = isTestnet ? XRPL_TESTNET : XRPL_MAINNET
  const primaryName = isTestnet ? 'testnet' : 'mainnet'
  const fallbackRpc = isTestnet ? XRPL_MAINNET : XRPL_TESTNET
  const fallbackName = isTestnet ? 'mainnet' : 'testnet'

  // Try configured network first — if it responds (even with 0 trustlines), use it.
  // Only fall through to the other network if primary is unreachable.
  try {
    const trustlines = await getAccountLines(address, primaryRpc)
    return { trustlines, network: primaryName }
  } catch {
    // primary unreachable — fall through
  }

  // Fall back to other network
  try {
    const trustlines = await getAccountLines(address, fallbackRpc)
    return { trustlines, network: fallbackName }
  } catch (err) {
    throw new Error(`XRPL unreachable on both networks: ${err instanceof Error ? err.message : err}`)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { walletAddress } = await req.json()
    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'walletAddress required' }, { status: 400 })
    }

    // Use session-based client (reads user cookies, respects RLS)
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    )

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Verify wallet belongs to this user
    const { data: walletRow } = await supabase
      .from('wallets')
      .select('address')
      .eq('user_id', user.id)
      .eq('address', walletAddress)
      .single()

    if (!walletRow) {
      return NextResponse.json({ error: 'Wallet not linked to your account' }, { status: 403 })
    }

    // Fetch all assets including delisted (investors may still hold tokens)
    const { data: assets, error: assetsError } = await supabase
      .from('assets')
      .select('id, token_symbol, issuer_wallet, token_supply, nav_per_token, owner_retained_percent')

    if (assetsError) {
      return NextResponse.json({ error: `Assets query: ${assetsError.message}` }, { status: 500 })
    }
    if (!assets || assets.length === 0) {
      return NextResponse.json({ synced: 0, message: 'No assets in database' })
    }

    // Fetch XRPL trustlines (tries mainnet, falls back to testnet)
    let trustlines: TrustLine[] = []
    let network = 'unknown'
    try {
      ;({ trustlines, network } = await getAccountLinesAnyNetwork(walletAddress))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: `XRPL error: ${msg}` }, { status: 502 })
    }

    if (trustlines.length === 0) {
      return NextResponse.json({
        synced: 0,
        trustlineCount: 0,
        network,
        message: `No trustlines found on ${network} — add a trustline for WOD in your wallet`,
      })
    }

    // Match trustlines to assets — XRPL is the source of truth
    const freshHoldings: {
      wallet_address: string
      asset_id: string
      token_balance: number
      ownership_percent: number
      last_synced_at: string
    }[] = []

    const issuerUpdates: { id: string; issuer_wallet: string }[] = []

    for (const asset of assets) {
      const line = trustlines.find((l) => {
        if (l.currency !== asset.token_symbol) return false
        if (asset.issuer_wallet === PLACEHOLDER_ISSUER) return true
        return l.account === asset.issuer_wallet
      })

      if (!line) continue
      const balance = parseFloat(line.balance)
      if (balance <= 0) continue

      if (asset.issuer_wallet === PLACEHOLDER_ISSUER) {
        issuerUpdates.push({ id: asset.id, issuer_wallet: line.account })
      }

      const tokenSupply = Number(asset.token_supply)
      const ownershipPercent = tokenSupply > 0 ? (balance / tokenSupply) * 100 : 0

      freshHoldings.push({
        wallet_address: walletAddress,
        asset_id: asset.id,
        token_balance: balance,
        ownership_percent: ownershipPercent,
        last_synced_at: new Date().toISOString(),
      })
    }

    const assetSymbolById = Object.fromEntries(assets.map(a => [a.id, a.token_symbol]))
    console.log(`[sync-holdings] XRPL trustlines for ${walletAddress}: ${trustlines.map(t => `${t.currency}=${t.balance}`).join(', ')}`)
    console.log(`[sync-holdings] Matched ${freshHoldings.length} holdings: ${freshHoldings.map(h => `${assetSymbolById[h.asset_id] ?? '?'}=${h.token_balance} (${h.ownership_percent.toFixed(1)}%)`).join(', ')}`)

    // Update placeholder issuer_wallet — needs service role or admin
    if (issuerUpdates.length > 0) {
      try {
        const serviceClient = createServiceClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        for (const update of issuerUpdates) {
          await serviceClient
            .from('assets')
            .update({ issuer_wallet: update.issuer_wallet })
            .eq('id', update.id)
        }
      } catch {
        console.warn('Could not update issuer_wallet — service role key may be invalid')
      }
    }

    // Upsert holdings from XRPL — the ledger is the single source of truth.
    // Uses the unique constraint on (wallet_address, asset_id) to update existing rows.
    if (freshHoldings.length > 0) {
      const { error: upsertError } = await supabase
        .from('investor_holdings')
        .upsert(freshHoldings, { onConflict: 'wallet_address,asset_id' })

      if (upsertError) {
        console.error(`[sync-holdings] Upsert failed: ${upsertError.message}`)
        return NextResponse.json({
          error: `Holdings sync failed: ${upsertError.message}`,
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      synced: freshHoldings.length,
      trustlineCount: trustlines.length,
      network,
      issuerDiscovered: issuerUpdates.length > 0,
      xrplBalances: freshHoldings.map(h => ({
        symbol: assetSymbolById[h.asset_id] ?? '?',
        balance: h.token_balance,
        ownership: h.ownership_percent,
      })),
      assets: assets.map(a => a.token_symbol),
      trustlines: trustlines.map(t => ({ currency: t.currency, balance: t.balance, account: t.account })),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
