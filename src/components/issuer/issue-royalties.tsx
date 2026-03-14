'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Coins, Loader2, CheckCircle, XCircle, Users,
  DollarSign, ArrowRight, Wallet, AlertTriangle,
} from 'lucide-react'

interface Asset {
  id: string
  asset_name: string
  token_symbol: string
  issuer_wallet: string
  current_valuation: number
  owner_retained_percent: number
  last_distribution_at: string | null
  royalty_frequency: string | null
}

interface Holder {
  wallet_address: string
  token_balance: number
  ownership_percent: number
}

interface Contract {
  asset_id: string
  tenant_name: string | null
  annual_amount: number | null
  payment_frequency: string | null
}

interface PaymentResult {
  paymentId: string
  walletAddress: string
  amount: number
  ownershipPercent: number
  status: string
  txHash?: string
  error?: string
}

interface Props {
  assets: Asset[]
  holders: Record<string, Holder[]>
  contracts: Contract[]
  isCustodial: Record<string, boolean>
}

function formatUSD(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v)
}

function truncAddr(a: string) {
  return `${a.slice(0, 8)}...${a.slice(-6)}`
}

export function IssueRoyalties({ assets, holders, contracts, isCustodial }: Props) {
  const [selectedAssetId, setSelectedAssetId] = useState(assets[0]?.id ?? '')
  const [totalAmount, setTotalAmount] = useState('')
  const [period, setPeriod] = useState(() => {
    const now = new Date()
    const q = `Q${Math.ceil((now.getMonth() + 1) / 3)}`
    return `${q} ${now.getFullYear()}`
  })
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{
    totalPayout: number
    ownerRetainedPercent: number
    ownerRetainedAmount: number
    reserveAmount: number
    distributableAmount: number
    unsoldRetained: number
    circulatingPercent: number
    holdersCount: number
    currency: string
    royaltyPeriod: string
    results: PaymentResult[]
    status: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedAsset = assets.find((a) => a.id === selectedAssetId)
  const assetHolders = holders[selectedAssetId] ?? []
  const contract = contracts.find((c) => c.asset_id === selectedAssetId)
  const custodial = selectedAsset ? isCustodial[selectedAsset.issuer_wallet] ?? false : false

  const amount = parseFloat(totalAmount || '0')
  const ownerRetainedPct = selectedAsset?.owner_retained_percent ?? 0
  const ownerRetained = amount * (ownerRetainedPct / 100)
  const investorPayout = amount - ownerRetained
  const reserve = investorPayout * 0.10
  const distributable = investorPayout - reserve

  // Calculate circulating ownership (sum of all holder percentages)
  const circulatingPercent = assetHolders.reduce((sum, h) => sum + h.ownership_percent, 0)
  const unsoldPercent = 100 - circulatingPercent

  // Preview per-holder amounts
  const previewPayments = assetHolders.map((h) => ({
    wallet: h.wallet_address,
    percent: h.ownership_percent,
    tokens: h.token_balance,
    payout: distributable * (h.ownership_percent / 100),
  }))

  // Amount retained by issuer for unsold tokens
  const actualDistributed = previewPayments.reduce((sum, p) => sum + p.payout, 0)
  const unsoldRetained = distributable - actualDistributed

  async function handleDistribute() {
    if (!selectedAssetId || amount <= 0) return
    setRunning(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/issuer/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: selectedAssetId,
          totalAmount: amount,
          period: period || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Distribution failed')

      setResult({
        totalPayout: data.totalPayout,
        ownerRetainedPercent: data.ownerRetainedPercent,
        ownerRetainedAmount: data.ownerRetainedAmount,
        reserveAmount: data.reserveAmount,
        distributableAmount: data.distributableAmount,
        unsoldRetained: data.unsoldRetained ?? 0,
        circulatingPercent: data.circulatingPercent ?? 100,
        holdersCount: data.holdersCount,
        currency: data.currency,
        royaltyPeriod: data.royaltyPeriod,
        results: data.results,
        status: data.distribution.status,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Distribution failed')
    } finally {
      setRunning(false)
    }
  }

  if (assets.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Coins className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No assets found.</p>
          <p className="text-sm text-muted-foreground mt-1">Distributions will be available once your token is created.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Distribution form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-4 w-4" />
            Issue Royalties
          </CardTitle>
          <CardDescription>
            Enter the total income you&apos;ve collected and the platform will calculate each holder&apos;s
            share and send payments automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Asset selector */}
          {assets.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Asset</label>
              <select
                value={selectedAssetId}
                onChange={(e) => {
                  setSelectedAssetId(e.target.value)
                  setResult(null)
                  setError(null)
                }}
                className="input w-full text-sm"
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.asset_name} ({a.token_symbol})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Single asset display */}
          {assets.length === 1 && selectedAsset && (
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Coins className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">{selectedAsset.asset_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[10px]">{selectedAsset.token_symbol}</Badge>
                  <span className="text-xs text-muted-foreground">{assetHolders.length} holder{assetHolders.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          )}

          {/* Custodial wallet check */}
          {selectedAsset && !custodial && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <XCircle className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium">Issuer wallet is not platform-managed</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Auto-distribution requires a custodial issuer wallet. Contact the platform admin.
              </p>
            </div>
          )}

          {/* No holders check */}
          {selectedAsset && custodial && assetHolders.length === 0 && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="text-sm font-medium">No token holders</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                There are no investors holding {selectedAsset.token_symbol} tokens yet.
              </p>
            </div>
          )}

          {selectedAsset && custodial && assetHolders.length > 0 && (
            <>
              {/* Amount input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Total Amount Collected (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => { setTotalAmount(e.target.value); setResult(null) }}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="input w-full pl-7 font-mono text-lg"
                  />
                </div>
                {contract?.annual_amount && (
                  <p className="text-[10px] text-muted-foreground">
                    Contract: {formatUSD(contract.annual_amount)}/yr
                    {contract.payment_frequency === 'quarterly' ? ` → ~${formatUSD(contract.annual_amount / 4)}/quarter` : ''}
                    {contract.payment_frequency === 'monthly' ? ` → ~${formatUSD(contract.annual_amount / 12)}/month` : ''}
                  </p>
                )}
              </div>

              {/* Period label */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Period Label</label>
                <input
                  type="text"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="Q1 2026"
                  className="input w-full text-sm"
                />
              </div>

              {/* Breakdown preview */}
              {amount > 0 && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Distribution Preview</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Total Income</p>
                      <p className="font-bold tabular-nums">{formatUSD(amount)}</p>
                    </div>
                    {ownerRetainedPct > 0 && (
                      <div>
                        <p className="text-[11px] text-muted-foreground">Owner Retained ({ownerRetainedPct}%)</p>
                        <p className="font-bold tabular-nums">{formatUSD(ownerRetained)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[11px] text-muted-foreground">Platform Reserve (10%)</p>
                      <p className="font-bold tabular-nums">{formatUSD(reserve)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Paid to Holders ({circulatingPercent.toFixed(0)}% sold)</p>
                      <p className="font-bold tabular-nums text-primary">{formatUSD(actualDistributed)}</p>
                    </div>
                    {unsoldPercent > 0 && (
                      <div>
                        <p className="text-[11px] text-muted-foreground">Unsold Tokens ({unsoldPercent.toFixed(0)}%) → Issuer</p>
                        <p className="font-bold tabular-nums">{formatUSD(unsoldRetained)}</p>
                      </div>
                    )}
                  </div>

                  {/* Per-holder preview */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {assetHolders.length} Holder{assetHolders.length !== 1 ? 's' : ''}
                    </p>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/30">
                            <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Wallet</th>
                            <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Tokens</th>
                            <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Ownership</th>
                            <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Payout</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {previewPayments.map((p) => (
                            <tr key={p.wallet} className="hover:bg-muted/10">
                              <td className="px-3 py-2 font-mono">{truncAddr(p.wallet)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{p.tokens.toLocaleString()}</td>
                              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{p.percent.toFixed(2)}%</td>
                              <td className="px-3 py-2 text-right font-medium tabular-nums">{formatUSD(p.payout)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <XCircle className="h-3.5 w-3.5 shrink-0" />
                  {error}
                </div>
              )}

              {/* Execute button */}
              <Button
                onClick={handleDistribute}
                disabled={running || amount <= 0}
                className="w-full gap-2"
              >
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Distributing to {assetHolders.length} holder{assetHolders.length !== 1 ? 's' : ''}...
                  </>
                ) : (
                  <>
                    <Coins className="h-4 w-4" />
                    Issue Royalties
                    {amount > 0 && <span className="ml-1">({formatUSD(actualDistributed)} to holders)</span>}
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card className={result.status === 'completed' ? 'border-green-500/30' : 'border-red-500/30'}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {result.status === 'completed' ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Distribution {result.status === 'completed' ? 'Complete' : 'Partially Failed'}
            </CardTitle>
            <CardDescription>{result.royaltyPeriod}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-border p-3 text-center">
                <DollarSign className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-lg font-bold tabular-nums">{formatUSD(result.totalPayout)}</p>
                <p className="text-[10px] text-muted-foreground">Total Income</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <Wallet className="h-4 w-4 mx-auto text-primary mb-1" />
                <p className="text-lg font-bold tabular-nums text-primary">{formatUSD(result.distributableAmount)}</p>
                <p className="text-[10px] text-muted-foreground">Paid to {result.holdersCount} Holder{result.holdersCount !== 1 ? 's' : ''}</p>
              </div>
              {result.unsoldRetained > 0 && (
                <div className="rounded-lg border border-border p-3 text-center">
                  <ArrowRight className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                  <p className="text-lg font-bold tabular-nums">{formatUSD(result.unsoldRetained)}</p>
                  <p className="text-[10px] text-muted-foreground">Unsold Tokens → Issuer</p>
                </div>
              )}
            </div>

            {/* Per-holder results */}
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Wallet</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Ownership</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Amount</th>
                    <th className="text-center px-3 py-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">TX</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.results.map((r) => (
                    <tr key={r.paymentId} className="hover:bg-muted/10">
                      <td className="px-3 py-2 font-mono">{truncAddr(r.walletAddress)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.ownershipPercent.toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{formatUSD(r.amount)}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge className={`text-[10px] ${
                          r.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                          r.status === 'skipped' ? 'bg-muted text-muted-foreground' :
                          'bg-red-500/10 text-red-500'
                        }`}>
                          {r.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground truncate max-w-[140px]">
                        {r.txHash ? `${r.txHash.slice(0, 12)}...` : r.error ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
