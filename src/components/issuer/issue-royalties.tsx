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

  // Full-page result screen after distribution
  if (result) {
    const succeeded = result.results.filter((r) => r.status === 'completed')
    const failed = result.results.filter((r) => r.status !== 'completed' && r.status !== 'skipped')
    const skipped = result.results.filter((r) => r.status === 'skipped')
    const allSucceeded = failed.length === 0
    const asset = assets.find((a) => a.id === selectedAssetId)

    return (
      <div className="max-w-2xl mx-auto space-y-8 py-4">
        {/* Status hero */}
        <div className="text-center space-y-4">
          <div className={`inline-flex h-20 w-20 items-center justify-center rounded-full ${
            allSucceeded ? 'bg-success/10' : 'bg-destructive/10'
          }`}>
            {allSucceeded ? (
              <CheckCircle className="h-10 w-10 text-success" />
            ) : (
              <XCircle className="h-10 w-10 text-destructive" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {allSucceeded ? 'Distribution Complete' : 'Distribution Partially Failed'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {allSucceeded
                ? `Successfully distributed royalties for ${result.royaltyPeriod}`
                : `${succeeded.length} of ${result.results.length} payments completed`
              }
            </p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border p-4 text-center">
            <DollarSign className="h-4 w-4 mx-auto text-muted-foreground mb-2" />
            <p className="text-xl font-bold tabular-nums">{formatUSD(result.totalPayout)}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Income</p>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
            <Wallet className="h-4 w-4 mx-auto text-primary mb-2" />
            <p className="text-xl font-bold tabular-nums text-primary">{formatUSD(result.distributableAmount)}</p>
            <p className="text-xs text-muted-foreground mt-1">Paid to Holders</p>
          </div>
          <div className="rounded-xl border border-border p-4 text-center">
            <Users className="h-4 w-4 mx-auto text-muted-foreground mb-2" />
            <p className="text-xl font-bold tabular-nums">{result.holdersCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Holders Paid</p>
          </div>
          <div className="rounded-xl border border-border p-4 text-center">
            <Coins className="h-4 w-4 mx-auto text-muted-foreground mb-2" />
            <p className="text-xl font-bold tabular-nums">{asset?.token_symbol ?? '—'}</p>
            <p className="text-xs text-muted-foreground mt-1">{result.royaltyPeriod}</p>
          </div>
        </div>

        {/* Breakdown */}
        {(result.ownerRetainedAmount > 0 || result.reserveAmount > 0 || result.unsoldRetained > 0) && (
          <Card>
            <CardContent className="py-4">
              <div className="grid grid-cols-3 gap-4 text-sm text-center">
                {result.ownerRetainedAmount > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Owner Retained ({result.ownerRetainedPercent}%)</p>
                    <p className="font-bold tabular-nums mt-0.5">{formatUSD(result.ownerRetainedAmount)}</p>
                  </div>
                )}
                {result.reserveAmount > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Platform Reserve</p>
                    <p className="font-bold tabular-nums mt-0.5">{formatUSD(result.reserveAmount)}</p>
                  </div>
                )}
                {result.unsoldRetained > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Unsold → Issuer</p>
                    <p className="font-bold tabular-nums mt-0.5">{formatUSD(result.unsoldRetained)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Per-holder results */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Wallet</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Ownership</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Amount</th>
                    <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">TX Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.results.map((r) => (
                    <tr key={r.paymentId}>
                      <td className="px-4 py-3 font-mono text-xs">{truncAddr(r.walletAddress)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.ownershipPercent.toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{formatUSD(r.amount)}</td>
                      <td className="px-4 py-3 text-center">
                        {r.status === 'completed' ? (
                          <Badge className="bg-success/10 text-success border-success/20 text-xs">Paid</Badge>
                        ) : r.status === 'skipped' ? (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Skipped</Badge>
                        ) : (
                          <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">Failed</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {r.txHash ? `${r.txHash.slice(0, 16)}...` : r.error ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Failed payments warning */}
        {failed.length > 0 && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">{failed.length} payment{failed.length !== 1 ? 's' : ''} failed</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                These holders did not receive their royalty payment. You can retry by issuing another distribution for the failed amounts.
              </p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setResult(null)
              setTotalAmount('')
              setError(null)
            }}
            className="gap-2"
          >
            <ArrowRight className="h-4 w-4 rotate-180" />
            Issue Another
          </Button>
        </div>
      </div>
    )
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
                  <Badge variant="outline" className="text-xs">{selectedAsset.token_symbol}</Badge>
                  <span className="text-xs text-muted-foreground">{assetHolders.length} holder{assetHolders.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          )}

          {/* Custodial wallet check */}
          {selectedAsset && !custodial && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <div className="flex items-center gap-2 text-destructive">
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
            <div className="rounded-lg border border-warning/20 bg-status-warning p-4">
              <div className="flex items-center gap-2 text-warning">
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
                  <p className="text-xs text-muted-foreground">
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
                      <p className="text-xs text-muted-foreground">Total Income</p>
                      <p className="font-bold tabular-nums">{formatUSD(amount)}</p>
                    </div>
                    {ownerRetainedPct > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground">Owner Retained ({ownerRetainedPct}%)</p>
                        <p className="font-bold tabular-nums">{formatUSD(ownerRetained)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">Platform Reserve (10%)</p>
                      <p className="font-bold tabular-nums">{formatUSD(reserve)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Paid to Holders ({circulatingPercent.toFixed(0)}% sold)</p>
                      <p className="font-bold tabular-nums text-primary">{formatUSD(actualDistributed)}</p>
                    </div>
                    {unsoldPercent > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground">Unsold Tokens ({unsoldPercent.toFixed(0)}%) → Issuer</p>
                        <p className="font-bold tabular-nums">{formatUSD(unsoldRetained)}</p>
                      </div>
                    )}
                  </div>

                  {/* Per-holder preview */}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
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
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-destructive">
                      {error.toLowerCase().includes('insufficient') || error.toLowerCase().includes('unfunded')
                        ? 'Insufficient Funds'
                        : error.toLowerCase().includes('no_line') || error.toLowerCase().includes('trust')
                        ? 'Trust Line Error'
                        : error.toLowerCase().includes('path_dry')
                        ? 'Payment Path Error'
                        : error.toLowerCase().includes('timeout') || error.toLowerCase().includes('network')
                        ? 'Network Error'
                        : 'Distribution Failed'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
                  </div>
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

    </div>
  )
}
