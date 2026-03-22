import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MarketplaceBrowser } from '@/components/marketplace/marketplace-browser'
import { WalletStatusBar } from '@/components/wallet/wallet-status-bar'

/**
 * Issuer marketplace — same marketplace as investors.
 * Issuers can buy/sell tokens (including their own) using their personal wallet.
 */
export default async function IssuerMarketplacePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: assets },
    { data: orders },
    { data: filledOrders },
    { data: settings },
    { data: contracts },
    { data: recentDistributions },
  ] = await Promise.all([
    supabase
      .from('assets')
      .select('*')
      .eq('is_active', true)
      .order('asset_name'),
    supabase
      .from('marketplace_orders')
      .select('*, assets(asset_name, token_symbol, nav_per_token)')
      .in('status', ['open', 'partial'])
      .order('created_at', { ascending: false }),
    supabase
      .from('marketplace_orders')
      .select('*, assets(asset_name, token_symbol, nav_per_token)')
      .eq('status', 'filled')
      .order('updated_at', { ascending: false })
      .limit(50),
    supabase
      .from('platform_settings')
      .select('*')
      .limit(1)
      .single(),
    supabase
      .from('asset_contracts')
      .select('asset_id, tenant_name, annual_amount, payment_frequency, lease_start_date, lease_end_date, currency')
      .eq('is_active', true),
    supabase
      .from('distributions')
      .select('asset_id, total_amount, currency, status, royalty_period, created_at')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  // Find current user's platform_investor record
  let currentInvestor = null
  const { data: investorByUserId } = await supabase
    .from('platform_investors')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (investorByUserId) {
    currentInvestor = investorByUserId
  } else {
    const { data: wallet } = await supabase
      .from('wallets')
      .select('address')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .single()

    if (wallet) {
      const { data } = await supabase
        .from('platform_investors')
        .select('*')
        .eq('wallet_address', wallet.address)
        .single()
      currentInvestor = data
    }
  }

  // Check if user has a custodial wallet (platform holds keys)
  const { data: custodialWallet } = await supabase
    .from('custodial_wallets')
    .select('address')
    .eq('user_id', user.id)
    .eq('is_primary', true)
    .single()

  // Also check wallets table for any linked wallet (custodial or external)
  const { data: linkedWallet } = await supabase
    .from('wallets')
    .select('address')
    .eq('user_id', user.id)
    .eq('is_primary', true)
    .single()

  // Show whichever wallet exists (custodial takes priority for display)
  const displayWallet = custodialWallet?.address ?? linkedWallet?.address ?? null

  // Compute available tokens per asset (same as investor dashboard)
  const { data: availableRows } = await supabase.rpc('get_available_tokens')
  const availableByAssetId: Record<string, number> = {}
  for (const row of availableRows ?? []) {
    availableByAssetId[row.asset_id] = Number(row.available_tokens)
  }

  return (
    <div className="space-y-8">
      <WalletStatusBar walletAddress={displayWallet} />
      <MarketplaceBrowser
        assets={assets ?? []}
        orders={orders ?? []}
        filledOrders={filledOrders ?? []}
        currentInvestor={currentInvestor}
        settings={settings}
        contracts={(contracts ?? []) as { asset_id: string; tenant_name: string | null; annual_amount: number | null; payment_frequency: string | null; lease_start_date: string | null; lease_end_date: string | null; currency: string }[]}
        distributions={(recentDistributions ?? []) as { asset_id: string; total_amount: number; currency: string; status: string; royalty_period: string | null; created_at: string }[]}
        hasCustodialWallet={!!custodialWallet}
        availableByAssetId={availableByAssetId}
      />
    </div>
  )
}
