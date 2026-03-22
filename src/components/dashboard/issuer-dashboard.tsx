'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, Users, Coins, TrendingUp, ArrowUpRight, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DistributionCalculator } from '@/components/dashboard/distribution-calculator'
import { NavUpdateForm } from '@/components/dashboard/nav-update-form'
import { AnnouncementsFeed } from '@/components/dashboard/announcements-feed'
import { ContractUpload } from '@/components/dashboard/contract-upload'
import type { AssetRow } from '@/types/database'

interface ContractTerms {
  id: string
  file_name: string
  parsed_at: string
  tenant_name: string | null
  annual_amount: number | null
  payment_frequency: string | null
  payment_due_day: number | null
  lease_start_date: string | null
  lease_end_date: string | null
  escalation_rate: number | null
  escalation_type: string | null
  currency: string | null
  summary: string | null
}

interface Holder {
  address: string
  balance: number
  percent: number
  limit: number
}

interface Payment {
  hash: string
  destination: string
  amount: string
  date: string | null
}

interface IssuerStats {
  network: string
  tokenSymbol: string
  totalSupply: number
  circulating: number
  reservedByIssuer: number
  holderCount: number
  holders: Holder[]
  recentPayments: Payment[]
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function truncAddr(addr: string) {
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

export function IssuerDashboard({
  asset: initialAsset,
  issuerAddress,
  announcements = [],
  existingContract = null,
}: {
  asset: AssetRow
  issuerAddress: string
  announcements?: { id: string; title: string; body: string; category: string; pinned: boolean; created_at: string }[]
  existingContract?: ContractTerms | null
}) {
  const [asset, setAsset] = useState(initialAsset)
  const [stats, setStats] = useState<IssuerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contract, setContract] = useState<ContractTerms | null>(existingContract)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/issuer-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issuerAddress,
          tokenSymbol: asset.token_symbol,
          tokenSupply: asset.token_supply,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load issuer stats')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [issuerAddress, asset.id])

  const explorerBase = stats?.network === 'testnet'
    ? 'https://testnet.xrpl.org'
    : 'https://xrpl.org'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-2xl font-bold tracking-tight">Issuer Dashboard</h1>
            {stats?.network && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                stats.network === 'testnet'
                  ? 'bg-status-warning text-warning'
                  : 'bg-status-success text-success'
              }`}>
                {stats.network}
              </span>
            )}
          </div>
          <p className="text-muted-foreground">
            {asset.asset_name} &middot; <span className="font-mono">{asset.token_symbol}</span>
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="gap-1.5 text-muted-foreground">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4 h-24 animate-pulse bg-muted/40" />
          ))}
        </div>
      )}

      {stats && (
        <>
          {/* Stats row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Supply"
              value={fmt(stats.totalSupply)}
              sub={`${asset.token_symbol} tokens`}
            />
            <StatCard
              label="Circulating"
              value={fmt(stats.circulating)}
              sub={`${stats.totalSupply > 0 ? ((stats.circulating / stats.totalSupply) * 100).toFixed(1) : 0}% of supply`}
            />
            <StatCard
              label="Reserved by Issuer"
              value={fmt(stats.reservedByIssuer)}
              sub={`${stats.totalSupply > 0 ? ((stats.reservedByIssuer / stats.totalSupply) * 100).toFixed(1) : 0}% unissued`}
            />
            <StatCard
              label="Token Holders"
              value={stats.holderCount.toString()}
              sub="unique addresses"
            />
          </div>

          {/* Holder distribution */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Token Distribution</h2>
              <span className="ml-auto text-xs text-muted-foreground">{stats.holders.length} shown</span>
            </div>

            {stats.holders.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No external holders found
              </div>
            ) : (
              <div className="divide-y divide-border">
                {stats.holders.map((holder, i) => (
                  <div key={holder.address} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-5 text-xs text-muted-foreground text-right shrink-0">{i + 1}</span>

                    <div className="flex-1 min-w-0">
                      <a
                        href={`${explorerBase}/accounts/${holder.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs hover:underline flex items-center gap-1"
                      >
                        {truncAddr(holder.address)}
                        <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                      </a>
                    </div>

                    {/* Distribution bar */}
                    <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(holder.percent, 100)}%` }}
                      />
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">{fmt(holder.balance)}</p>
                      <p className="text-xs text-muted-foreground">{holder.percent.toFixed(2)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent payments sent */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Recent Payments Sent</h2>
            </div>

            {stats.recentPayments.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No outgoing payments found
              </div>
            ) : (
              <div className="divide-y divide-border">
                {stats.recentPayments.map((payment) => (
                  <div key={payment.hash} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Coins className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <a
                          href={`${explorerBase}/transactions/${payment.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs hover:underline flex items-center gap-1"
                        >
                          {truncAddr(payment.hash)}
                          <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                        </a>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 ml-5">
                        To: <span className="font-mono">{truncAddr(payment.destination)}</span>
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">{payment.amount}</p>
                      {payment.date && (
                        <p className="text-xs text-muted-foreground">
                          {new Date(payment.date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lease contract + AI parser */}
          <ContractUpload
            assetId={asset.id}
            assetName={asset.asset_name}
            existingContract={contract}
            onContractParsed={(c) => setContract(c)}
          />

          {/* Issuer tools */}
          <NavUpdateForm
            asset={asset}
            onUpdated={(newVal, newNav) =>
              setAsset((a) => ({ ...a, current_valuation: newVal, nav_per_token: newNav }))
            }
          />

          <DistributionCalculator
            asset={asset}
            holders={stats.holders}
            issuerAddress={issuerAddress}
            contract={contract}
            onYieldUpdated={(newYield) =>
              setAsset((a) => ({ ...a, annual_yield: newYield }))
            }
          />

          {/* Announcements */}
          <AnnouncementsFeed
            announcements={announcements}
            isIssuer
            assetId={asset.id}
          />

          {/* Asset info footer */}
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Valuation: <strong className="text-foreground">${Number(asset.current_valuation).toLocaleString()}</strong></span>
            </div>
            <div>NAV/token: <strong className="text-foreground">${Number(asset.nav_per_token).toFixed(4)}</strong></div>
            <div>Annual yield: <strong className="text-foreground">{asset.annual_yield}%</strong></div>
            <div className="ml-auto">
              Issuer:{' '}
              <a
                href={`${explorerBase}/accounts/${issuerAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono hover:underline"
              >
                {truncAddr(issuerAddress)}
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
