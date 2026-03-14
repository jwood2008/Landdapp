import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart3, TrendingUp, Users, DollarSign } from 'lucide-react'

export default async function IssuerAnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: assets } = await supabase
    .from('assets')
    .select('*')
    .eq('owner_id', user.id)
    .eq('is_active', true)

  const assetIds = (assets ?? []).map((a) => a.id)

  const [valuationsResult, holdingsResult, royaltiesResult] = await Promise.all([
    assetIds.length > 0
      ? supabase.from('valuations').select('*').in('asset_id', assetIds).order('created_at', { ascending: false }).limit(20)
      : Promise.resolve({ data: [] }),
    assetIds.length > 0
      ? supabase.from('investor_holdings').select('*').in('asset_id', assetIds).gt('token_balance', 0)
      : Promise.resolve({ data: [] }),
    assetIds.length > 0
      ? supabase.from('distributions').select('*').in('asset_id', assetIds).eq('status', 'completed').order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  const valuations = valuationsResult.data ?? []
  const holdings = holdingsResult.data ?? []
  const royalties = royaltiesResult.data ?? []

  const totalRoyaltiesPaid = royalties.reduce((sum, r) => sum + Number(r.total_amount ?? 0), 0)
  const uniqueHolders = new Set(holdings.map((h) => (h as { wallet_address: string }).wallet_address)).size

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Performance data for your tokenized land assets</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valuation Changes</p>
                <p className="text-2xl font-bold tabular-nums">{valuations.length}</p>
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
                <p className="text-xs text-muted-foreground">Active Holders</p>
                <p className="text-2xl font-bold tabular-nums">{uniqueHolders}</p>
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
                <p className="text-xs text-muted-foreground">Royalties Paid</p>
                <p className="text-2xl font-bold tabular-nums">${totalRoyaltiesPaid.toLocaleString()}</p>
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
                <p className="text-xs text-muted-foreground">Royalty Events</p>
                <p className="text-2xl font-bold tabular-nums">{royalties.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Valuation history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Valuation History</CardTitle>
          <CardDescription>Recent valuation changes across your assets</CardDescription>
        </CardHeader>
        <CardContent>
          {valuations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No valuation history yet.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Event</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Previous</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Current</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {valuations.slice(0, 10).map((v) => {
                    const change = Number(v.current_value) - Number(v.previous_value)
                    const pct = Number(v.previous_value) > 0 ? (change / Number(v.previous_value)) * 100 : 0
                    return (
                      <tr key={v.id} className="hover:bg-muted/10">
                        <td className="px-4 py-3 text-xs">
                          {new Date(v.recorded_at ?? v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-[10px]">{v.event_type}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">${Number(v.previous_value).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-medium tabular-nums">${Number(v.current_value).toLocaleString()}</td>
                        <td className={`px-4 py-3 text-right text-xs font-medium tabular-nums ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {change >= 0 ? '+' : ''}{pct.toFixed(1)}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
