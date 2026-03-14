'use client'

import { useState, useEffect } from 'react'
import { Wallet, LogOut, Copy, Check, ChevronDown, KeyRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/lib/button-variants'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useWalletStore } from '@/store/wallet'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { XamanSignIn } from '@/components/wallet/xaman-signin'

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function isValidXrplAddress(address: string) {
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address)
}

export function ConnectWalletButton({ className }: { className?: string }) {
  const { address, status, connect, disconnect } = useWalletStore()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showXaman, setShowXaman] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [manualAddress, setManualAddress] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])

  async function handleXamanSuccess(addr: string) {
    try {
      // Delete custodial wallet and switch to Xaman wallet
      await fetch('/api/wallet/switch-to-xaman', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xamanAddress: addr }),
      })
    } catch {
      // Non-fatal — wallet store still gets updated
    }
    connect(addr)
    setShowXaman(false)
    setError(null)
    router.refresh()
  }

  function handleManualConnect() {
    const trimmed = manualAddress.trim()
    if (!isValidXrplAddress(trimmed)) {
      setError('Invalid XRPL address. Must start with r.')
      return
    }
    connect(trimmed)
    setManualAddress('')
    setShowManual(false)
    setError(null)
  }

  async function handleDisconnect() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('wallets')
        .update({ is_primary: false })
        .eq('user_id', user.id)
    }
    disconnect()
    router.refresh()
  }

  async function handleCopy() {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Render a stable placeholder during SSR to prevent hydration mismatch
  // (wallet store state differs server vs client, shifting the React tree)
  if (!mounted) {
    return (
      <div className={cn('h-9 w-[148px] rounded-lg bg-muted animate-pulse', className)} />
    )
  }

  if (status === 'connected' && address) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(buttonVariants({ variant: 'outline' }), 'gap-2', className)}
        >
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="font-mono text-sm">{truncateAddress(address)}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-3 py-2">
            <p className="text-xs text-muted-foreground">Connected wallet</p>
            <p className="mt-0.5 font-mono text-xs break-all">{address}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCopy} className="gap-2">
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy address'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDisconnect} className="gap-2 text-destructive">
            <LogOut className="h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (showXaman) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 w-64">
        <XamanSignIn
          onSuccess={handleXamanSuccess}
          onCancel={() => setShowXaman(false)}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <Button onClick={() => { setShowXaman(true); setError(null) }} className={cn('gap-2', className)}>
          <Wallet className="h-4 w-4" />
          Connect Wallet
        </Button>
        <button
          onClick={() => { setShowManual(v => !v); setError(null) }}
          title="Enter address manually (dev/testnet)"
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            showManual && 'bg-muted text-foreground'
          )}
        >
          {showManual ? <X className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
        </button>
      </div>

      {showManual && (
        <div className="flex items-center gap-2 w-full max-w-xs">
          <input
            value={manualAddress}
            onChange={e => setManualAddress(e.target.value)}
            placeholder="rXXXX... testnet address"
            className="input font-mono text-xs h-8 flex-1"
            onKeyDown={e => e.key === 'Enter' && handleManualConnect()}
            autoFocus
          />
          <Button size="sm" onClick={handleManualConnect} className="h-8 shrink-0">
            Use
          </Button>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
