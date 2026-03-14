'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Wallet, Loader2, Copy, Check } from 'lucide-react'
import { useWalletStore } from '@/store/wallet'

interface WalletStatusBarProps {
  walletAddress: string | null
}

export function WalletStatusBar({ walletAddress }: WalletStatusBarProps) {
  const router = useRouter()
  const { connect, status } = useWalletStore()
  const [address, setAddress] = useState<string | null>(walletAddress)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(false)
  const attempted = useRef(false)

  // Auto-create wallet if user doesn't have one yet
  useEffect(() => {
    if (address || attempted.current) return
    attempted.current = true

    async function ensureWallet() {
      setCreating(true)
      try {
        const res = await fetch('/api/wallet/ensure-custodial', { method: 'POST' })
        const data = await res.json()
        if (data.address) {
          setAddress(data.address)
          if (status !== 'connected') {
            connect(data.address)
          }
          router.refresh()
        }
      } catch {
        // Silent — will retry on next page load
      } finally {
        setCreating(false)
      }
    }

    ensureWallet()
  }, [address, connect, status, router])

  // Sync wallet store if address exists but store isn't connected
  useEffect(() => {
    if (address && status !== 'connected') {
      connect(address)
    }
  }, [address, status, connect])

  function copyAddress() {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Wallet exists — show compact status
  if (address) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500/10">
            <Wallet className="h-3.5 w-3.5 text-green-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">Platform Wallet</span>
              <Badge className="text-[9px] bg-green-500/10 text-green-500">Active</Badge>
            </div>
            <button
              onClick={copyAddress}
              className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              {address.slice(0, 10)}...{address.slice(-6)}
              {copied ? (
                <Check className="h-2.5 w-2.5 text-green-500" />
              ) : (
                <Copy className="h-2.5 w-2.5" />
              )}
            </button>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground">Managed by platform</span>
      </div>
    )
  }

  // Creating wallet automatically — show loading
  if (creating) {
    return (
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
        </div>
        <div>
          <p className="text-sm font-medium">Setting up your wallet...</p>
          <p className="text-xs text-muted-foreground">
            Creating a secure XRPL wallet for your account.
          </p>
        </div>
      </div>
    )
  }

  return null
}
