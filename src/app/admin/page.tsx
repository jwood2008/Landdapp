import { createClient } from '@/lib/supabase/server'
import { AdminSummary } from '@/components/admin/admin-summary'
import { AssetsManagementTable } from '@/components/admin/assets-management-table'
import { RecentDistributionsAdmin } from '@/components/admin/recent-distributions-admin'
import { PendingAccounts } from '@/components/admin/pending-accounts'

export default async function AdminPage() {
  const supabase = await createClient()

  const [
    { data: assets },
    { data: distributions },
    { count: investorCount },
    { count: verifiedCount },
    { data: pendingUsers },
  ] = await Promise.all([
    supabase.from('assets').select('*').order('created_at', { ascending: false }),
    supabase
      .from('distributions')
      .select('*, assets(asset_name, token_symbol)')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('platform_investors').select('*', { count: 'exact', head: true }),
    supabase.from('platform_investors').select('*', { count: 'exact', head: true }).eq('kyc_status', 'verified'),
    supabase
      .from('users')
      .select('id, email, full_name, role, wallet_preference, terms_accepted_at, created_at')
      .eq('account_status', 'pending')
      .order('created_at', { ascending: false }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-muted-foreground">Manage the permission domain — assets, investors, and distributions</p>
      </div>

      <PendingAccounts
        pendingUsers={(pendingUsers ?? []) as Array<{
          id: string; email: string; full_name: string | null; role: string;
          wallet_preference: string | null; terms_accepted_at: string | null; created_at: string
        }>}
      />

      <AdminSummary
        assetCount={assets?.length ?? 0}
        investorCount={investorCount ?? 0}
        verifiedInvestorCount={verifiedCount ?? 0}
        distributions={distributions ?? []}
      />

      <AssetsManagementTable assets={assets ?? []} />
      <RecentDistributionsAdmin distributions={distributions ?? []} />
    </div>
  )
}
