import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Coins, DollarSign, TrendingUp, Calendar } from 'lucide-react'

export default async function RoyaltiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: wallet } = await supabase
    .from('wallets')
    .select('address')
    .eq('user_id', user.id)
    .eq('is_primary', true)
    .single()

  if (!wallet) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Royalties</h1>
          <p className="text-muted-foreground">Connect a wallet to view your royalties</p>
        </div>
      </div>
    )
  }

  // Fetch all royalty payments for this wallet
  const { data: payments } = await supabase
    .from('distribution_payments')
    .select(`
      *,
      distributions (
        event_type,
        royalty_period,
        is_royalty,
        created_at,
        status,
        assets ( asset_name, token_symbol, cover_image_url )
      )
    `)
    .eq('wallet_address', wallet.address)
    .order('created_at', { ascending: false })

  const allPayments = (payments ?? []) as Array<{
    id: string
    wallet_address: string
    amount: number
    currency: string
    ownership_percent: number
    status: string
    tx_hash: string | null
    created_at: string
    distributions: {
      event_type: string
      royalty_period: string | null
      is_royalty: boolean
      created_at: string
      status: string
      assets: { asset_name: string; token_symbol: string; cover_image_url: string | null }
    }
  }>

  const completedPayments = allPayments.filter((p) => p.status === 'completed')
  const pendingPayments = allPayments.filter((p) => p.status === 'pending')
  const totalEarned = completedPayments.reduce((sum, p) => sum + p.amount, 0)
  const pendingAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0)

  // Group by asset
  const byAsset = new Map<string, { name: string; symbol: string; total: number; count: number }>()
  for (const p of completedPayments) {
    const symbol = p.distributions?.assets?.token_symbol ?? 'Unknown'
    const existing = byAsset.get(symbol) ?? { name: p.distributions?.assets?.asset_name ?? '', symbol, total: 0, count: 0 }
    existing.total += p.amount
    existing.count += 1
    byAsset.set(symbol, existing)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Royalties</h1>
        <p className="text-muted-foreground">Earnings from your land token holdings</p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-success">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Earned</p>
                <p className="text-2xl font-bold tabular-nums">${totalEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-warning">
                <Coins className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold tabular-nums">${pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Payments</p>
                <p className="text-2xl font-bold tabular-nums">{allPayments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Earnings by asset */}
      {byAsset.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Earnings by Asset</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from(byAsset.values()).map((asset) => (
                <div key={asset.symbol} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                  <div>
                    <p className="font-medium text-sm">{asset.name}</p>
                    <p className="text-xs text-muted-foreground">{asset.symbol} · {asset.count} payments</p>
                  </div>
                  <p className="font-bold tabular-nums">${asset.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Payment History
          </CardTitle>
          <CardDescription>All royalty payments to your wallet</CardDescription>
        </CardHeader>
        <CardContent>
          {allPayments.length === 0 ? (
            <div className="py-12 text-center">
              <Coins className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No royalty payments yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Royalties are distributed to token holders based on land income.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Asset</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Period</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Amount</th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/10">
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-xs">{p.distributions?.assets?.asset_name ?? '—'}</p>
                        <p className="text-[11px] text-muted-foreground">{p.distributions?.assets?.token_symbol}</p>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {p.distributions?.royalty_period ?? p.distributions?.event_type ?? '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs font-medium tabular-nums">
                        ${p.amount.toFixed(2)} <span className="text-muted-foreground">{p.currency}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Badge className={`text-xs rounded-full px-2.5 py-0.5 ${
                          p.status === 'completed' ? 'bg-status-success text-success' :
                          p.status === 'pending' ? 'bg-status-warning text-warning' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-right text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
