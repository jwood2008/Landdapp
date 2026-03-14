import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Store, TrendingUp, ArrowLeftRight, DollarSign } from 'lucide-react'
import { ListOnDex } from '@/components/admin/list-on-dex'

export default async function AdminMarketplacePage() {
  const supabase = await createClient()

  const [
    { data: openOrders, count: openCount },
    { data: recentTrades, count: tradeCount },
    { data: settings },
    { data: dexAssets },
  ] = await Promise.all([
    supabase
      .from('marketplace_orders')
      .select('*, assets(asset_name, token_symbol), platform_investors(wallet_address, full_name)', { count: 'exact' })
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('trades')
      .select('*, assets(asset_name, token_symbol)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('platform_settings').select('*').limit(1).single(),
    supabase
      .from('assets')
      .select('id, asset_name, token_symbol, issuer_wallet, nav_per_token, token_supply')
      .eq('is_active', true)
      .order('asset_name'),
  ])

  const totalVolume = (recentTrades ?? []).reduce(
    (sum, t) => sum + Number((t as Record<string, unknown>).total_price ?? 0), 0
  )

  function truncAddr(a: string) {
    return `${a.slice(0, 8)}...${a.slice(-6)}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketplace Overview</h1>
        <p className="text-muted-foreground">
          Monitor trading activity across the permission domain
          {!settings?.marketplace_enabled && (
            <Badge variant="destructive" className="ml-2 text-xs">Marketplace Disabled</Badge>
          )}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Store className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Open Orders</p>
                <p className="text-2xl font-bold tabular-nums">{openCount ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
                <ArrowLeftRight className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Trades</p>
                <p className="text-2xl font-bold tabular-nums">{tradeCount ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10">
                <DollarSign className="h-5 w-5 text-teal-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Volume</p>
                <p className="text-2xl font-bold tabular-nums">
                  ${totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
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
                <p className="text-xs text-muted-foreground">Platform Fee</p>
                <p className="text-2xl font-bold tabular-nums">{((settings?.marketplace_fee_bps ?? 0) / 100).toFixed(2)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* List tokens on DEX */}
      <ListOnDex assets={(dexAssets ?? []) as { id: string; asset_name: string; token_symbol: string; issuer_wallet: string; nav_per_token: number; token_supply: number }[]} />

      {/* Open Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Open Orders</CardTitle>
          <CardDescription>{openCount ?? 0} active orders on the marketplace</CardDescription>
        </CardHeader>
        <CardContent>
          {(!openOrders || openOrders.length === 0) ? (
            <div className="py-8 text-center">
              <Store className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No open orders yet.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="text-left px-4 py-2 text-muted-foreground font-medium">Asset</th>
                    <th className="text-center px-4 py-2 text-muted-foreground font-medium">Side</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">Amount</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">Price</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">Total</th>
                    <th className="text-left px-4 py-2 text-muted-foreground font-medium">Investor</th>
                    <th className="text-left px-4 py-2 text-muted-foreground font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {openOrders.map((order) => {
                    const o = order as Record<string, unknown>
                    const asset = o.assets as { asset_name: string; token_symbol: string } | null
                    const investor = o.platform_investors as { wallet_address: string; full_name: string | null } | null
                    return (
                      <tr key={o.id as string} className="hover:bg-muted/10">
                        <td className="px-4 py-2.5">
                          <span className="font-medium">{asset?.token_symbol ?? '—'}</span>
                          <span className="text-muted-foreground ml-1">{asset?.asset_name}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge className={`text-[10px] ${
                            o.side === 'buy'
                              ? 'bg-green-500/10 text-green-500'
                              : 'bg-red-500/10 text-red-500'
                          }`}>
                            {(o.side as string).toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">{Number(o.token_amount).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">${Number(o.price_per_token).toFixed(4)}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums font-medium">
                          ${(Number(o.token_amount) * Number(o.price_per_token)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground">
                          {investor?.full_name ?? truncAddr(investor?.wallet_address ?? '')}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {new Date(o.created_at as string).toLocaleDateString()}
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

      {/* Recent Trades */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Trades</CardTitle>
          <CardDescription>Completed trades between platform investors</CardDescription>
        </CardHeader>
        <CardContent>
          {(!recentTrades || recentTrades.length === 0) ? (
            <div className="py-8 text-center">
              <ArrowLeftRight className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No trades yet.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="text-left px-4 py-2 text-muted-foreground font-medium">Asset</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">Amount</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">Price</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">Total</th>
                    <th className="text-center px-4 py-2 text-muted-foreground font-medium">Status</th>
                    <th className="text-left px-4 py-2 text-muted-foreground font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentTrades.map((trade) => {
                    const t = trade as Record<string, unknown>
                    const asset = t.assets as { asset_name: string; token_symbol: string } | null
                    return (
                      <tr key={t.id as string} className="hover:bg-muted/10">
                        <td className="px-4 py-2.5 font-medium">{asset?.token_symbol ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">{Number(t.token_amount).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">${Number(t.price_per_token).toFixed(4)}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums font-medium">
                          ${Number(t.total_price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge className={`text-[10px] ${
                            t.status === 'settled' ? 'bg-green-500/10 text-green-500' :
                            t.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                            'bg-red-500/10 text-red-500'
                          }`}>
                            {(t.status as string)}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {new Date(t.created_at as string).toLocaleDateString()}
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
