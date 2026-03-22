'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Store, CheckCircle } from 'lucide-react'
import { XamanSignModal } from '@/components/admin/xaman-sign-modal'

interface Asset {
  id: string
  asset_name: string
  token_symbol: string
  issuer_wallet: string
  nav_per_token: number
  token_supply: number
}

interface ListOnDexProps {
  assets: Asset[]
}

export function ListOnDex({ assets }: ListOnDexProps) {
  const router = useRouter()
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'RLUSD' | 'XRP'>('RLUSD')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [xamanUuid, setXamanUuid] = useState<string | null>(null)
  const [xamanQrUrl, setXamanQrUrl] = useState<string | null>(null)
  const [xamanDeepLink, setXamanDeepLink] = useState<string | null>(null)

  const selectedAsset = assets.find((a) => a.id === selectedAssetId)

  async function listTokens() {
    if (!selectedAsset || !amount || parseFloat(amount) <= 0) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/xrpl/list-on-dex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: selectedAsset.id,
          issuerAddress: selectedAsset.issuer_wallet,
          tokenAmount: parseFloat(amount),
          tokenSymbol: selectedAsset.token_symbol,
          pricePerToken: selectedAsset.nav_per_token,
          currency,
        }),
      })
      const data = await res.json()

      if (data.error) throw new Error(data.error)

      if (data.uuid) {
        setXamanUuid(data.uuid)
        setXamanQrUrl(data.qrUrl)
        setXamanDeepLink(data.deepLink)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create listing')
    } finally {
      setSubmitting(false)
    }
  }

  function handleSigned() {
    setXamanUuid(null)
    setXamanQrUrl(null)
    setXamanDeepLink(null)
    setSuccess(`Listed ${amount} ${selectedAsset?.token_symbol} on the DEX!`)
    setAmount('')
    router.refresh()
    setTimeout(() => setSuccess(null), 5000)
  }

  function handleCancel() {
    setXamanUuid(null)
    setXamanQrUrl(null)
    setXamanDeepLink(null)
  }

  return (
    <>
      {xamanUuid && (
        <XamanSignModal
          uuid={xamanUuid}
          qrUrl={xamanQrUrl}
          deepLink={xamanDeepLink}
          instruction={`List ${amount} ${selectedAsset?.token_symbol ?? 'tokens'} on DEX at $${selectedAsset?.nav_per_token.toFixed(4)} (${currency})`}
          onSigned={handleSigned}
          onExpired={handleCancel}
          onCancel={handleCancel}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="h-4 w-4" />
            List Tokens on DEX
          </CardTitle>
          <CardDescription>
            Place issuer sell offers on the XRPL DEX so investors can buy tokens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Asset selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Asset</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => setSelectedAssetId(asset.id)}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    selectedAssetId === asset.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{asset.asset_name}</span>
                    <Badge variant="outline" className="text-xs">{asset.token_symbol}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    NAV: ${asset.nav_per_token.toFixed(4)} · Supply: {asset.token_supply.toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {selectedAsset && (
            <>
              {/* Currency toggle */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Sell for</label>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-border p-1">
                  <button
                    onClick={() => setCurrency('RLUSD')}
                    className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                      currency === 'RLUSD'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted/30'
                    }`}
                  >
                    RLUSD
                  </button>
                  <button
                    onClick={() => setCurrency('XRP')}
                    className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                      currency === 'XRP'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted/30'
                    }`}
                  >
                    XRP
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Token Amount</label>
                <input
                  type="number"
                  className="input w-full font-mono"
                  placeholder="e.g. 50000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="0"
                  max={selectedAsset.token_supply}
                />
              </div>

              {/* Summary */}
              {parseFloat(amount || '0') > 0 && (
                <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tokens</span>
                    <span className="font-mono">{parseFloat(amount).toLocaleString()} {selectedAsset.token_symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Price each</span>
                    <span className="font-mono">${selectedAsset.nav_per_token.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Total listing value</span>
                    <span className="font-mono">
                      ${(parseFloat(amount) * selectedAsset.nav_per_token).toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency}
                    </span>
                  </div>
                </div>
              )}

              {error && <p className="text-xs text-destructive">{error}</p>}
              {success && (
                <div className="flex items-center gap-2 text-xs text-success">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {success}
                </div>
              )}

              <Button
                onClick={listTokens}
                disabled={submitting || !amount || parseFloat(amount) <= 0}
                className="w-full gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Store className="h-4 w-4" />
                )}
                {submitting ? 'Creating listing...' : `List ${selectedAsset.token_symbol} on DEX`}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </>
  )
}
