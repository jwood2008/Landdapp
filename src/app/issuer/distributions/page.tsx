import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { IssueRoyalties } from '@/components/issuer/issue-royalties'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Coins, DollarSign, Calendar, Users } from 'lucide-react'

export default async function IssuerDistributionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch issuer's active assets
  const { data: assets } = await supabase
    .from('assets')
    .select('id, asset_name, token_symbol, issuer_wallet, current_valuation, owner_retained_percent, last_distribution_at, royalty_frequency')
    .eq('owner_id', user.id)
    .eq('is_active', true)
    .order('asset_name')

  const assetIds = (assets ?? []).map((a) => a.id)

  // Fetch holders, contracts, distributions in parallel
  const [holdersResult, contractsResult, distributionsResult, custodialResult] = await Promise.all([
    assetIds.length > 0
      ? supabase
          .from('investor_holdings')
          .select('asset_id, wallet_address, token_balance, ownership_percent')
          .in('asset_id', assetIds)
          .gt('token_balance', 0)
          .order('token_balance', { ascending: false })
      : Promise.resolve({ data: [] }),
    assetIds.length > 0
      ? supabase
          .from('asset_contracts')
          .select('asset_id, tenant_name, annual_amount, payment_frequency')
          .in('asset_id', assetIds)
          .eq('is_active', true)
      : Promise.resolve({ data: [] }),
    assetIds.length > 0
      ? supabase
          .from('distributions')
          .select('id, asset_id, total_amount, currency, status, royalty_period, created_at, is_royalty')
          .in('asset_id', assetIds)
          .order('created_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    // Check which issuer wallets are custodial
    (() => {
      const serviceClient = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const walletAddresses = (assets ?? []).map((a) => a.issuer_wallet)
      if (walletAddresses.length === 0) return Promise.resolve({ data: [] })
      return serviceClient
        .from('custodial_wallets')
        .select('address')
        .in('address', walletAddresses)
        .eq('is_primary', true)
    })(),
  ])

  // Group holders by asset
  const holdersMap: Record<string, { wallet_address: string; token_balance: number; ownership_percent: number }[]> = {}
  for (const h of (holdersResult.data ?? []) as { asset_id: string; wallet_address: string; token_balance: number; ownership_percent: number }[]) {
    if (!holdersMap[h.asset_id]) holdersMap[h.asset_id] = []
    holdersMap[h.asset_id].push(h)
  }

  // Custodial address set
  const custodialMap: Record<string, boolean> = {}
  for (const w of (custodialResult.data ?? []) as { address: string }[]) {
    custodialMap[w.address] = true
  }

  const recentDistributions = (distributionsResult.data ?? []) as {
    id: string; asset_id: string; total_amount: number; currency: string;
    status: string; royalty_period: string | null; created_at: string; is_royalty: boolean
  }[]

  const assetMap = new Map((assets ?? []).map((a) => [a.id, a]))

  // Summary stats
  const totalDistributed = recentDistributions
    .filter((d) => d.status === 'completed')
    .reduce((sum, d) => sum + Number(d.total_amount), 0)
  const totalHolders = new Set(Object.values(holdersMap).flat().map((h) => h.wallet_address)).size

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Distributions</h1>
        <p className="text-muted-foreground">
          Issue royalty payments to your token holders
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Distributed</p>
                <p className="text-2xl font-bold tabular-nums">${totalDistributed.toLocaleString()}</p>
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
                <p className="text-2xl font-bold tabular-nums">{totalHolders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Coins className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Distributions</p>
                <p className="text-2xl font-bold tabular-nums">
                  {recentDistributions.filter((d) => d.status === 'completed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Issue royalties form */}
      <IssueRoyalties
        assets={(assets ?? []).map((a) => ({
          ...a,
          owner_retained_percent: Number(a.owner_retained_percent ?? 0),
          last_distribution_at: (a as Record<string, unknown>).last_distribution_at as string | null ?? null,
          royalty_frequency: (a as Record<string, unknown>).royalty_frequency as string | null ?? null,
        }))}
        holders={holdersMap}
        contracts={(contractsResult.data ?? []) as { asset_id: string; tenant_name: string | null; annual_amount: number | null; payment_frequency: string | null }[]}
        isCustodial={custodialMap}
      />

      {/* Distribution history */}
      {recentDistributions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Distribution History
            </CardTitle>
            <CardDescription>Past royalty payments for your assets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Asset</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Period</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Amount</th>
                    <th className="text-center px-4 py-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentDistributions.map((d) => {
                    const asset = assetMap.get(d.asset_id)
                    return (
                      <tr key={d.id} className="hover:bg-muted/10">
                        <td className="px-4 py-2.5 font-medium">
                          {asset?.asset_name ?? 'Unknown'}
                          <span className="ml-1 text-muted-foreground">({asset?.token_symbol ?? '?'})</span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {d.royalty_period ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums font-medium">
                          ${Number(d.total_amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge className={`text-[10px] ${
                            d.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                            d.status === 'processing' ? 'bg-blue-500/10 text-blue-500' :
                            d.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                            'bg-amber-500/10 text-amber-500'
                          }`}>
                            {d.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {new Date(d.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
