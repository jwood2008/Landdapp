'use client'

import { useState } from 'react'
import {
  AlertCircle, Loader2, DollarSign, Send, CheckCircle,
  Zap, WifiOff, Database, ArrowRight, CircleDot, Shield,
  ShieldCheck, ShieldAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { XamanSignModal } from '@/components/admin/xaman-sign-modal'
import type { AssetRow } from '@/types/database'

interface Holder {
  address: string
  balance: number
  percent: number
  platformInvestorId?: string
  kycStatus?: string
  investorName?: string
}

interface SavedPayment {
  id: string
  wallet_address: string
  amount: number
  currency: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  tx_hash: string | null
}

function truncAddr(a: string) {
  return `${a.slice(0, 10)}...${a.slice(-6)}`
}

function formatUSD(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

export function AdminDistributionForm({ assets }: { assets: AssetRow[] }) {
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [holders, setHolders] = useState<Holder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [holderSource, setHolderSource] = useState<'xrpl' | 'cached' | null>(null)

  // Distribution form state
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('RLUSD')
  const [eventType, setEventType] = useState<'LEASE' | 'REFINANCE' | 'VALUATION'>('LEASE')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedDistId, setSavedDistId] = useState<string | null>(null)
  const [savedPayments, setSavedPayments] = useState<SavedPayment[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)

  // Trustline check state
  const [trustlineChecking, setTrustlineChecking] = useState(false)
  const [trustlineResults, setTrustlineResults] = useState<Record<string, boolean>>({})
  const [trustlineChecked, setTrustlineChecked] = useState(false)
  const [trustlineCreating, setTrustlineCreating] = useState<string | null>(null) // address being created

  // On-chain execution state
  const [executing, setExecuting] = useState(false)
  const [currentPaymentIndex, setCurrentPaymentIndex] = useState(-1)
  const [xamanUuid, setXamanUuid] = useState<string | null>(null)
  const [xamanQrUrl, setXamanQrUrl] = useState<string | null>(null)
  const [xamanDeepLink, setXamanDeepLink] = useState<string | null>(null)
  const [xamanMode, setXamanMode] = useState<'payment' | 'trustline'>('payment')
  const [execError, setExecError] = useState<string | null>(null)

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) ?? null

  const totalAmount = parseFloat(amount) || 0
  const totalHolderPercent = holders.reduce((s, h) => s + h.percent, 0)
  const reserve = totalAmount * 0.1
  const distributable = totalAmount - reserve
  const breakdown = holders.map((h) => ({
    ...h,
    share: totalHolderPercent > 0 ? (h.percent / totalHolderPercent) * distributable : 0,
  }))

  const completedPayments = savedPayments.filter((p) => p.status === 'completed')
  const pendingPayments = savedPayments.filter((p) => p.status !== 'completed')
  const allDone = savedPayments.length > 0 && pendingPayments.length === 0

  async function enrichWithPlatformInvestors(rawHolders: Holder[]): Promise<Holder[]> {
    if (rawHolders.length === 0) return rawHolders
    const supabase = createClient()
    const addresses = rawHolders.map((h) => h.address)
    const { data: investors } = await supabase
      .from('platform_investors')
      .select('id, wallet_address, full_name, kyc_status')
      .in('wallet_address', addresses)

    const investorMap = new Map(
      (investors ?? []).map((inv) => [inv.wallet_address, inv])
    )

    return rawHolders.map((h) => {
      const inv = investorMap.get(h.address)
      return {
        ...h,
        platformInvestorId: inv?.id,
        kycStatus: inv?.kyc_status,
        investorName: inv?.full_name ?? undefined,
      }
    })
  }

  async function loadHolders(asset: AssetRow) {
    setLoading(true)
    setError(null)
    setHolders([])
    setHolderSource(null)

    try {
      const res = await fetch('/api/issuer-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issuerAddress: asset.issuer_wallet,
          tokenSymbol: asset.token_symbol,
          tokenSupply: asset.token_supply,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const xrplHolders = (data.holders ?? []).map((h: Holder) => ({
        address: h.address,
        balance: h.balance,
        percent: h.percent,
      }))

      if (xrplHolders.length > 0) {
        const enriched = await enrichWithPlatformInvestors(xrplHolders)
        setHolders(enriched)
        setHolderSource('xrpl')
        setLoading(false)
        return
      }
    } catch {
      // XRPL failed — fall through to cached data
    }

    try {
      const supabase = createClient()
      const { data: cached } = await supabase
        .from('investor_holdings')
        .select('wallet_address, token_balance, ownership_percent')
        .eq('asset_id', asset.id)
        .gt('token_balance', 0)

      if (cached && cached.length > 0) {
        const rawHolders = cached.map((h) => ({
          address: h.wallet_address,
          balance: Number(h.token_balance),
          percent: Number(h.ownership_percent),
        }))
        const enriched = await enrichWithPlatformInvestors(rawHolders)
        setHolders(enriched)
        setHolderSource('cached')
        setError('XRPL unavailable — using cached holder data from last sync')
      } else {
        setError('Could not load holders from XRPL or cache. You can still record the distribution, but holder breakdown won\'t be available.')
      }
    } catch {
      setError('Failed to load holder data from any source.')
    } finally {
      setLoading(false)
    }
  }

  function handleAssetChange(assetId: string) {
    setSelectedAssetId(assetId)
    setError(null)
    setHolders([])
    setSavedDistId(null)
    setSavedPayments([])
    setSaveError(null)
    setAmount('')
    setNotes('')
    setExecuting(false)
    setCurrentPaymentIndex(-1)

    const asset = assets.find((a) => a.id === assetId)
    if (asset) loadHolders(asset)
  }

  async function handleRecord() {
    if (!totalAmount || !selectedAsset) return
    setSaving(true)
    setSaveError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Save distribution as PENDING (not completed — will complete after on-chain execution)
      const { data: dist, error: distErr } = await supabase
        .from('distributions')
        .insert({
          asset_id: selectedAsset.id,
          event_type: eventType,
          total_amount: totalAmount,
          currency,
          reserve_amount: reserve,
          distributable_amount: distributable,
          status: 'pending',
          notes: notes || null,
          triggered_by: user.id,
        })
        .select('id')
        .single()

      if (distErr) throw distErr

      let payments: SavedPayment[] = []

      if (breakdown.length > 0) {
        const paymentInserts = breakdown
          .filter((h) => h.share > 0)
          .map((h) => ({
            distribution_id: dist.id,
            wallet_address: h.address,
            amount: parseFloat(h.share.toFixed(6)),
            currency,
            ownership_percent: h.percent,
            status: 'pending' as const,
          }))

        const { data: insertedPayments, error: paymentsErr } = await supabase
          .from('distribution_payments')
          .insert(paymentInserts)
          .select('id, wallet_address, amount, currency, status, tx_hash')

        if (paymentsErr) throw paymentsErr
        payments = (insertedPayments ?? []) as SavedPayment[]
      }

      setSavedDistId(dist.id)
      setSavedPayments(payments)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to record distribution')
    } finally {
      setSaving(false)
    }
  }

  async function executePayment(paymentIndex: number) {
    const payment = savedPayments[paymentIndex]
    if (!payment || !selectedAsset) return

    setCurrentPaymentIndex(paymentIndex)
    setExecError(null)

    try {
      const res = await fetch('/api/xrpl/execute-distribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distributionPaymentId: payment.id,
          issuerAddress: selectedAsset.issuer_wallet,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // Update local status to processing
      setSavedPayments((prev) =>
        prev.map((p) => p.id === payment.id ? { ...p, status: 'processing' as const } : p)
      )

      // Show Xaman signing modal
      setXamanUuid(data.uuid)
      setXamanQrUrl(data.qrUrl)
      setXamanDeepLink(data.deepLink)
    } catch (err) {
      setExecError(err instanceof Error ? err.message : 'Failed to create payment')
      // Reset to pending
      setSavedPayments((prev) =>
        prev.map((p) => p.id === payment.id ? { ...p, status: 'pending' as const } : p)
      )
    }
  }

  async function handleSigned(txHash: string) {
    const payment = savedPayments[currentPaymentIndex]
    if (!payment) return

    // Confirm on server
    try {
      await fetch('/api/xrpl/confirm-distribution-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distributionPaymentId: payment.id,
          xamanUuid,
        }),
      })
    } catch {
      // Even if confirm fails, the tx was signed — update locally
    }

    // Update local status
    setSavedPayments((prev) =>
      prev.map((p) => p.id === payment.id ? { ...p, status: 'completed' as const, tx_hash: txHash } : p)
    )

    closeModal()

    // Auto-advance to next pending payment
    const nextIndex = savedPayments.findIndex((p, i) => i > currentPaymentIndex && p.status === 'pending')
    if (nextIndex !== -1 && executing) {
      setTimeout(() => executePayment(nextIndex), 1000)
    } else {
      setExecuting(false)
    }
  }

  function handleExpired() {
    const payment = savedPayments[currentPaymentIndex]
    if (payment) {
      setSavedPayments((prev) =>
        prev.map((p) => p.id === payment.id ? { ...p, status: 'pending' as const } : p)
      )
    }
    closeModal()
    setExecError('Signing request expired. You can retry.')
    setExecuting(false)
  }

  function handleCancelSign() {
    const payment = savedPayments[currentPaymentIndex]
    if (payment) {
      setSavedPayments((prev) =>
        prev.map((p) => p.id === payment.id ? { ...p, status: 'pending' as const } : p)
      )
    }
    closeModal()
    setExecuting(false)
  }

  function closeModal() {
    setXamanUuid(null)
    setXamanQrUrl(null)
    setXamanDeepLink(null)
    setXamanMode('payment')
  }

  // ── Trustline logic ──

  const missingTrustlines = savedPayments
    .filter((p) => p.status === 'pending' && trustlineResults[p.wallet_address] === false)
    .map((p) => p.wallet_address)
  const uniqueMissing = [...new Set(missingTrustlines)]
  const allTrustlinesReady = trustlineChecked && uniqueMissing.length === 0

  async function checkTrustlines() {
    if (!savedPayments.length || currency === 'XRP') {
      setTrustlineChecked(true)
      return
    }
    setTrustlineChecking(true)
    setExecError(null)

    try {
      const wallets = [...new Set(savedPayments.map((p) => p.wallet_address))].join(',')
      const params = new URLSearchParams({
        wallets,
        currency,
        ...(selectedAsset?.issuer_wallet ? { issuerWallet: selectedAsset.issuer_wallet } : {}),
      })

      const res = await fetch(`/api/xrpl/check-trustlines?${params}`)
      const data = await res.json()

      if (data.error) throw new Error(data.error)

      const results: Record<string, boolean> = {}
      for (const r of data.results) {
        results[r.address] = r.hasTrustline
      }
      setTrustlineResults(results)
      setTrustlineChecked(true)
    } catch (err) {
      setExecError(err instanceof Error ? err.message : 'Failed to check trustlines')
    } finally {
      setTrustlineChecking(false)
    }
  }

  async function createTrustlineFor(address: string) {
    setTrustlineCreating(address)
    setExecError(null)

    try {
      const res = await fetch('/api/xrpl/create-trustline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investorAddress: address,
          currency,
          issuerWallet: selectedAsset?.issuer_wallet,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // Show Xaman modal for the investor to sign the TrustSet
      setXamanMode('trustline')
      setXamanUuid(data.uuid)
      setXamanQrUrl(data.qrUrl)
      setXamanDeepLink(data.deepLink)
    } catch (err) {
      setExecError(err instanceof Error ? err.message : 'Failed to create trustline request')
      setTrustlineCreating(null)
    }
  }

  function handleTrustlineSigned() {
    // Mark this wallet as having a trustline now
    if (trustlineCreating) {
      setTrustlineResults((prev) => ({ ...prev, [trustlineCreating]: true }))
    }
    setTrustlineCreating(null)
    closeModal()
  }

  function handleTrustlineExpired() {
    setTrustlineCreating(null)
    closeModal()
    setExecError('Trustline signing expired. The investor can retry.')
  }

  function handleTrustlineCancelled() {
    setTrustlineCreating(null)
    closeModal()
  }

  function startExecution() {
    setExecuting(true)
    setExecError(null)
    const firstPending = savedPayments.findIndex((p) => p.status === 'pending')
    if (firstPending !== -1) {
      executePayment(firstPending)
    }
  }

  if (assets.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <DollarSign className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No active assets found. Create an asset first before recording distributions.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Xaman signing modal */}
      {xamanUuid && xamanMode === 'payment' && (
        <XamanSignModal
          uuid={xamanUuid}
          qrUrl={xamanQrUrl}
          deepLink={xamanDeepLink}
          instruction={
            currentPaymentIndex >= 0 && savedPayments[currentPaymentIndex]
              ? `Send ${savedPayments[currentPaymentIndex].amount} ${savedPayments[currentPaymentIndex].currency} to ${truncAddr(savedPayments[currentPaymentIndex].wallet_address)}`
              : 'Sign distribution payment'
          }
          onSigned={handleSigned}
          onExpired={handleExpired}
          onCancel={handleCancelSign}
        />
      )}

      {/* Xaman trustline signing modal */}
      {xamanUuid && xamanMode === 'trustline' && (
        <XamanSignModal
          uuid={xamanUuid}
          qrUrl={xamanQrUrl}
          deepLink={xamanDeepLink}
          instruction={
            trustlineCreating
              ? `Investor ${truncAddr(trustlineCreating)} must sign to create ${currency} trust line`
              : 'Sign trust line creation'
          }
          onSigned={handleTrustlineSigned}
          onExpired={handleTrustlineExpired}
          onCancel={handleTrustlineCancelled}
        />
      )}

      {/* Asset selector card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Asset</CardTitle>
          <CardDescription>Choose the asset you want to create a distribution for</CardDescription>
        </CardHeader>
        <CardContent>
          <select
            value={selectedAssetId}
            onChange={(e) => handleAssetChange(e.target.value)}
            className="input w-full"
            disabled={!!savedDistId}
          >
            <option value="">Choose an asset...</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.asset_name} ({asset.token_symbol}) — {formatUSD(Number(asset.current_valuation))} valuation
              </option>
            ))}
          </select>

          {selectedAsset && !loading && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Token Supply</p>
                <p className="text-sm font-bold mt-0.5">{Number(selectedAsset.token_supply).toLocaleString()}</p>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">NAV / Token</p>
                <p className="text-sm font-bold mt-0.5">${Number(selectedAsset.nav_per_token).toFixed(4)}</p>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Annual Yield</p>
                <p className="text-sm font-bold mt-0.5">{selectedAsset.annual_yield ?? '—'}%</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading */}
      {loading && (
        <Card>
          <CardContent className="py-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading token holders...</p>
          </CardContent>
        </Card>
      )}

      {/* Holder source indicator */}
      {!loading && holderSource && !savedDistId && (
        <div className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs ${
          holderSource === 'xrpl'
            ? 'border-success/20 bg-success/5 text-success'
            : 'border-warning/20 bg-status-warning text-warning'
        }`}>
          {holderSource === 'xrpl' ? (
            <>
              <Zap className="h-3.5 w-3.5 shrink-0" />
              <span>Live data from XRPL — <strong>{holders.length}</strong> holder{holders.length !== 1 ? 's' : ''} found</span>
            </>
          ) : (
            <>
              <Database className="h-3.5 w-3.5 shrink-0" />
              <span>Using cached holder data — <strong>{holders.length}</strong> holder{holders.length !== 1 ? 's' : ''} from last sync</span>
              <WifiOff className="h-3 w-3 ml-auto opacity-60" />
            </>
          )}
        </div>
      )}

      {/* Error with no holders */}
      {!loading && error && holders.length === 0 && !savedDistId && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-status-warning px-4 py-3 text-sm text-warning">
          <WifiOff className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Could not load holder data</p>
            <p className="text-xs mt-0.5 opacity-80">{error}</p>
          </div>
        </div>
      )}

      {/* ── POST-RECORD: Execution Panel ── */}
      {savedDistId && savedPayments.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  {allDone ? 'Distribution Complete' : 'Execute On-Chain Payments'}
                </CardTitle>
                <CardDescription>
                  {allDone
                    ? `All ${savedPayments.length} payments confirmed on XRPL`
                    : `${completedPayments.length} of ${savedPayments.length} payments executed`}
                </CardDescription>
              </div>
              {allDone && (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-status-success">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-success transition-all duration-500"
                  style={{ width: `${savedPayments.length > 0 ? (completedPayments.length / savedPayments.length) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{completedPayments.length} completed</span>
                <span>{pendingPayments.length} remaining</span>
              </div>
            </div>

            {/* Trustline check section */}
            {!allDone && currency !== 'XRP' && (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="bg-muted/30 px-4 py-2.5 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground">Trust Line Status</p>
                  </div>
                  {!trustlineChecked && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs gap-1"
                      onClick={checkTrustlines}
                      disabled={trustlineChecking}
                    >
                      {trustlineChecking ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Checking...</>
                      ) : (
                        <><Shield className="h-3 w-3" /> Check Trust Lines</>
                      )}
                    </Button>
                  )}
                  {trustlineChecked && allTrustlinesReady && (
                    <Badge variant="default" className="text-xs gap-1">
                      <ShieldCheck className="h-2.5 w-2.5" /> All Ready
                    </Badge>
                  )}
                  {trustlineChecked && !allTrustlinesReady && (
                    <Badge variant="destructive" className="text-xs gap-1">
                      <ShieldAlert className="h-2.5 w-2.5" /> {uniqueMissing.length} Missing
                    </Badge>
                  )}
                </div>

                {trustlineChecked && uniqueMissing.length > 0 && (
                  <div className="px-4 py-3 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      These wallets need a <strong>{currency}</strong> trust line before they can receive payments.
                      Each investor must sign the trust line in their Xaman wallet.
                    </p>
                    <div className="space-y-1.5">
                      {uniqueMissing.map((addr) => (
                        <div key={addr} className="flex items-center justify-between rounded-md bg-status-warning border border-warning/20 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="h-3.5 w-3.5 text-warning" />
                            <span className="text-xs font-mono">{truncAddr(addr)}</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs gap-1 border-warning/20"
                            onClick={() => createTrustlineFor(addr)}
                            disabled={trustlineCreating === addr}
                          >
                            {trustlineCreating === addr ? (
                              <><Loader2 className="h-3 w-3 animate-spin" /> Creating...</>
                            ) : (
                              'Create Trust Line'
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {trustlineChecked && allTrustlinesReady && (
                  <div className="px-4 py-3 flex items-center gap-2 text-xs text-success">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    All recipient wallets have {currency} trust lines — ready to execute payments.
                  </div>
                )}
              </div>
            )}

            {/* Payment list with status */}
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="text-left px-4 py-2 text-muted-foreground font-medium">Recipient</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">Amount</th>
                    <th className="text-center px-4 py-2 text-muted-foreground font-medium">Status</th>
                    <th className="text-right px-4 py-2 text-muted-foreground font-medium">Tx Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {savedPayments.map((p, i) => (
                    <tr key={p.id} className={`${i === currentPaymentIndex && executing ? 'bg-primary/5' : 'hover:bg-muted/10'}`}>
                      <td className="px-4 py-2.5 font-mono">{truncAddr(p.wallet_address)}</td>
                      <td className="px-4 py-2.5 text-right font-medium">
                        {p.amount.toFixed(2)} {p.currency}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {p.status === 'completed' ? (
                          <Badge variant="default" className="text-xs gap-1">
                            <CheckCircle className="h-2.5 w-2.5" /> Confirmed
                          </Badge>
                        ) : p.status === 'processing' ? (
                          <Badge variant="outline" className="text-xs gap-1 animate-pulse">
                            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Signing
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <CircleDot className="h-2.5 w-2.5" /> Pending
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {p.tx_hash ? (
                          <a
                            href={`https://testnet.xrpl.org/transactions/${p.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-primary hover:underline"
                          >
                            {p.tx_hash.slice(0, 8)}...
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {execError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {execError}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-between border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                {allDone
                  ? 'All payments settled on XRPL'
                  : currency !== 'XRP' && !allTrustlinesReady
                    ? 'Check trust lines before executing payments'
                    : 'Each payment requires signing in Xaman wallet'}
              </p>
              <div className="flex gap-2">
                {!allDone && (
                  <>
                    {pendingPayments.length > 0 && !executing && (
                      <Button
                        onClick={startExecution}
                        className="gap-2"
                        disabled={currency !== 'XRP' && !allTrustlinesReady}
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                        {completedPayments.length > 0 ? 'Resume Execution' : 'Execute On-Chain'}
                      </Button>
                    )}
                    {executing && !xamanUuid && (
                      <Button disabled className="gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Preparing next payment...
                      </Button>
                    )}
                  </>
                )}
                {allDone && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSavedDistId(null)
                      setSavedPayments([])
                      setAmount('')
                      setNotes('')
                      setExecuting(false)
                      setCurrentPaymentIndex(-1)
                    }}
                  >
                    Record another distribution
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── POST-RECORD: No holders (record only, no execution) ── */}
      {savedDistId && savedPayments.length === 0 && (
        <Card className="border-success/20">
          <CardContent className="py-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-status-success">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <h3 className="font-semibold text-success">Distribution Recorded</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Distribution recorded without per-holder payments (no holders found).
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setSavedDistId(null)
                    setSavedPayments([])
                    setAmount('')
                    setNotes('')
                  }}
                >
                  Record another distribution
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── PRE-RECORD: Distribution form ── */}
      {selectedAsset && !loading && !savedDistId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribution Details</CardTitle>
            <CardDescription>Enter the total amount to distribute. 10% is reserved, 90% goes to holders.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Inputs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Total Distribution Amount</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="input flex-1 text-sm font-mono"
                    min="0"
                    step="0.01"
                  />
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="input w-28 text-sm"
                  >
                    <option value="RLUSD">RLUSD</option>
                    <option value="XRP">XRP</option>
                    <option value="USD">USD (off-chain)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Event Type</label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as typeof eventType)}
                  className="input w-full text-sm"
                >
                  <option value="LEASE">Lease Income</option>
                  <option value="REFINANCE">Refinance</option>
                  <option value="VALUATION">Valuation Event</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Q1 2026 lease income from tenant..."
                className="input w-full text-sm"
              />
            </div>

            {/* Summary cards */}
            {totalAmount > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-muted/40 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Gross Amount</p>
                  <p className="text-lg font-bold mt-0.5">{formatUSD(totalAmount)}</p>
                </div>
                <div className="rounded-lg bg-status-warning p-3 text-center">
                  <p className="text-xs text-muted-foreground">Reserve (10%)</p>
                  <p className="text-lg font-bold mt-0.5 text-warning">{formatUSD(reserve)}</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Distributable (90%)</p>
                  <p className="text-lg font-bold mt-0.5 text-primary">{formatUSD(distributable)}</p>
                </div>
              </div>
            )}

            {/* Per-holder breakdown */}
            {totalAmount > 0 && holders.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="bg-muted/30 px-4 py-2 border-b border-border flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Per-Holder Breakdown</p>
                  {holders.some((h) => !h.platformInvestorId) && (
                    <Badge variant="outline" className="text-xs gap-1 text-warning border-warning/20">
                      <ShieldAlert className="h-2.5 w-2.5" />
                      {holders.filter((h) => !h.platformInvestorId).length} not on platform
                    </Badge>
                  )}
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/20">
                      <th className="text-left px-4 py-2 text-muted-foreground font-medium">Holder</th>
                      <th className="text-center px-4 py-2 text-muted-foreground font-medium">Status</th>
                      <th className="text-right px-4 py-2 text-muted-foreground font-medium">Balance</th>
                      <th className="text-right px-4 py-2 text-muted-foreground font-medium">Ownership</th>
                      <th className="text-right px-4 py-2 text-muted-foreground font-medium">Payout ({currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {breakdown.map((h) => (
                      <tr key={h.address} className={`hover:bg-muted/10 ${!h.platformInvestorId ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-2.5">
                          <span className="font-mono">{truncAddr(h.address)}</span>
                          {h.investorName && (
                            <span className="ml-2 text-muted-foreground">{h.investorName}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {h.platformInvestorId ? (
                            <Badge className={`text-xs ${
                              h.kycStatus === 'verified'
                                ? 'bg-success/10 text-success'
                                : 'bg-status-warning text-warning'
                            }`}>
                              {h.kycStatus === 'verified' ? 'Verified' : h.kycStatus ?? 'Pending'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Not registered
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{h.balance.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{h.percent.toFixed(3)}%</td>
                        <td className="px-4 py-2.5 text-right font-medium">{formatUSD(h.share)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/20 font-medium">
                      <td className="px-4 py-2">Total</td>
                      <td className="px-4 py-2 text-right">{holders.reduce((s, h) => s + h.balance, 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">{totalHolderPercent.toFixed(3)}%</td>
                      <td className="px-4 py-2 text-right">{formatUSD(distributable)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {holders.length === 0 && !loading && selectedAsset && (
              <div className="rounded-lg border border-dashed border-border py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No holders found. The distribution will be recorded without a per-holder breakdown.
                </p>
              </div>
            )}

            {saveError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {saveError}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                {holders.length > 0
                  ? `Saves to database, then sign each payment in Xaman`
                  : 'Records distribution event to database'}
              </p>
              <Button
                onClick={handleRecord}
                disabled={!totalAmount || saving}
                className="gap-2"
              >
                <Send className="h-3.5 w-3.5" />
                {saving ? 'Recording...' : 'Record & Prepare Payments'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
