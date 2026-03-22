'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Building2,
  MapPin,
  FileText,
  Coins,
  DollarSign,
  Users,
  BarChart3,
  Layers,
  Info,
  TrendingUp,
  Clock,
  Wallet,
  PieChart,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Asset {
  id: string
  asset_name: string
  asset_type: string
  token_symbol: string
  token_supply: number
  current_valuation: number
  nav_per_token: number
  location: string | null
  total_acres: number | null
  ai_rating: number | null
  royalty_frequency: string | null
  annual_yield: number | null
  owner_retained_percent: number
  issuer_wallet: string
  llc_name: string
  description: string | null
  land_type: string | null
  county: string | null
  state: string | null
  parcel_id: string | null
  zoning: string | null
  purchase_price: number | null
  purchase_date: string | null
  created_at: string
}

interface Holder {
  asset_id: string
  wallet_address: string
  token_balance: number
  ownership_percent: number
}

interface Update {
  id: string
  asset_id: string
  quarter: string
  published: boolean
  created_at: string
}

interface Distribution {
  id: string
  asset_id: string
  total_amount: number
  status: string
  currency: string
  created_at: string
}

interface Props {
  assets: Asset[]
  holders: Holder[]
  updates: Update[]
  distributions: Distribution[]
}

function truncAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function IssuerAssetCards({ assets, holders, updates, distributions }: Props) {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [availableTokensMap, setAvailableTokensMap] = useState<Record<string, number>>({})

  useEffect(() => {
    async function fetchAvailableTokens() {
      const supabase = createClient()
      const { data } = await supabase.rpc('get_available_tokens')
      if (data) {
        const map: Record<string, number> = {}
        for (const row of data) {
          map[row.asset_id] = Number(row.available_tokens)
        }
        setAvailableTokensMap(map)
      }
    }
    fetchAvailableTokens()
  }, [])

  // Derived data for selected asset
  const selectedHolders = selectedAsset
    ? holders
        .filter((h) => h.asset_id === selectedAsset.id)
        .sort((a, b) => b.token_balance - a.token_balance)
    : []
  const selectedDistributions = selectedAsset
    ? distributions.filter((d) => d.asset_id === selectedAsset.id)
    : []
  const completedDistributions = selectedDistributions.filter((d) => d.status === 'completed')
  const totalRoyaltiesPaid = completedDistributions.reduce((sum, d) => sum + d.total_amount, 0)
  const lastDistribution = completedDistributions[0]

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {assets.map((asset) => {
          const assetHolders = new Set(
            holders.filter((h) => h.asset_id === asset.id).map((h) => h.wallet_address)
          ).size
          const assetUpdates = updates.filter((u) => u.asset_id === asset.id)
          const latestUpdate = assetUpdates[0]

          return (
            <Card
              key={asset.id}
              className="card-hover cursor-pointer group"
              onClick={() => setSelectedAsset(asset)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{asset.asset_name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="rounded-full">
                        {asset.token_symbol}
                      </Badge>
                      {asset.location && (
                        <span className="flex items-center gap-1 text-xs">
                          <MapPin className="h-3 w-3" />
                          {asset.location}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {asset.ai_rating && (
                      <Badge
                        className={`text-xs rounded-full ${
                          asset.ai_rating >= 7
                            ? 'bg-status-success text-success'
                            : asset.ai_rating >= 4
                              ? 'bg-status-warning text-warning'
                              : 'bg-status-danger text-destructive'
                        }`}
                      >
                        AI: {asset.ai_rating}/10
                      </Badge>
                    )}
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground group-hover:bg-muted/50 group-hover:text-foreground transition-colors">
                      <Info className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Valuation</p>
                    <p className="font-bold tabular-nums">
                      ${Number(asset.current_valuation).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">NAV / Token</p>
                    <p className="font-bold font-mono tabular-nums">
                      ${asset.nav_per_token.toFixed(4)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Token Holders</p>
                    <p className="font-bold tabular-nums">{assetHolders}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Supply</p>
                    <p className="font-bold tabular-nums">
                      {Number(asset.token_supply).toLocaleString()}
                    </p>
                  </div>
                  {asset.total_acres && (
                    <div>
                      <p className="text-xs text-muted-foreground">Acreage</p>
                      <p className="font-bold">{asset.total_acres} acres</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Royalty Frequency</p>
                    <p className="font-bold capitalize">
                      {asset.royalty_frequency?.replace('_', ' ') ?? 'Quarterly'}
                    </p>
                  </div>
                </div>

                {/* Latest update status */}
                <div className="rounded-lg border border-border px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    {latestUpdate ? (
                      <span className="text-xs">
                        Last update: <strong>{latestUpdate.quarter}</strong>
                        {!latestUpdate.published && (
                          <Badge variant="outline" className="ml-1.5 text-xs rounded-full">
                            Draft
                          </Badge>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        No quarterly updates yet
                      </span>
                    )}
                  </div>
                  <Link
                    href="/issuer/updates"
                    className="text-xs text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Post Update
                  </Link>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Asset Detail Sheet */}
      <Sheet open={!!selectedAsset} onOpenChange={(open) => !open && setSelectedAsset(null)}>
        <SheetContent side="right" className="overflow-y-auto">
          {selectedAsset && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedAsset.asset_name}</SheetTitle>
                <SheetDescription className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="rounded-full">
                    {selectedAsset.token_symbol}
                  </Badge>
                  {selectedAsset.location && (
                    <span className="flex items-center gap-1 text-xs">
                      <MapPin className="h-3 w-3" />
                      {selectedAsset.location}
                    </span>
                  )}
                  {selectedAsset.ai_rating && (
                    <Badge
                      className={`text-xs rounded-full ${
                        selectedAsset.ai_rating >= 7
                          ? 'bg-status-success text-success'
                          : selectedAsset.ai_rating >= 4
                            ? 'bg-status-warning text-warning'
                            : 'bg-status-danger text-destructive'
                      }`}
                    >
                      AI: {selectedAsset.ai_rating}/10
                    </Badge>
                  )}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-2">
                {/* Quick Stats Row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border bg-card p-3 text-center">
                    <Users className="h-4 w-4 text-teal-500 mx-auto mb-1" />
                    <p className="text-lg font-bold tabular-nums">{selectedHolders.length}</p>
                    <p className="text-[10px] text-muted-foreground">Investors</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3 text-center">
                    <DollarSign className="h-4 w-4 text-success mx-auto mb-1" />
                    <p className="text-lg font-bold tabular-nums">
                      ${totalRoyaltiesPaid.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Royalties Paid</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3 text-center">
                    <TrendingUp className="h-4 w-4 text-primary mx-auto mb-1" />
                    <p className="text-lg font-bold tabular-nums">
                      {completedDistributions.length}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Distributions</p>
                  </div>
                </div>

                {/* Token Supply Breakdown */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Coins className="h-4 w-4 text-primary" />
                    Token Supply
                  </h3>
                  <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Supply</span>
                      <span className="text-sm font-bold font-mono tabular-nums">
                        {Number(selectedAsset.token_supply).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Owner Retained</span>
                      <span className="text-sm font-bold font-mono tabular-nums">
                        {Math.floor(
                          (selectedAsset.owner_retained_percent / 100) *
                            selectedAsset.token_supply
                        ).toLocaleString()}{' '}
                        <span className="text-xs text-muted-foreground font-normal">
                          ({selectedAsset.owner_retained_percent}%)
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Held by Investors</span>
                      <span className="text-sm font-bold font-mono tabular-nums">
                        {selectedHolders
                          .reduce((sum, h) => sum + h.token_balance, 0)
                          .toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Available for Sale</span>
                      <span className="text-sm font-bold font-mono tabular-nums text-primary">
                        {(availableTokensMap[selectedAsset.id] ?? 0).toLocaleString()}
                      </span>
                    </div>
                    {/* Supply bar */}
                    <div className="space-y-1.5">
                      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden flex">
                        {(() => {
                          const total = selectedAsset.token_supply
                          const retained = Math.floor(
                            (selectedAsset.owner_retained_percent / 100) * total
                          )
                          const available = availableTokensMap[selectedAsset.id] ?? 0
                          const sold = total - retained - available
                          const retainedPct = (retained / total) * 100
                          const soldPct = (sold / total) * 100
                          const availPct = (available / total) * 100
                          return (
                            <>
                              <div
                                className="h-full bg-muted-foreground/40 transition-all"
                                style={{ width: `${retainedPct}%` }}
                                title={`Retained: ${retained.toLocaleString()}`}
                              />
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${soldPct}%` }}
                                title={`Held by investors: ${sold.toLocaleString()}`}
                              />
                              <div
                                className="h-full bg-primary/20 transition-all"
                                style={{ width: `${availPct}%` }}
                                title={`Available: ${available.toLocaleString()}`}
                              />
                            </>
                          )
                        })()}
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" />
                          Retained
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                          Investors
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full bg-primary/20" />
                          Available
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Investor Breakdown */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-primary" />
                    Investor Breakdown
                  </h3>
                  {selectedHolders.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-6 text-center">
                      <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No investors yet</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-card divide-y divide-border">
                      {selectedHolders.slice(0, 10).map((holder, i) => (
                        <div
                          key={holder.wallet_address}
                          className="flex items-center justify-between px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {i + 1}
                            </div>
                            <div>
                              <p className="text-xs font-mono text-foreground">
                                {truncAddr(holder.wallet_address)}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {holder.ownership_percent.toFixed(2)}% ownership
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold font-mono tabular-nums">
                              {holder.token_balance.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-muted-foreground">tokens</p>
                          </div>
                        </div>
                      ))}
                      {selectedHolders.length > 10 && (
                        <div className="px-4 py-2.5 text-center">
                          <p className="text-xs text-muted-foreground">
                            +{selectedHolders.length - 10} more investors
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Distribution History */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Distribution History
                  </h3>
                  {selectedDistributions.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-6 text-center">
                      <DollarSign className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No distributions yet</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-card divide-y divide-border">
                      {selectedDistributions.slice(0, 8).map((dist) => (
                        <div
                          key={dist.id}
                          className="flex items-center justify-between px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              ${Number(dist.total_amount).toLocaleString()}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(dist.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge
                            className={`text-xs rounded-full ${
                              dist.status === 'completed'
                                ? 'bg-status-success text-success'
                                : dist.status === 'failed'
                                  ? 'bg-status-danger text-destructive'
                                  : 'bg-status-warning text-warning'
                            }`}
                          >
                            {dist.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  {lastDistribution && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Last paid:{' '}
                      {new Date(lastDistribution.created_at).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>

                {/* Financials */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Financials
                  </h3>
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Current Valuation</span>
                      <span className="text-sm font-bold tabular-nums">
                        ${Number(selectedAsset.current_valuation).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">NAV / Token</span>
                      <span className="text-sm font-bold font-mono tabular-nums">
                        ${selectedAsset.nav_per_token.toFixed(4)}
                      </span>
                    </div>
                    {selectedAsset.annual_yield != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Annual Yield</span>
                        <span className="text-sm font-bold text-success tabular-nums">
                          {Number(selectedAsset.annual_yield).toFixed(2)}%
                        </span>
                      </div>
                    )}
                    {selectedAsset.purchase_price != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Purchase Price</span>
                        <span className="text-sm font-bold tabular-nums">
                          ${Number(selectedAsset.purchase_price).toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Royalty Frequency</span>
                      <span className="text-sm font-medium capitalize">
                        {selectedAsset.royalty_frequency?.replace('_', ' ') ?? 'Quarterly'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Property Details */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    Property Details
                  </h3>
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">LLC</span>
                      <span className="text-sm font-medium">{selectedAsset.llc_name}</span>
                    </div>
                    {selectedAsset.total_acres && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Acreage</span>
                        <span className="text-sm font-medium">
                          {selectedAsset.total_acres} acres
                        </span>
                      </div>
                    )}
                    {selectedAsset.land_type && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Land Type</span>
                        <span className="text-sm font-medium capitalize">
                          {selectedAsset.land_type}
                        </span>
                      </div>
                    )}
                    {selectedAsset.zoning && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Zoning</span>
                        <span className="text-sm font-medium">{selectedAsset.zoning}</span>
                      </div>
                    )}
                    {(selectedAsset.county || selectedAsset.state) && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Location</span>
                        <span className="text-sm font-medium">
                          {[selectedAsset.county, selectedAsset.state].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                    {selectedAsset.parcel_id && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Parcel ID</span>
                        <span className="text-sm font-mono font-medium">
                          {selectedAsset.parcel_id}
                        </span>
                      </div>
                    )}
                    {selectedAsset.purchase_date && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Purchase Date</span>
                        <span className="text-sm font-medium">
                          {new Date(selectedAsset.purchase_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* On-Chain */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    On-Chain
                  </h3>
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div>
                      <span className="text-xs text-muted-foreground">Issuer Wallet</span>
                      <p className="text-xs font-mono text-foreground mt-0.5 break-all">
                        {selectedAsset.issuer_wallet}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Token Created</span>
                      <span className="text-sm font-medium">
                        {new Date(selectedAsset.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedAsset.description && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">Description</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {selectedAsset.description}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
