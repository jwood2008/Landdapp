import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PortfolioSummary } from '@/components/dashboard/portfolio-summary'
import { HoldingsTable } from '@/components/dashboard/holdings-table'
import { SyncHoldings } from '@/components/dashboard/sync-holdings'
import { YieldCalculator } from '@/components/dashboard/yield-calculator'
import { WalletPrompt } from '@/components/dashboard/wallet-prompt'
import type { AssetRow } from '@/types/database'

export default async function IssuerPortfolioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Find the issuer's PERSONAL wallet — same logic as investor.
  // This is their custodial/linked wallet, NOT the asset issuer wallets.
  let walletAddress: string | null = null

  const { data: wallet } = await supabase
    .from('wallets')
    .select('address')
    .eq('user_id', user.id)
    .eq('is_primary', true)
    .single()

  if (wallet) {
    walletAddress = wallet.address
  } else {
    // Fall back to custodial wallet (same as investor)
    const { data: custodial } = await supabase
      .from('custodial_wallets')
      .select('address')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .single()

    if (custodial) {
      walletAddress = custodial.address
      // Sync to wallets table so future loads find it
      await supabase.from('wallets').upsert(
        { user_id: user.id, address: custodial.address, label: 'Platform Wallet', is_primary: true },
        { onConflict: 'address' }
      )
    }
  }

  if (!walletAddress) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
          <p className="text-base text-muted-foreground">Your personal token holdings</p>
        </div>
        <WalletPrompt userId={user.id} />
      </div>
    )
  }

  // Fetch holdings from personal wallet (synced from XRPL)
  const { data: holdings } = await supabase
    .from('investor_holdings')
    .select('*, assets(*)')
    .eq('wallet_address', walletAddress)

  const firstHolding = holdings?.[0]
  const firstAsset = firstHolding?.assets as AssetRow | null

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
          <p className="text-base text-muted-foreground">
            Personal holdings for{' '}
            <span className="font-mono text-xs">
              {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
            </span>
          </p>
        </div>
        <SyncHoldings walletAddress={walletAddress} />
      </div>

      <PortfolioSummary holdings={holdings ?? []} />
      <HoldingsTable holdings={holdings ?? []} assetBasePath="/issuer/asset" />

      {firstHolding && firstAsset && (
        <YieldCalculator
          navPerToken={Number(firstAsset.nav_per_token)}
          tokenBalance={Number(firstHolding.token_balance)}
          annualYield={Number(firstAsset.annual_yield ?? 8)}
          tokenSymbol={firstAsset.token_symbol}
        />
      )}
    </div>
  )
}
