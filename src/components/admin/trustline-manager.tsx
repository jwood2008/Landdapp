'use client'

import { useState } from 'react'
import {
  Shield, ShieldCheck, ShieldAlert, Loader2, Plus, Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { XamanSignModal } from '@/components/admin/xaman-sign-modal'

interface TrustlineManagerProps {
  issuerWallet: string
  tokenSymbol: string
}

function truncAddr(a: string) {
  return `${a.slice(0, 10)}...${a.slice(-6)}`
}

export function TrustlineManager({ issuerWallet, tokenSymbol }: TrustlineManagerProps) {
  const [walletInput, setWalletInput] = useState('')
  const [currency, setCurrency] = useState(tokenSymbol)
  const [checking, setChecking] = useState(false)
  const [results, setResults] = useState<Array<{ address: string; hasTrustline: boolean }> | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Xaman modal state
  const [xamanUuid, setXamanUuid] = useState<string | null>(null)
  const [xamanQrUrl, setXamanQrUrl] = useState<string | null>(null)
  const [xamanDeepLink, setXamanDeepLink] = useState<string | null>(null)
  const [creatingFor, setCreatingFor] = useState<string | null>(null)

  async function checkTrustlines() {
    const wallets = walletInput
      .split(/[\n,]+/)
      .map((w) => w.trim())
      .filter((w) => w.startsWith('r') && w.length >= 25)

    if (!wallets.length) {
      setError('Enter at least one valid XRPL wallet address (starts with r)')
      return
    }

    setChecking(true)
    setError(null)
    setResults(null)

    try {
      const params = new URLSearchParams({
        wallets: wallets.join(','),
        currency,
        issuerWallet,
      })

      const res = await fetch(`/api/xrpl/check-trustlines?${params}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResults(data.results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check trustlines')
    } finally {
      setChecking(false)
    }
  }

  async function createTrustline(address: string) {
    setCreatingFor(address)
    setError(null)

    try {
      const res = await fetch('/api/xrpl/create-trustline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investorAddress: address,
          currency,
          issuerWallet,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      if (data.custodial) {
        // Custodial wallet — signed and submitted automatically, no Xaman needed
        if (results) {
          setResults(results.map((r) =>
            r.address === address ? { ...r, hasTrustline: true } : r
          ))
        }
        setCreatingFor(null)
      } else {
        // External wallet — needs Xaman signing
        setXamanUuid(data.uuid)
        setXamanQrUrl(data.qrUrl)
        setXamanDeepLink(data.deepLink)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trustline request')
      setCreatingFor(null)
    }
  }

  function handleSigned() {
    // Mark the wallet as having a trustline
    if (creatingFor && results) {
      setResults(results.map((r) =>
        r.address === creatingFor ? { ...r, hasTrustline: true } : r
      ))
    }
    setCreatingFor(null)
    closeModal()
  }

  function handleExpired() {
    setCreatingFor(null)
    closeModal()
    setError('Signing request expired. Try again.')
  }

  function handleCancel() {
    setCreatingFor(null)
    closeModal()
  }

  function closeModal() {
    setXamanUuid(null)
    setXamanQrUrl(null)
    setXamanDeepLink(null)
  }

  const missing = results?.filter((r) => !r.hasTrustline) ?? []
  const ready = results?.filter((r) => r.hasTrustline) ?? []

  return (
    <>
      {xamanUuid && (
        <XamanSignModal
          uuid={xamanUuid}
          qrUrl={xamanQrUrl}
          deepLink={xamanDeepLink}
          instruction={
            creatingFor
              ? `Investor ${truncAddr(creatingFor)} must sign to create ${currency} trust line`
              : 'Sign trust line creation'
          }
          onSigned={handleSigned}
          onExpired={handleExpired}
          onCancel={handleCancel}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Trust Line Manager
          </CardTitle>
          <CardDescription>
            Check and create trust lines for investor wallets so they can hold your token
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Currency selector */}
          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Wallet Addresses</label>
              <textarea
                value={walletInput}
                onChange={(e) => setWalletInput(e.target.value)}
                placeholder="rAddr1, rAddr2 (comma or newline separated)"
                className="input w-full text-xs font-mono min-h-[60px] resize-y"
                rows={2}
              />
            </div>
            <div className="space-y-1.5 w-32">
              <label className="text-xs font-medium text-muted-foreground">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="input w-full text-sm"
              >
                <option value={tokenSymbol}>{tokenSymbol}</option>
                <option value="RLUSD">RLUSD</option>
              </select>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={checkTrustlines}
            disabled={checking || !walletInput.trim()}
          >
            {checking ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking...</>
            ) : (
              <><Search className="h-3.5 w-3.5" /> Check Trust Lines</>
            )}
          </Button>

          {error && (
            <p className="text-xs text-destructive flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}

          {/* Results */}
          {results && (
            <div className="space-y-2">
              {ready.length > 0 && (
                <div className="space-y-1">
                  {ready.map((r) => (
                    <div key={r.address} className="flex items-center justify-between rounded-md bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                        <span className="text-xs font-mono">{truncAddr(r.address)}</span>
                      </div>
                      <Badge variant="default" className="text-[10px]">Ready</Badge>
                    </div>
                  ))}
                </div>
              )}

              {missing.length > 0 && (
                <div className="space-y-1">
                  {missing.map((r) => (
                    <div key={r.address} className="flex items-center justify-between rounded-md bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-mono">{truncAddr(r.address)}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] gap-1 border-amber-300 dark:border-amber-700"
                        onClick={() => createTrustline(r.address)}
                        disabled={creatingFor === r.address}
                      >
                        {creatingFor === r.address ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Creating...</>
                        ) : (
                          <><Plus className="h-3 w-3" /> Create Trust Line</>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {results.length > 0 && missing.length === 0 && (
                <p className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  All wallets have {currency} trust lines.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
