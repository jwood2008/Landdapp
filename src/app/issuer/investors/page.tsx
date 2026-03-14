import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Wallet, Mail } from 'lucide-react'

export default async function IssuerInvestorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get issuer's assets
  const { data: assets } = await supabase
    .from('assets')
    .select('id, asset_name, token_symbol')
    .eq('owner_id', user.id)
    .eq('is_active', true)

  const assetIds = (assets ?? []).map((a) => a.id)

  if (assetIds.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Investors</h1>
          <p className="text-muted-foreground">No assets found — investors will appear once your token is created.</p>
        </div>
      </div>
    )
  }

  // Get all holders for issuer's assets with their platform investor info
  const { data: holdings } = await supabase
    .from('investor_holdings')
    .select('wallet_address, asset_id, token_balance, ownership_percent, last_synced_at')
    .in('asset_id', assetIds)
    .gt('token_balance', 0)
    .order('token_balance', { ascending: false })

  // Get platform investor details for these wallets
  const walletAddresses = [...new Set((holdings ?? []).map((h) => h.wallet_address))]

  const { data: platformInvestors } = walletAddresses.length > 0
    ? await supabase
        .from('platform_investors')
        .select('wallet_address, full_name, email, kyc_status')
        .in('wallet_address', walletAddresses)
    : { data: [] }

  const investorMap = new Map(
    (platformInvestors ?? []).map((inv) => [inv.wallet_address, inv])
  )

  // Build a table grouped by asset
  const assetMap = new Map((assets ?? []).map((a) => [a.id, a]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Investors</h1>
        <p className="text-muted-foreground">
          Wallets holding your tokens — {walletAddresses.length} unique investor{walletAddresses.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10">
                <Users className="h-5 w-5 text-teal-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Unique Investors</p>
                <p className="text-2xl font-bold tabular-nums">{walletAddresses.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
                <Wallet className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">KYC Verified</p>
                <p className="text-2xl font-bold tabular-nums">
                  {walletAddresses.filter((w) => investorMap.get(w)?.kyc_status === 'verified').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">With Email</p>
                <p className="text-2xl font-bold tabular-nums">
                  {walletAddresses.filter((w) => investorMap.get(w)?.email).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Investor table per asset */}
      {(assets ?? []).map((asset) => {
        const assetHoldings = (holdings ?? []).filter((h) => h.asset_id === asset.id)
        if (assetHoldings.length === 0) return null

        return (
          <Card key={asset.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Badge variant="outline">{asset.token_symbol}</Badge>
                {asset.asset_name}
              </CardTitle>
              <CardDescription>{assetHoldings.length} holder{assetHoldings.length !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Wallet</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Name</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Email</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Balance</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Ownership</th>
                      <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">KYC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {assetHoldings.map((h) => {
                      const inv = investorMap.get(h.wallet_address)
                      return (
                        <tr key={h.wallet_address} className="hover:bg-muted/10">
                          <td className="px-4 py-3 font-mono text-xs">
                            {h.wallet_address.slice(0, 8)}...{h.wallet_address.slice(-6)}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {inv?.full_name ?? <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {inv?.email ?? <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs font-medium tabular-nums">
                            {Number(h.token_balance).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-muted-foreground tabular-nums">
                            {Number(h.ownership_percent).toFixed(2)}%
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge className={`text-[10px] ${
                              inv?.kyc_status === 'verified' ? 'bg-green-500/10 text-green-500' :
                              inv?.kyc_status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {inv?.kyc_status ?? 'Unknown'}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
