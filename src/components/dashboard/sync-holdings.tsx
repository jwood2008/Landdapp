'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SyncResult {
  synced?: number
  trustlineCount?: number
  message?: string
  error?: string
  assets?: string[]
  trustlines?: { currency: string; balance: string; account: string }[]
  xrplBalances?: { symbol: string; balance: number; ownership: number }[]
}

export function SyncHoldings({ walletAddress }: { walletAddress: string }) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const didAutoSync = useRef(false)

  async function sync() {
    setSyncing(true)
    setResult(null)
    try {
      const res = await fetch('/api/sync-holdings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      })
      const data: SyncResult = await res.json()
      setResult(data)
      if (!data.error) {
        router.refresh()
      }
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Network error' })
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (didAutoSync.current) return
    didAutoSync.current = true
    sync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress])

  const hasError = !!result?.error
  const synced = result?.synced ?? 0

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="ghost"
        onClick={sync}
        disabled={syncing}
        className="gap-1.5 py-2.5 px-4 text-muted-foreground"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? 'Syncing...' : 'Refresh holdings'}
      </Button>

      {result && !syncing && (
        <div className="flex items-center gap-1.5 text-xs">
          {hasError ? (
            <>
              <AlertCircle className="h-3 w-3 text-warning shrink-0" />
              <span className="text-muted-foreground max-w-xs truncate" title={result.error}>
                {result.error?.includes('unreachable') || result.error?.includes('fetch failed')
                  ? 'XRPL unavailable — showing cached data'
                  : result.error}
              </span>
            </>
          ) : synced > 0 ? (
            <>
              <CheckCircle className="h-3 w-3 text-success" />
              <span className="text-muted-foreground">
                Synced from XRPL{result.xrplBalances?.length ? `: ${result.xrplBalances.map(b => `${b.balance} ${b.symbol} (${b.ownership.toFixed(1)}%)`).join(', ')}` : ''}
              </span>
            </>
          ) : (
            <>
              <CheckCircle className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                Up to date
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
