'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Wallet, ShieldCheck, Eye, EyeOff, Copy, Check, Loader2, AlertTriangle, Coins } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CustodialWallet {
  id: string
  user_id: string | null
  address: string
  encryption_method: string
  is_primary: boolean
  wallet_type: 'investor' | 'token'
  label: string | null
  asset_id: string | null
  created_at: string
}

interface UserInfo {
  email: string
  full_name: string | null
}

interface AssetInfo {
  asset_name: string
  token_symbol: string
}

interface Props {
  wallets: CustodialWallet[]
  userMap: Record<string, UserInfo>
  assetMap?: Record<string, AssetInfo>
}

export function CustodialWalletsTable({ wallets, userMap, assetMap = {} }: Props) {
  const [revealingId, setRevealingId] = useState<string | null>(null)
  const [revealedSeed, setRevealedSeed] = useState<string | null>(null)
  const [revealedAddress, setRevealedAddress] = useState<string | null>(null)
  const [revealedLabel, setRevealedLabel] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingWalletId, setPendingWalletId] = useState<string | null>(null)
  const [copied, setCopied] = useState<'address' | 'seed' | null>(null)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState(false)

  const tokenWallets = wallets.filter((w) => w.wallet_type === 'token')
  const investorWallets = wallets.filter((w) => w.wallet_type === 'investor')

  async function revealKey(walletId: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/wallet-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setRevealedSeed(data.seed)
      setRevealedAddress(data.address)
      setRevealingId(walletId)

      const wallet = wallets.find((w) => w.id === walletId)
      if (wallet) {
        if (wallet.wallet_type === 'token') {
          const asset = wallet.asset_id ? assetMap[wallet.asset_id] : null
          setRevealedLabel(asset ? `${asset.asset_name} (${asset.token_symbol})` : (wallet.label ?? 'Token Wallet'))
        } else {
          const user = wallet.user_id ? userMap[wallet.user_id] : null
          setRevealedLabel(user ? `${user.full_name ?? 'Unknown'} — ${user.email}` : 'Unknown User')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reveal key')
    } finally {
      setLoading(false)
      setShowConfirm(false)
      setPendingWalletId(null)
    }
  }

  function handleRevealClick(walletId: string) {
    setPendingWalletId(walletId)
    setPassword('')
    setPasswordError(false)
    setShowConfirm(true)
  }

  function handleConfirmReveal() {
    if (password !== '08272005') {
      setPasswordError(true)
      return
    }
    setPasswordError(false)
    if (pendingWalletId) revealKey(pendingWalletId)
  }

  function closeReveal() {
    setRevealingId(null)
    setRevealedSeed(null)
    setRevealedAddress(null)
    setRevealedLabel(null)
    setError(null)
  }

  function copyToClipboard(text: string, type: 'address' | 'seed') {
    navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  function renderRevealButton(walletId: string) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1 text-warning hover:text-warning hover:bg-status-warning"
        onClick={() => handleRevealClick(walletId)}
      >
        <Eye className="h-3 w-3" />
        Reveal
      </Button>
    )
  }

  return (
    <>
      {/* Confirmation dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              Reveal Private Key?
            </DialogTitle>
            <DialogDescription>
              This will decrypt and display the wallet&apos;s secret seed. This action is logged for security audit.
              Never share this key with anyone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 px-1">
            <label className="text-xs font-medium text-muted-foreground">
              Enter admin password to continue
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setPasswordError(false)
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmReveal()}
              placeholder="Enter password..."
              className={cn(
                'w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-warning/50',
                passwordError ? 'border-destructive focus:ring-destructive/50' : 'border-border'
              )}
              autoFocus
            />
            {passwordError && (
              <p className="text-xs text-destructive">Incorrect password. Please try again.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button
              className="bg-destructive hover:bg-destructive/90 text-white font-semibold gap-1.5 shadow-md"
              onClick={handleConfirmReveal}
              disabled={loading || !password}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
              {loading ? 'Decrypting...' : 'Reveal Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revealed key dialog */}
      <Dialog open={!!revealingId} onOpenChange={closeReveal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-success" />
              Wallet Private Key
            </DialogTitle>
            <DialogDescription>
              {revealedLabel}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Wallet Address</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted/40 px-3 py-2 text-xs font-mono break-all">
                  {revealedAddress}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  onClick={() => revealedAddress && copyToClipboard(revealedAddress, 'address')}
                >
                  {copied === 'address' ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-destructive">Secret Seed (Private Key)</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-destructive/5 border border-destructive/20 px-3 py-2 text-xs font-mono break-all text-destructive">
                  {revealedSeed}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  onClick={() => revealedSeed && copyToClipboard(revealedSeed, 'seed')}
                >
                  {copied === 'seed' ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-xs text-destructive/70">
                Anyone with this key has full control of this wallet. Keep it secure.
              </p>
            </div>

            <Button variant="outline" className="w-full" onClick={closeReveal}>
              <EyeOff className="h-3.5 w-3.5 mr-1.5" />
              Hide Key
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Global error */}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* ── Token Wallets ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-4 w-4" />
            Token Wallets
          </CardTitle>
          <CardDescription>
            Issuer wallets for tokenized assets. These sign token issuance and distribution transactions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tokenWallets.length === 0 ? (
            <div className="py-6 text-center">
              <Coins className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No token wallets yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Token wallets are generated when you create an asset.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="text-left px-4 py-2 text-muted-foreground font-medium">Label / Asset</th>
                    <th className="text-left px-4 py-2 text-muted-foreground font-medium">Wallet Address</th>
                    <th className="text-center px-4 py-2 text-muted-foreground font-medium">Encryption</th>
                    <th className="text-left px-4 py-2 text-muted-foreground font-medium">Created</th>
                    <th className="text-center px-4 py-2 text-muted-foreground font-medium">Key</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tokenWallets.map((wallet) => {
                    const asset = wallet.asset_id ? assetMap[wallet.asset_id] : null
                    return (
                      <tr key={wallet.id} className="hover:bg-muted/10">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {asset ? `${asset.asset_name}` : (wallet.label ?? 'Token Wallet')}
                            </span>
                            {asset && (
                              <Badge variant="outline" className="text-xs">{asset.token_symbol}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground">
                          {wallet.address}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge variant="outline" className="text-xs gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            {wallet.encryption_method}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {new Date(wallet.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {renderRevealButton(wallet.id)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Investor Wallets ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Investor Wallets
          </CardTitle>
          <CardDescription>
            Platform-managed wallets created for investors. Seeds are encrypted with AES-256-GCM.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {investorWallets.length === 0 ? (
            <div className="py-6 text-center">
              <Wallet className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No investor wallets created yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Wallets are created when investors click &ldquo;Create Wallet&rdquo; on their dashboard.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="text-left px-4 py-2 text-muted-foreground font-medium">Investor</th>
                    <th className="text-left px-4 py-2 text-muted-foreground font-medium">Wallet Address</th>
                    <th className="text-center px-4 py-2 text-muted-foreground font-medium">Encryption</th>
                    <th className="text-center px-4 py-2 text-muted-foreground font-medium">Primary</th>
                    <th className="text-left px-4 py-2 text-muted-foreground font-medium">Created</th>
                    <th className="text-center px-4 py-2 text-muted-foreground font-medium">Key</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {investorWallets.map((wallet) => {
                    const user = wallet.user_id ? userMap[wallet.user_id] : null
                    return (
                      <tr key={wallet.id} className="hover:bg-muted/10">
                        <td className="px-4 py-2.5">
                          <div>
                            <span className="font-medium">{user?.full_name ?? 'Unknown'}</span>
                            {user?.email && (
                              <span className="text-muted-foreground ml-2">{user.email}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground">
                          {wallet.address}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge variant="outline" className="text-xs gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            {wallet.encryption_method}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {wallet.is_primary ? (
                            <Badge className="text-xs bg-status-success text-success">Yes</Badge>
                          ) : (
                            <span className="text-muted-foreground">No</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {new Date(wallet.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {renderRevealButton(wallet.id)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
