'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Zap,
  Play,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Clock,
  Activity,
  RefreshCw,
} from 'lucide-react'

interface OracleStatus {
  runs: Array<{
    id: string
    started_at: string
    completed_at: string | null
    assets_checked: number
    payments_detected: number
    distributions_triggered: number
    errors: number
    status: string
    log: Array<Record<string, unknown>>
  }>
  stats: {
    detected: number
    validated: number
    distributed: number
    flagged: number
    ignored: number
    total: number
  }
  flagged: Array<{
    id: string
    asset_id: string
    tx_hash: string
    sender_address: string
    amount: number
    currency: string
    match_confidence: number | null
    flagged_reason: string | null
    created_at: string
    assets: { asset_name: string } | null
  }>
  oracleAssetCount: number
}

const STATUS_ICON = {
  completed: <CheckCircle2 className="h-4 w-4 text-success" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-info" />,
  failed: <XCircle className="h-4 w-4 text-destructive" />,
}

export function OracleDashboard() {
  const [status, setStatus] = useState<OracleStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [reviewing, setReviewing] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/oracle/status')
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  async function triggerRun() {
    setRunning(true)
    try {
      const res = await fetch('/api/oracle/run', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await fetchStatus()
    } catch (err) {
      console.error('Oracle run failed:', err)
    } finally {
      setRunning(false)
    }
  }

  async function reviewPayment(paymentId: string, action: 'approve' | 'reject') {
    setReviewing(paymentId)
    try {
      await fetch('/api/oracle/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, action }),
      })
      await fetchStatus()
    } catch {
      // ignore
    } finally {
      setReviewing(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const stats = status?.stats ?? { detected: 0, validated: 0, distributed: 0, flagged: 0, ignored: 0, total: 0 }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Oracle Monitor
          </h1>
          <p className="text-base text-muted-foreground mt-1">
            Autonomous XRPL payment detection and distribution engine
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchStatus}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={triggerRun}
            disabled={running}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {running ? 'Running...' : 'Run Oracle'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-info" />
              <div>
                <p className="text-xs text-muted-foreground">Detected</p>
                <p className="text-2xl font-bold">{stats.detected}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <div>
                <p className="text-xs text-muted-foreground">Validated</p>
                <p className="text-2xl font-bold">{stats.validated}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Distributed</p>
                <p className="text-2xl font-bold">{stats.distributed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <div>
                <p className="text-xs text-muted-foreground">Flagged</p>
                <p className="text-2xl font-bold">{stats.flagged}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Oracle Assets</p>
                <p className="text-2xl font-bold">{status?.oracleAssetCount ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Flagged Payments — Need Review */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Payments Needing Review
            </CardTitle>
            <CardDescription>
              Payments below confidence threshold — approve or reject
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(status?.flagged ?? []).length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No flagged payments. All clear!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {status!.flagged.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border border-border p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {(p.assets as Record<string, string> | null)?.asset_name ?? 'Unknown Asset'}
                        </p>
                        <p className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">
                          tx: {p.tx_hash.slice(0, 16)}...
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono font-bold">
                          {p.amount.toLocaleString()} {p.currency}
                        </p>
                        {p.match_confidence != null && (
                          <Badge
                            className={`rounded-full text-xs ${
                              p.match_confidence >= 80
                                ? 'bg-status-warning text-warning'
                                : 'bg-status-danger text-destructive'
                            }`}
                          >
                            {p.match_confidence}% confidence
                          </Badge>
                        )}
                      </div>
                    </div>
                    {p.flagged_reason && (
                      <p className="text-xs text-muted-foreground">{p.flagged_reason}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => reviewPayment(p.id, 'approve')}
                        disabled={reviewing === p.id}
                        className="flex-1 rounded-lg bg-status-success px-3 py-1.5 text-xs font-medium text-success hover:bg-success/20 transition-colors disabled:opacity-50"
                      >
                        {reviewing === p.id ? 'Processing...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => reviewPayment(p.id, 'reject')}
                        disabled={reviewing === p.id}
                        className="flex-1 rounded-lg bg-status-danger px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Runs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Oracle Runs
            </CardTitle>
            <CardDescription>History of oracle execution cycles</CardDescription>
          </CardHeader>
          <CardContent>
            {(status?.runs ?? []).length === 0 ? (
              <div className="text-center py-12">
                <Clock className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No oracle runs yet. Click &ldquo;Run Oracle&rdquo; to start.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {status!.runs.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center gap-3">
                      {STATUS_ICON[run.status as keyof typeof STATUS_ICON] ?? STATUS_ICON.failed}
                      <div>
                        <p className="text-sm font-medium capitalize">{run.status}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(run.started_at).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground space-y-0.5">
                      <p>{run.assets_checked} assets checked</p>
                      <p>{run.payments_detected} payments found</p>
                      <p>{run.distributions_triggered} distributed</p>
                      {run.errors > 0 && (
                        <p className="text-destructive">{run.errors} errors</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
