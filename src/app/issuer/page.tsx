import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Users, DollarSign, TrendingUp, MapPin, FileText } from 'lucide-react'
import Link from 'next/link'

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
          .select('asset_id, wallet_address')
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
          .select('id, asset_id, total_amount, status, created_at')
          .in('asset_id', assetIds)
          .order('created_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
  ])

  const holders = (holdersResult.data ?? []) as Array<{ asset_id: string; wallet_address: string }>
  const updates = (updatesResult.data ?? []) as Array<{ id: string; asset_id: string; quarter: string; published: boolean; created_at: string }>
  const royalties = (royaltiesResult.data ?? []) as Array<{ id: string; asset_id: string; total_amount: number; status: string; created_at: string }>

  const totalValuation = (assets ?? []).reduce((sum, a) => sum + Number(a.current_valuation), 0)
  const uniqueInvestors = new Set(holders.map((h) => h.wallet_address)).size
  const totalRoyaltiesPaid = royalties.filter((r) => r.status === 'completed').reduce((sum, r) => sum + r.total_amount, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Issuer Dashboard</h1>
        <p className="text-muted-foreground">Manage your tokenized land assets</p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
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
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Valuation</p>
                <p className="text-2xl font-bold tabular-nums">${totalValuation.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
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
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <TrendingUp className="h-5 w-5 text-amber-500" />
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
            <Building2 className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No tokenized assets yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Contact the platform administrator to get your land token created.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {assets.map((asset) => {
            const assetHolders = new Set(holders.filter((h) => h.asset_id === asset.id).map((h) => h.wallet_address)).size
            const assetUpdates = updates.filter((u) => u.asset_id === asset.id)
            const latestUpdate = assetUpdates[0]

            return (
              <Card key={asset.id} className="card-hover">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{asset.asset_name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{asset.token_symbol}</Badge>
                        {asset.location && (
                          <span className="flex items-center gap-1 text-xs">
                            <MapPin className="h-3 w-3" />
                            {asset.location}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    {asset.ai_rating && (
                      <Badge className={`text-xs ${
                        asset.ai_rating >= 7 ? 'bg-green-500/10 text-green-500' :
                        asset.ai_rating >= 4 ? 'bg-amber-500/10 text-amber-500' :
                        'bg-red-500/10 text-red-500'
                      }`}>
                        AI: {asset.ai_rating}/10
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Valuation</p>
                      <p className="font-bold tabular-nums">${Number(asset.current_valuation).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">NAV / Token</p>
                      <p className="font-bold font-mono tabular-nums">${asset.nav_per_token.toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Token Holders</p>
                      <p className="font-bold tabular-nums">{assetHolders}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Supply</p>
                      <p className="font-bold tabular-nums">{Number(asset.token_supply).toLocaleString()}</p>
                    </div>
                    {asset.total_acres && (
                      <div>
                        <p className="text-xs text-muted-foreground">Acreage</p>
                        <p className="font-bold">{asset.total_acres} acres</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">Royalty Frequency</p>
                      <p className="font-bold capitalize">{asset.royalty_frequency?.replace('_', ' ') ?? 'Quarterly'}</p>
                    </div>
                  </div>

                  {/* Latest update status */}
                  <div className="rounded-lg border border-border px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      {latestUpdate ? (
                        <span className="text-xs">
                          Last update: <strong>{latestUpdate.quarter}</strong>
                          {!latestUpdate.published && <Badge variant="outline" className="ml-1.5 text-[10px]">Draft</Badge>}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No quarterly updates yet</span>
                      )}
                    </div>
                    <Link
                      href="/issuer/updates"
                      className="text-xs text-primary hover:underline"
                    >
                      Post Update
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
