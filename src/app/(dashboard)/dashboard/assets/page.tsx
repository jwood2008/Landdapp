import { createClient } from '@/lib/supabase/server'
import { AssetCard } from '@/components/assets/asset-card'
import type { AssetRow } from '@/types/database'

export default async function AssetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: assetsRaw } = await supabase
    .from('assets')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const assets = assetsRaw as AssetRow[] | null

  const { data: walletsRaw } = await supabase
    .from('wallets')
    .select('address')
    .eq('user_id', user!.id)

  const walletAddresses = (walletsRaw as { address: string }[] | null)?.map(w => w.address) ?? []

  type HoldingSlim = { asset_id: string; token_balance: number; ownership_percent: number }
  let holdings: HoldingSlim[] = []

  if (walletAddresses.length) {
    const { data } = await supabase
      .from('investor_holdings')
      .select('asset_id, token_balance, ownership_percent')
      .in('wallet_address', walletAddresses)
    holdings = (data as HoldingSlim[] | null) ?? []
  }

  const holdingsByAsset = Object.fromEntries(holdings.map(h => [h.asset_id, h]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assets</h1>
        <p className="text-muted-foreground">All available tokenized assets on the platform</p>
      </div>

      {!assets || assets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No assets available yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              holding={holdingsByAsset[asset.id] ?? null}
            />
          ))}
        </div>
      )}
    </div>
  )
}
