'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Wallet, Plus, Trash2, Star, KeyRound, X, Zap, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useWalletStore } from '@/store/wallet'
import { XamanSignIn } from '@/components/wallet/xaman-signin'

interface WalletEntry {
  id: string
  address: string
  label: string | null
  is_primary: boolean
  created_at: string
}

interface WalletManagerProps {
  userId: string
  wallets: WalletEntry[]
}

function truncateAddress(address: string) {
  return `${address.slice(0, 10)}...${address.slice(-8)}`
}

function isValidXrplAddress(address: string) {
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address)
}

export function WalletManager({ userId, wallets }: WalletManagerProps) {
  const router = useRouter()
  const { connect } = useWalletStore()
  const [showXaman, setShowXaman] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [manualAddress, setManualAddress] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function upsertWallet(address: string) {
    const isPrimary = wallets.length === 0
    const supabase = createClient()
    const { error: dbError } = await supabase.from('wallets').upsert(
      { user_id: userId, address, is_primary: isPrimary },
      { onConflict: 'address' }
    )
    if (dbError) throw dbError
    if (isPrimary) connect(address)
    fetch('/api/sync-holdings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: address }),
    }).catch(() => null)
    router.refresh()
  }

  async function handleXamanSuccess(address: string) {
    setConnecting(true)
    setError(null)
    try {
      await upsertWallet(address)
      setShowXaman(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add wallet')
    } finally {
      setConnecting(false)
    }
  }

  async function handleAddManual() {
    const trimmed = manualAddress.trim()
    if (!isValidXrplAddress(trimmed)) {
      setError('Invalid XRPL address.')
      return
    }
    setConnecting(true)
    setError(null)
    try {
      await upsertWallet(trimmed)
      setManualAddress('')
      setShowManual(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add wallet')
    } finally {
      setConnecting(false)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/wallet/create-custodial', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await upsertWallet(data.address)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate wallet')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSetPrimary(walletId: string, address: string) {
    const supabase = createClient()
    await supabase.from('wallets').update({ is_primary: false }).eq('user_id', userId)
    await supabase.from('wallets').update({ is_primary: true }).eq('id', walletId)
    connect(address)
    router.refresh()
  }

  async function handleRemove(walletId: string) {
    const supabase = createClient()
    await supabase.from('wallets').delete().eq('id', walletId)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {wallets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <Wallet className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No wallets connected yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {wallets.map((wallet) => (
            <div
              key={wallet.id}
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">{truncateAddress(wallet.address)}</span>
                  {wallet.is_primary && (
                    <Badge className="text-xs gap-1">
                      <Star className="h-2.5 w-2.5" />
                      Primary
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Added {new Date(wallet.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {!wallet.is_primary && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetPrimary(wallet.id, wallet.address)}
                    className="text-xs gap-1"
                  >
                    <Star className="h-3.5 w-3.5" />
                    Set primary
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(wallet.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {showXaman && (
        <div className="rounded-lg border border-border bg-card p-4">
          <XamanSignIn
            onSuccess={handleXamanSuccess}
            onCancel={() => setShowXaman(false)}
          />
        </div>
      )}

      {!showXaman && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleGenerate}
            disabled={connecting || generating}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {generating ? 'Generating...' : 'Generate Wallet'}
          </Button>

          <Button
            onClick={() => { setShowXaman(true); setError(null) }}
            disabled={connecting || generating}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add via Xaman
          </Button>

          <Button
            onClick={() => { setShowManual(v => !v); setError(null) }}
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
          >
            {showManual ? <X className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
            {showManual ? 'Cancel' : 'Manual / testnet'}
          </Button>
        </div>
      )}

      {showManual && !showXaman && (
        <div className="flex gap-2">
          <input
            value={manualAddress}
            onChange={e => setManualAddress(e.target.value)}
            placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXX"
            className="input font-mono text-xs flex-1"
            onKeyDown={e => e.key === 'Enter' && handleAddManual()}
            autoFocus
          />
          <Button
            onClick={handleAddManual}
            disabled={connecting || !manualAddress.trim()}
            size="sm"
            className="shrink-0"
          >
            Add
          </Button>
        </div>
      )}
    </div>
  )
}
