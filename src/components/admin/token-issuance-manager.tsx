'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Send,
  Wallet,
  Coins,
  CheckCircle,
  AlertCircle,
  Loader2,
  Users,
  ArrowRight,
} from 'lucide-react'
import { XamanSignIn } from '@/components/wallet/xaman-signin'
import { createClient } from '@/lib/supabase/client'

interface Asset {
  id: string
  asset_name: string
  token_symbol: string
  token_supply: number
  issuer_wallet: string
  current_valuation: number
  nav_per_token: number
}

interface Approval {
  id: string
  asset_id: string
  investor_address: string
  status: string
  created_at: string
}

interface Holding {
  asset_id: string
  wallet_address: string
  token_balance: number
  ownership_percent: number
}

interface Props {
  assets: Asset[]
  approvals: Approval[]
  holdings: Holding[]
}

export function TokenIssuanceManager({ assets, approvals, holdings }: Props) {
  const [selectedAssetId, setSelectedAssetId] = useState(assets[0]?.id ?? '')
  const [selectedInvestor, setSelectedInvestor] = useState('')
  const [amount, setAmount] = useState('')
  const [sending, setSending] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [payloadUuid, setPayloadUuid] = useState<string | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedAsset = assets.find((a) => a.id === selectedAssetId)
  const assetApprovals = approvals.filter((a) => a.asset_id === selectedAssetId)
  const amountNum = parseFloat(amount) || 0

  // Get current balance for selected investor
  const investorHolding = holdings.find(
    (h) => h.asset_id === selectedAssetId && h.wallet_address === selectedInvestor
  )
  const currentBalance = investorHolding?.token_balance ?? 0

  // Compute ownership % the new amount would represent
  const newOwnership =
    selectedAsset && selectedAsset.token_supply > 0
      ? ((currentBalance + amountNum) / selectedAsset.token_supply) * 100
      : 0
  const navValue = selectedAsset ? amountNum * selectedAsset.nav_per_token : 0

  async function handleSend() {
    if (!selectedAsset || !selectedInvestor || amountNum <= 0) return
    setSending(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/xrpl/send-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issuerAddress: selectedAsset.issuer_wallet,
          destinationAddress: selectedInvestor,
          tokenSymbol: selectedAsset.token_symbol,
          amount: amountNum,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create payment')

      setPayloadUuid(data.uuid)
      setQrUrl(data.qrUrl)
      setShowQR(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  async function handleXamanSuccess() {
    setShowQR(false)
    setPayloadUuid(null)
    setQrUrl(null)

    // Record the issuance in Supabase
    try {
      const supabase = createClient()
      await supabase.from('investor_holdings').upsert(
        {
          asset_id: selectedAssetId,
          wallet_address: selectedInvestor,
          token_balance: currentBalance + amountNum,
          ownership_percent: newOwnership,
        },
        { onConflict: 'asset_id,wallet_address' }
      )
    } catch {
      // Non-critical — holdings will resync
    }

    setSuccess(
      `Successfully sent ${amountNum.toLocaleString()} ${selectedAsset?.token_symbol} to ${selectedInvestor.slice(0, 8)}...${selectedInvestor.slice(-6)}`
    )
    setAmount('')
    setTimeout(() => setSuccess(null), 6000)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left: Issuance Form */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Tokens
            </CardTitle>
            <CardDescription>
              Select an asset, choose an approved investor, and specify the amount to send.
              The transaction will be signed via Xaman.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Asset selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Asset</label>
              <select
                value={selectedAssetId}
                onChange={(e) => {
                  setSelectedAssetId(e.target.value)
                  setSelectedInvestor('')
                  setAmount('')
                }}
                className="input"
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.asset_name} ({a.token_symbol})
                  </option>
                ))}
              </select>
            </div>

            {/* Investor selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Approved Investor
                <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                  ({assetApprovals.length} approved)
                </span>
              </label>
              {assetApprovals.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center rounded-lg border border-dashed border-border">
                  No approved investors for this asset. Approve trust lines in the Permissions tab first.
                </p>
              ) : (
                <select
                  value={selectedInvestor}
                  onChange={(e) => setSelectedInvestor(e.target.value)}
                  className="input font-mono text-sm"
                >
                  <option value="">Select investor wallet...</option>
                  {assetApprovals.map((a) => {
                    const h = holdings.find(
                      (hh) => hh.asset_id === selectedAssetId && hh.wallet_address === a.investor_address
                    )
                    return (
                      <option key={a.id} value={a.investor_address}>
                        {a.investor_address.slice(0, 8)}...{a.investor_address.slice(-6)}
                        {h ? ` (${h.token_balance.toLocaleString()} held)` : ' (0 held)'}
                      </option>
                    )
                  })}
                </select>
              )}
            </div>

            {/* Amount */}
            {selectedInvestor && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Token Amount
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`e.g., 50000 ${selectedAsset?.token_symbol ?? ''}`}
                  min="1"
                  className="input font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Max supply: {selectedAsset?.token_supply.toLocaleString()} {selectedAsset?.token_symbol}
                </p>
              </div>
            )}

            {/* Impact Preview */}
            {amountNum > 0 && selectedInvestor && selectedAsset && (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground">NAV Value</p>
                  <p className="text-lg font-bold mt-1 tabular-nums">
                    ${navValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground">Ownership After</p>
                  <p className="text-lg font-bold mt-1 tabular-nums">
                    {newOwnership.toFixed(2)}%
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-primary/5 border-primary/20 p-4">
                  <p className="text-xs text-muted-foreground">Tokens Sending</p>
                  <p className="text-lg font-bold mt-1 tabular-nums text-primary">
                    {amountNum.toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {/* Xaman QR */}
            {showQR && qrUrl && (
              <div className="flex flex-col items-center gap-3 py-4">
                <p className="text-sm font-medium">Sign with Xaman to send tokens</p>
                <img
                  src={qrUrl}
                  alt="Xaman QR Code"
                  className="w-48 h-48 rounded-xl border border-border"
                />
                <XamanSignIn
                  onSuccess={handleXamanSuccess}
                  onCancel={() => {
                    setShowQR(false)
                    setPayloadUuid(null)
                  }}
                />
              </div>
            )}

            {/* Success / Error */}
            {success && (
              <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 p-4 text-sm text-success">
                <CheckCircle className="h-4 w-4 shrink-0" />
                {success}
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Send button */}
            {!showQR && selectedInvestor && amountNum > 0 && (
              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSend}
                  disabled={sending || !selectedAsset}
                  className="gap-2"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {sending ? 'Creating transaction...' : 'Send Tokens via Xaman'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right: Asset Info & Investor List */}
      <div className="space-y-6">
        {selectedAsset && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Coins className="h-4 w-4" />
                {selectedAsset.token_symbol} Token Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Asset</p>
                <p className="font-medium mt-0.5">{selectedAsset.asset_name}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Total Supply</p>
                  <p className="font-bold tabular-nums mt-0.5">
                    {selectedAsset.token_supply.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">NAV / Token</p>
                  <p className="font-bold font-mono tabular-nums mt-0.5">
                    ${selectedAsset.nav_per_token.toFixed(4)}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Issuer Wallet</p>
                <p className="font-mono text-xs mt-0.5 break-all text-muted-foreground">
                  {selectedAsset.issuer_wallet}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Approved Investors
            </CardTitle>
            <CardDescription>
              {assetApprovals.length} investors with approved trust lines
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assetApprovals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No approved investors yet.
              </p>
            ) : (
              <div className="space-y-2">
                {assetApprovals.map((a) => {
                  const h = holdings.find(
                    (hh) => hh.asset_id === selectedAssetId && hh.wallet_address === a.investor_address
                  )
                  const isSelected = selectedInvestor === a.investor_address
                  return (
                    <button
                      key={a.id}
                      onClick={() => setSelectedInvestor(a.investor_address)}
                      className={`w-full flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/30'
                      }`}
                    >
                      <div>
                        <p className="font-mono text-xs">
                          {a.investor_address.slice(0, 8)}...{a.investor_address.slice(-6)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {h ? `${h.token_balance.toLocaleString()} tokens held` : 'No tokens yet'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="text-xs bg-status-success text-success">
                          approved
                        </Badge>
                        {isSelected && <ArrowRight className="h-3.5 w-3.5 text-primary" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
