'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  XCircle,
  Snowflake,
  Clock,
  QrCode,
  Smartphone,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Asset {
  id: string
  asset_name: string
  token_symbol: string
  issuer_wallet: string
  require_auth: boolean
}

interface Approval {
  id: string
  asset_id: string
  investor_address: string
  status: string
  notes: string | null
  xrpl_tx_hash: string | null
  reviewed_at: string | null
  created_at: string
}

interface OnChainData {
  requireAuth: boolean
  network: string
  trustLines: {
    total: number
    authorized: Array<{ address: string; balance: string; currency: string }>
    pending: Array<{ address: string; balance: string; currency: string }>
  }
}

interface XamanPayload {
  uuid: string
  qr_png: string
  deep_link: string
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', icon: Clock, color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  approved: { label: 'Approved', icon: CheckCircle2, color: 'bg-green-500/10 text-green-500 border-green-500/20' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  frozen: { label: 'Frozen', icon: Snowflake, color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
} as const

function truncateAddress(addr: string) {
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`
}

export function PermissionsManager({ assets, approvals }: { assets: Asset[]; approvals: Approval[] }) {
  const router = useRouter()
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(assets[0] ?? null)
  const [onChainData, setOnChainData] = useState<OnChainData | null>(null)
  const [loading, setLoading] = useState(false)
  const [xamanPayload, setXamanPayload] = useState<XamanPayload | null>(null)
  const [xamanAction, setXamanAction] = useState<string | null>(null)
  const [pollingUuid, setPollingUuid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const assetApprovals = selectedAsset
    ? approvals.filter((a) => a.asset_id === selectedAsset.id)
    : []

  const fetchOnChainStatus = useCallback(async (asset: Asset) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/xrpl/check-require-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issuerAddress: asset.issuer_wallet,
          currency: asset.token_symbol,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setOnChainData(data)

      // Sync require_auth status in DB if it differs
      if (data.requireAuth !== asset.require_auth) {
        const supabase = createClient()
        await supabase
          .from('assets')
          .update({ require_auth: data.requireAuth })
          .eq('id', asset.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check on-chain status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedAsset) fetchOnChainStatus(selectedAsset)
  }, [selectedAsset, fetchOnChainStatus])

  // Poll for Xaman signing result
  useEffect(() => {
    if (!pollingUuid) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/xaman/check-signin?uuid=${pollingUuid}`)
        const data = await res.json()
        if (data.expired) {
          clearInterval(interval)
          setXamanPayload(null)
          setPollingUuid(null)
          setXamanAction(null)
          setError('Signing request expired. Try again.')
          return
        }
        if (data.signed) {
          clearInterval(interval)
          setXamanPayload(null)
          setPollingUuid(null)
          setXamanAction(null)
          setSuccess(
            xamanAction === 'enable-auth'
              ? 'RequireAuth enabled on-chain!'
              : 'Trust line authorized on-chain!'
          )
          if (selectedAsset) fetchOnChainStatus(selectedAsset)
          router.refresh()
        }
      } catch {
        // keep polling
      }
    }, 2500)

    return () => clearInterval(interval)
  }, [pollingUuid, xamanAction, selectedAsset, fetchOnChainStatus, router])

  async function handleEnableRequireAuth() {
    if (!selectedAsset) return
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/xrpl/enable-require-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issuerAddress: selectedAsset.issuer_wallet }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (data.custodial && data.success) {
        // Custodial wallet — done automatically
        setSuccess('RequireAuth enabled on-chain!')
        fetchOnChainStatus(selectedAsset)
        router.refresh()
      } else {
        // External wallet — Xaman signing needed
        setXamanPayload(data)
        setXamanAction('enable-auth')
        setPollingUuid(data.uuid)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create signing request')
    }
  }

  async function handleAuthorize(investorAddress: string, approvalId?: string) {
    if (!selectedAsset) return
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/xrpl/authorize-trustline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issuerAddress: selectedAsset.issuer_wallet,
          investorAddress,
          currency: selectedAsset.token_symbol,
          approvalId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (data.custodial && data.success) {
        // Custodial wallet — authorized automatically
        setSuccess(`Investor ${investorAddress.slice(0, 8)}... authorized on-chain!`)
        fetchOnChainStatus(selectedAsset)
        router.refresh()
      } else {
        // External wallet — Xaman signing needed
        setXamanPayload(data)
        setXamanAction(`authorize-${investorAddress}`)
        setPollingUuid(data.uuid)

        // Update approval status in DB
        if (approvalId) {
          const supabase = createClient()
          await supabase
            .from('investor_approvals')
            .update({
              status: 'approved',
              reviewed_at: new Date().toISOString(),
            })
            .eq('id', approvalId)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create authorization request')
    }
  }

  async function handleReject(approvalId: string) {
    const supabase = createClient()
    await supabase
      .from('investor_approvals')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', approvalId)
    router.refresh()
  }

  async function handleSyncPending() {
    if (!selectedAsset || !onChainData) return
    setError(null)

    const supabase = createClient()
    const pendingAddresses = onChainData.trustLines.pending.map((t) => t.address)
    const existingAddresses = assetApprovals.map((a) => a.investor_address)
    const newAddresses = pendingAddresses.filter((a) => !existingAddresses.includes(a))

    if (newAddresses.length === 0) {
      setSuccess('No new pending trust lines found.')
      return
    }

    for (const address of newAddresses) {
      await supabase.from('investor_approvals').insert({
        asset_id: selectedAsset.id,
        investor_address: address,
        status: 'pending',
      })
    }

    setSuccess(`Synced ${newAddresses.length} new pending request(s).`)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Asset Selector */}
      {assets.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {assets.map((asset) => (
            <button
              key={asset.id}
              onClick={() => { setSelectedAsset(asset); setXamanPayload(null); setPollingUuid(null) }}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                selectedAsset?.id === asset.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              {asset.token_symbol} — {asset.asset_name}
            </button>
          ))}
        </div>
      )}

      {!selectedAsset && (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No assets found. Create an asset first.</p>
          </CardContent>
        </Card>
      )}

      {selectedAsset && (
        <>
          {/* RequireAuth Status Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {onChainData?.requireAuth ? (
                      <ShieldCheck className="h-5 w-5 text-green-500" />
                    ) : (
                      <ShieldAlert className="h-5 w-5 text-amber-500" />
                    )}
                    Permission Domain — {selectedAsset.token_symbol}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {onChainData?.requireAuth
                      ? 'RequireAuth is active. Only approved investors can hold this token.'
                      : 'RequireAuth is off. Anyone can create a trust line and hold this token.'}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchOnChainStatus(selectedAsset)}
                  disabled={loading}
                  className="gap-1.5"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading && !onChainData && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking on-chain status…
                </div>
              )}

              {onChainData && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Network</p>
                    <p className="mt-1 text-sm font-medium capitalize">{onChainData.network}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className={`mt-1 text-sm font-medium ${onChainData.requireAuth ? 'text-green-500' : 'text-amber-500'}`}>
                      {onChainData.requireAuth ? 'Permissioned' : 'Open'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Authorized</p>
                    <p className="mt-1 text-sm font-medium">{onChainData.trustLines.authorized.length}</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Pending</p>
                    <p className="mt-1 text-sm font-medium">{onChainData.trustLines.pending.length}</p>
                  </div>
                </div>
              )}

              {/* Enable RequireAuth Button */}
              {onChainData && !onChainData.requireAuth && !xamanPayload && (
                <Button onClick={handleEnableRequireAuth} className="gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Enable RequireAuth
                </Button>
              )}

              {/* Xaman QR Code for signing */}
              {xamanPayload && (
                <div className="rounded-lg border border-border bg-muted/30 p-6">
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <QrCode className="h-4 w-4" />
                      Scan with Xaman to sign
                    </div>
                    <img
                      src={xamanPayload.qr_png}
                      alt="Xaman QR code"
                      className="rounded-lg border border-border"
                      width={180}
                      height={180}
                    />
                    <div className="flex items-center gap-1 text-xs text-muted-foreground animate-pulse">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Waiting for approval…
                    </div>
                    {xamanPayload.deep_link && (
                      <a
                        href={xamanPayload.deep_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <Smartphone className="h-3.5 w-3.5" />
                        Open in Xaman app
                      </a>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setXamanPayload(null); setPollingUuid(null); setXamanAction(null) }}
                      className="text-muted-foreground"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
              {success && <p className="text-sm text-green-500">{success}</p>}
            </CardContent>
          </Card>

          {/* Investor Approvals */}
          {onChainData?.requireAuth && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Investor Approvals</CardTitle>
                    <CardDescription>
                      Manage which wallets are authorized to hold {selectedAsset.token_symbol}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleSyncPending} className="gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Sync from chain
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {assetApprovals.length === 0 && onChainData.trustLines.pending.length === 0 ? (
                  <div className="py-8 text-center">
                    <Shield className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No pending approval requests yet. Investors will appear here when they create a trust line.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* On-chain pending (not yet in DB) */}
                    {onChainData.trustLines.pending
                      .filter((t) => !assetApprovals.some((a) => a.investor_address === t.address))
                      .map((trust) => (
                        <div
                          key={trust.address}
                          className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 p-4"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">{truncateAddress(trust.address)}</span>
                              <Badge className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/20">
                                On-chain pending
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Trust line detected on {onChainData.network}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleAuthorize(trust.address)}
                              className="gap-1.5"
                              disabled={!!xamanPayload}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Approve
                            </Button>
                          </div>
                        </div>
                      ))}

                    {/* DB approvals */}
                    {assetApprovals.map((approval) => {
                      const config = STATUS_CONFIG[approval.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending
                      const StatusIcon = config.icon
                      return (
                        <div
                          key={approval.id}
                          className="flex items-center justify-between rounded-lg border border-border p-4"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">
                                {truncateAddress(approval.investor_address)}
                              </span>
                              <Badge className={`text-xs gap-1 ${config.color}`}>
                                <StatusIcon className="h-2.5 w-2.5" />
                                {config.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Requested {new Date(approval.created_at).toLocaleDateString()}
                              {approval.reviewed_at && ` · Reviewed ${new Date(approval.reviewed_at).toLocaleDateString()}`}
                            </p>
                            {approval.xrpl_tx_hash && (
                              <a
                                href={`https://${onChainData.network === 'testnet' ? 'testnet.' : ''}xrpl.org/transactions/${approval.xrpl_tx_hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                              >
                                <ExternalLink className="h-2.5 w-2.5" />
                                View transaction
                              </a>
                            )}
                          </div>
                          {approval.status === 'pending' && (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleAuthorize(approval.investor_address, approval.id)}
                                className="gap-1.5"
                                disabled={!!xamanPayload}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleReject(approval.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Already authorized on-chain */}
                    {onChainData.trustLines.authorized.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          Authorized on-chain ({onChainData.trustLines.authorized.length})
                        </p>
                        {onChainData.trustLines.authorized.map((trust) => (
                          <div
                            key={trust.address}
                            className="flex items-center justify-between py-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">
                                {truncateAddress(trust.address)}
                              </span>
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {parseFloat(trust.balance) !== 0
                                ? `${Math.abs(parseFloat(trust.balance)).toLocaleString()} ${trust.currency}`
                                : 'No balance'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
