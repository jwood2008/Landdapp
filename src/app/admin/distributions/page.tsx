import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { buttonVariants } from '@/lib/button-variants'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { AutoDistributionPanel } from '@/components/admin/auto-distribution-panel'

export default async function DistributionsPage() {
  const supabase = await createClient()

  // Fetch active assets
  const { data: assets } = await supabase
    .from('assets')
    .select('id, asset_name, token_symbol, issuer_wallet, current_valuation, last_distribution_at')
    .eq('is_active', true)
    .order('asset_name')

  // Fetch active contracts
  const { data: contracts } = await supabase
    .from('asset_contracts')
    .select('id, asset_id, file_name, tenant_name, annual_amount, payment_frequency, escalation_rate, lease_start_date, lease_end_date, currency, summary')
    .eq('is_active', true)

  // Fetch custodial wallet addresses to check which issuer wallets are custodial
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: custodialWallets } = await serviceClient
    .from('custodial_wallets')
    .select('address')
    .eq('is_primary', true)

  const custodialAddresses = (custodialWallets ?? []).map((w: { address: string }) => w.address)

  // Fetch recent distributions
  const { data: recentDistributions } = await supabase
    .from('distributions')
    .select('id, asset_id, total_amount, currency, status, is_royalty, royalty_period, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  const assetMap = new Map((assets ?? []).map((a) => [a.id, a]))

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Distributions</h1>
          <p className="text-base text-muted-foreground">
            Manage royalty payouts — automatically from contract terms or manually
          </p>
        </div>
        <Link
          href="/admin/distributions/new"
          className={cn(buttonVariants({ size: 'sm' }), 'gap-2')}
        >
          <Plus className="h-4 w-4" />
          Manual Distribution
        </Link>
      </div>

      <AutoDistributionPanel
        assets={(assets ?? []).map((a) => ({
          ...a,
          last_distribution_at: (a as Record<string, unknown>).last_distribution_at as string | null ?? null,
        }))}
        contracts={(contracts ?? []).map((c) => c as {
          id: string; asset_id: string; file_name: string;
          tenant_name: string | null; annual_amount: number | null;
          payment_frequency: string | null; escalation_rate: number | null;
          lease_start_date: string | null; lease_end_date: string | null;
          currency: string; summary: string | null;
        })}
        custodialAddresses={custodialAddresses}
      />

      {/* Recent distributions */}
      {recentDistributions && recentDistributions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold">Recent Distributions</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Asset</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Period</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Amount</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentDistributions.map((d) => {
                  const asset = assetMap.get(d.asset_id)
                  return (
                    <tr key={d.id} className="hover:bg-muted/10">
                      <td className="px-4 py-3 font-medium">
                        {asset?.asset_name ?? 'Unknown'}
                        <span className="ml-1 text-muted-foreground">({asset?.token_symbol ?? '?'})</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {d.royalty_period ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">
                        ${Number(d.total_amount).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          d.status === 'completed' ? 'bg-status-success text-success' :
                          d.status === 'processing' ? 'bg-status-info text-info' :
                          d.status === 'failed' ? 'bg-status-danger text-destructive' :
                          'bg-status-warning text-warning'
                        }`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(d.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
