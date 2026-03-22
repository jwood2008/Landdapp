'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Wallet, Zap, Loader2, CheckCircle, AlertCircle, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  assetId: string
  ownerId: string | null
  ownerWallet: string | null
  tokenSymbol: string
  issuerWallet: string
  ownerRetainedPercent: number
  tokenSupply: number
}

export function OwnerWalletSettings({
  assetId,
  ownerId,
  ownerWallet: initialOwnerWallet,
  tokenSymbol,
  ownerRetainedPercent,
  tokenSupply,
}: Props) {
  const [ownerWallet, setOwnerWallet] = useState(initialOwnerWallet ?? '')
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const retainedTokens = Math.floor(tokenSupply * ownerRetainedPercent / 100)

  async function handleGenerate() {
    if (!ownerId) {
      setError('No owner assigned to this asset')
      return
    }
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/generate-owner-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: ownerId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setOwnerWallet(data.address)
      await saveWallet(data.address)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate wallet')
    } finally {
      setGenerating(false)
    }
  }

  async function saveWallet(address?: string) {
    const addr = address ?? ownerWallet.trim()
    if (!addr) return
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: dbErr } = await supabase
        .from('assets')
        .update({ owner_wallet: addr })
        .eq('id', assetId)
      if (dbErr) throw dbErr
      setSuccess('Owner wallet saved')
      setMode('view')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleSendRetained() {
    setSending(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/admin/send-retained-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess(data.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send tokens')
    } finally {
      setSending(false)
    }
  }

  if (!ownerId || ownerRetainedPercent <= 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          Owner Personal Wallet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {ownerWallet && mode === 'view' ? (
          <>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
              <code className="text-xs font-mono break-all flex-1">{ownerWallet}</code>
              <Badge className="text-[9px] bg-status-success text-success shrink-0">Set</Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Retained: {retainedTokens} {tokenSymbol} ({ownerRetainedPercent}%)</span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMode('edit')}
                className="text-xs"
              >
                Change
              </Button>
              <Button
                size="sm"
                onClick={handleSendRetained}
                disabled={sending}
                className="text-xs gap-1.5"
              >
                {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                {sending ? 'Sending...' : `Send ${retainedTokens} ${tokenSymbol}`}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {ownerWallet ? 'Update the owner\'s personal wallet address.' : 'Set a wallet to receive retained tokens.'}
            </p>
            <div className="space-y-2">
              <input
                value={ownerWallet}
                onChange={(e) => setOwnerWallet(e.target.value)}
                placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                className="input font-mono text-xs w-full"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="text-xs gap-1.5"
                >
                  {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                  Generate
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveWallet()}
                  disabled={saving || !ownerWallet.trim()}
                  className="text-xs"
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                {initialOwnerWallet && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setOwnerWallet(initialOwnerWallet); setMode('view') }}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-1.5 text-xs text-success">
            <CheckCircle className="h-3 w-3 shrink-0" />
            {success}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
