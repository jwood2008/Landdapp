import { createClient } from '@/lib/supabase/server'
import { PlatformInvestorManager } from '@/components/admin/platform-investor-manager'
import { CustodialWalletsTable } from '@/components/admin/custodial-wallets-table'

export default async function AdminInvestorsPage() {
  const supabase = await createClient()

  const [
    { data: investors },
    { data: authorizations },
    { data: assets },
    { data: settings },
    { data: custodialWallets },
  ] = await Promise.all([
    supabase
      .from('platform_investors')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('platform_authorizations')
      .select('*'),
    supabase
      .from('assets')
      .select('id, asset_name, token_symbol, issuer_wallet, is_active')
      .eq('is_active', true)
      .order('asset_name'),
    supabase
      .from('platform_settings')
      .select('*')
      .limit(1)
      .single(),
    supabase
      .from('custodial_wallets')
      .select('id, user_id, address, encryption_method, is_primary, wallet_type, label, asset_id, created_at')
      .order('created_at', { ascending: false }),
  ])

  // Join custodial wallets with user info (for investor wallets)
  const walletUserIds = (custodialWallets ?? [])
    .map((w) => (w as Record<string, unknown>).user_id as string | null)
    .filter((id): id is string => id !== null)

  let userMap: Record<string, { email: string; full_name: string | null }> = {}
  if (walletUserIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, email, full_name')
      .in('id', walletUserIds)
    if (users) {
      userMap = Object.fromEntries(users.map((u) => [u.id, { email: u.email, full_name: u.full_name }]))
    }
  }

  // Build asset map for token wallets
  const assetMap: Record<string, { asset_name: string; token_symbol: string }> = {}
  for (const a of (assets ?? [])) {
    const asset = a as { id: string; asset_name: string; token_symbol: string }
    assetMap[asset.id] = { asset_name: asset.asset_name, token_symbol: asset.token_symbol }
  }

  // Cast to typed array for the client component
  const typedWallets = (custodialWallets ?? []).map((w) => {
    const wt = w as Record<string, unknown>
    return {
      id: wt.id as string,
      user_id: (wt.user_id as string | null) ?? null,
      address: wt.address as string,
      encryption_method: wt.encryption_method as string,
      is_primary: wt.is_primary as boolean,
      wallet_type: (wt.wallet_type as 'investor' | 'token') ?? 'investor',
      label: (wt.label as string | null) ?? null,
      asset_id: (wt.asset_id as string | null) ?? null,
      created_at: wt.created_at as string,
    }
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Investors</h1>
        <p className="text-base text-muted-foreground">
          Manage the permission domain — approve investors, verify KYC/AML, and authorize token access
        </p>
      </div>

      <PlatformInvestorManager
        investors={investors ?? []}
        authorizations={authorizations ?? []}
        assets={assets ?? []}
        settings={settings}
      />

      <CustodialWalletsTable
        wallets={typedWallets}
        userMap={userMap}
        assetMap={assetMap}
      />
    </div>
  )
}
