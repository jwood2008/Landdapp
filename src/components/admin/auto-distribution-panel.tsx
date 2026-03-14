'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Zap, Loader2, CheckCircle, XCircle, AlertTriangle,
  FileText, Calendar, DollarSign, Users,
} from 'lucide-react'

interface Asset {
  id: string
  asset_name: string
  token_symbol: string
  issuer_wallet: string
  current_valuation: number
  last_distribution_at: string | null
}

interface Contract {
  id: string
  asset_id: string
  file_name: string
  tenant_name: string | null
  annual_amount: number | null
  payment_frequency: string | null
  escalation_rate: number | null
  lease_start_date: string | null
  lease_end_date: string | null
  currency: string
  summary: string | null
}

interface PaymentResult {
  paymentId: string
  status: string
  txHash?: string
  error?: string
}

interface Props {
  assets: Asset[]
  contracts: Contract[]
  custodialAddresses: string[]
}

export function AutoDistributionPanel({ assets, contracts, custodialAddresses }: Props) {
  const [selectedAssetId, setSelectedAssetId] = useState(assets[0]?.id ?? '')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{
    totalPayout: number
    reserveAmount: number
    distributableAmount: number
    holdersCount: number
    results: PaymentResult[]
    status: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedAsset = assets.find((a) => a.id === selectedAssetId)
  const selectedContract = contracts.find((c) => c.asset_id === selectedAssetId)
  const isCustodial = selectedAsset ? custodialAddresses.includes(selectedAsset.issuer_wallet) : false

  async function runAutoDistribution() {
    if (!selectedAssetId) return
    setRunning(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/admin/auto-distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: selectedAssetId }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Distribution failed')

      setResult({
        totalPayout: data.totalPayout,
        reserveAmount: data.reserveAmount,
        distributableAmount: data.distributableAmount,
        holdersCount: data.holdersCount,
        results: data.results,
        status: data.distribution.status,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run distribution')
    } finally {
      setRunning(false)
    }
  }

  function frequencyLabel(freq: string | null) {
    if (freq === 'monthly') return 'Monthly'
    if (freq === 'quarterly') return 'Quarterly'
    if (freq === 'semi_annual') return 'Semi-Annual'
    if (freq === 'annual') return 'Annual'
    return freq ?? 'Unknown'
  }

  return (
    <div className="space-y-6">
      {/* Asset selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Automatic Royalty Distribution
          </CardTitle>
          <CardDescription>
            Execute royalty payments automatically based on contract terms. The app calculates the amount,
            splits it among token holders by ownership %, and sends payments from the issuer&apos;s custodial wallet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Select Asset</label>
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

          {/* Contract summary */}
          {selectedContract ? (
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Active Contract</span>
                <Badge variant="outline" className="text-[10px]">{selectedContract.file_name}</Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Annual Amount</p>
                  <p className="text-sm font-semibold">
                    ${selectedContract.annual_amount?.toLocaleString() ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Frequency</p>
                  <p className="text-sm font-semibold">{frequencyLabel(selectedContract.payment_frequency)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Escalation</p>
                  <p className="text-sm font-semibold">
                    {selectedContract.escalation_rate ? `${selectedContract.escalation_rate}%/yr` : 'None'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Lease Period</p>
                  <p className="text-sm font-semibold">
                    {selectedContract.lease_start_date
                      ? `${new Date(selectedContract.lease_start_date).getFullYear()} — ${selectedContract.lease_end_date ? new Date(selectedContract.lease_end_date).getFullYear() : 'ongoing'}`
                      : '—'}
                  </p>
                </div>
              </div>

              {selectedContract.summary && (
                <p className="text-xs text-muted-foreground">{selectedContract.summary}</p>
              )}

              {selectedAsset?.last_distribution_at && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Last distribution: {new Date(selectedAsset.last_distribution_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">No contract uploaded</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Upload a lease agreement for this asset first. Go to the asset detail page to upload a contract — AI will extract the payment terms automatically.
              </p>
            </div>
          )}

          {/* Custodial wallet check */}
          {selectedAsset && !isCustodial && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Issuer wallet not custodial</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Auto-distribution requires the issuer wallet ({selectedAsset.issuer_wallet.slice(0, 10)}...) to be a platform-managed custodial wallet.
                Use the manual distribution flow instead, or create a custodial issuer wallet.
              </p>
            </div>
          )}

          {/* Execute button */}
          <Button
            onClick={runAutoDistribution}
            disabled={running || !selectedContract || !isCustodial}
            className="gap-2"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculating &amp; Distributing...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Run Auto-Distribution
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-red-500/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-4 w-4" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {result.status === 'completed' ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              Distribution {result.status === 'completed' ? 'Complete' : 'Partial'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-lg border p-3 text-center">
                <DollarSign className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-lg font-bold">${result.totalPayout.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Total Payout</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <DollarSign className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-lg font-bold">${result.reserveAmount.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Reserve (10%)</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <DollarSign className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-lg font-bold">${result.distributableAmount.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Distributed</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <Users className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-lg font-bold">{result.holdersCount}</p>
                <p className="text-[10px] text-muted-foreground">Holders Paid</p>
              </div>
            </div>

            {/* Per-payment results */}
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Payment</th>
                    <th className="text-center px-4 py-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">TX Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.results.map((r, i) => (
                    <tr key={r.paymentId} className="hover:bg-muted/10">
                      <td className="px-4 py-2">Payment {i + 1}</td>
                      <td className="px-4 py-2 text-center">
                        <Badge className={`text-[10px] ${
                          r.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                          r.status === 'skipped' ? 'bg-gray-500/10 text-gray-500' :
                          'bg-red-500/10 text-red-500'
                        }`}>
                          {r.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 font-mono text-muted-foreground truncate max-w-[200px]">
                        {r.txHash ? `${r.txHash.slice(0, 16)}...` : r.error ?? '—'}
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
