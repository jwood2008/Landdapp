import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MarketplaceBrowser } from '@/components/marketplace/marketplace-browser'
import { WalletStatusBar } from '@/components/wallet/wallet-status-bar'

/**
 * Investor home page — the marketplace.
 * Browse land tokens, view order books, buy/sell.
 */
export default async function InvestorMarketplacePage() {
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
      .eq('status', 'open')
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
  // First try by user_id (set on signup), then fall back to wallet address
  let currentInvestor = null
  const { data: investorByUserId } = await supabase
    .from('platform_investors')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (investorByUserId) {
    currentInvestor = investorByUserId
  } else {
    // Legacy path: look up by linked wallet address
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

  // Check if user has a custodial wallet
  const { data: custodialWallet } = await supabase
    .from('custodial_wallets')
    .select('address')
    .eq('user_id', user.id)
    .eq('is_primary', true)
    .single()

  const isPending = currentInvestor && currentInvestor.kyc_status === 'pending'

  return (
    <div className="space-y-4">
      {isPending && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 mt-0.5">
            <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Account pending approval</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your account is being reviewed by our team. You&apos;ll be able to trade once approved. This usually takes less than 24 hours.
            </p>
          </div>
        </div>
      )}
      <WalletStatusBar walletAddress={custodialWallet?.address ?? null} />
      <MarketplaceBrowser
        assets={assets ?? []}
        orders={orders ?? []}
        filledOrders={filledOrders ?? []}
        currentInvestor={currentInvestor}
        settings={settings}
        contracts={(contracts ?? []) as { asset_id: string; tenant_name: string | null; annual_amount: number | null; payment_frequency: string | null; lease_start_date: string | null; lease_end_date: string | null; currency: string }[]}
        distributions={(recentDistributions ?? []) as { asset_id: string; total_amount: number; currency: string; status: string; royalty_period: string | null; created_at: string }[]}
      />
    </div>
  )
}
