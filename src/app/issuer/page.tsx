import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Building2, Users, DollarSign, TrendingUp } from 'lucide-react'
import { IssuerAssetCards } from '@/components/issuer/issuer-asset-cards'

export default async function IssuerDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch issuer's assets
  const { data: assets } = await supabase
    .from('assets')
    .select('*')
    .eq('owner_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const assetIds = (assets ?? []).map((a) => a.id)

  // Fetch investor counts per asset and recent updates
  const [holdersResult, updatesResult, royaltiesResult] = await Promise.all([
    assetIds.length > 0
      ? supabase
          .from('investor_holdings')
          .select('asset_id, wallet_address, token_balance, ownership_percent')
          .in('asset_id', assetIds)
          .gt('token_balance', 0)
      : Promise.resolve({ data: [] }),
    assetIds.length > 0
      ? supabase
          .from('issuer_updates')
          .select('id, asset_id, quarter, published, created_at')
          .eq('issuer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    assetIds.length > 0
      ? supabase
          .from('distributions')
          .select('id, asset_id, total_amount, status, currency, created_at')
          .in('asset_id', assetIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const holders = (holdersResult.data ?? []) as Array<{ asset_id: string; wallet_address: string; token_balance: number; ownership_percent: number }>
  const updates = (updatesResult.data ?? []) as Array<{ id: string; asset_id: string; quarter: string; published: boolean; created_at: string }>
  const royalties = (royaltiesResult.data ?? []) as Array<{ id: string; asset_id: string; total_amount: number; status: string; currency: string; created_at: string }>

  const totalValuation = (assets ?? []).reduce((sum, a) => sum + Number(a.current_valuation), 0)
  const uniqueInvestors = new Set(holders.map((h) => h.wallet_address)).size
  const totalRoyaltiesPaid = royalties.filter((r) => r.status === 'completed').reduce((sum, r) => sum + r.total_amount, 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Issuer Dashboard</h1>
        <p className="text-base text-muted-foreground">Manage your tokenized land assets</p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">My Assets</p>
                <p className="text-2xl font-bold tabular-nums">{assets?.length ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-success">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Valuation</p>
                <p className="text-2xl font-bold tabular-nums">${totalValuation.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10">
                <Users className="h-5 w-5 text-teal-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Token Holders</p>
                <p className="text-2xl font-bold tabular-nums">{uniqueInvestors}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-warning">
                <TrendingUp className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Royalties Paid</p>
                <p className="text-2xl font-bold tabular-nums">${totalRoyaltiesPaid.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Asset cards */}
      {(!assets || assets.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No tokenized assets yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Contact the platform administrator to get your land token created.</p>
          </CardContent>
        </Card>
      ) : (
        <IssuerAssetCards
          assets={assets as any}
          holders={holders}
          updates={updates}
          distributions={royalties}
        />
      )}
    </div>
  )
}
