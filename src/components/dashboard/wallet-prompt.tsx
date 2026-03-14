'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Wallet, KeyRound } from 'lucide-react'
import { useWalletStore } from '@/store/wallet'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Separator } from '@/components/ui/separator'
import { XamanSignIn } from '@/components/wallet/xaman-signin'

function isValidXrplAddress(address: string) {
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address)
}

async function saveWallet(userId: string, walletAddress: string) {
  const supabase = createClient()
  const { error } = await supabase.from('wallets').upsert(
    { user_id: userId, address: walletAddress, is_primary: true },
    { onConflict: 'address' }
  )
  if (error) throw error
  fetch('/api/sync-holdings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress }),
  }).catch(() => null)
}

export function WalletPrompt({ userId }: { userId: string }) {
  const { connect } = useWalletStore()
  const [showXaman, setShowXaman] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manualAddress, setManualAddress] = useState('')
  const router = useRouter()

  async function handleXamanSuccess(address: string) {
    setLoading(true)
    setError(null)
    try {
      connect(address)
      await saveWallet(userId, address)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link wallet')
    } finally {
      setLoading(false)
    }
  }

  async function handleManual() {
    const trimmed = manualAddress.trim()
    if (!isValidXrplAddress(trimmed)) {
      setError('Invalid address — must start with r and be 25–35 characters.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      connect(trimmed)
      await saveWallet(userId, trimmed)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link wallet')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Wallet className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Connect your wallet</CardTitle>
        <CardDescription>
          Link your XRPL wallet to view your tokenized asset holdings and distributions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive text-center">{error}</p>}

        {showXaman ? (
          <XamanSignIn
            onSuccess={handleXamanSuccess}
            onCancel={() => setShowXaman(false)}
          />
        ) : (
          <Button
            onClick={() => { setShowXaman(true); setError(null) }}
            disabled={loading}
            className="w-full gap-2"
          >
            <Wallet className="h-4 w-4" />
            Connect with Xaman
          </Button>
        )}

        {!showXaman && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">or enter address manually</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5" />
                <span>Dev / testnet mode — paste any XRPL address</span>
              </div>
              <div className="flex gap-2">
                <input
                  value={manualAddress}
                  onChange={e => setManualAddress(e.target.value)}
                  placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                  className="input font-mono text-xs flex-1"
                  onKeyDown={e => e.key === 'Enter' && handleManual()}
                />
                <Button
                  onClick={handleManual}
                  disabled={loading || !manualAddress.trim()}
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                >
                  Link
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
