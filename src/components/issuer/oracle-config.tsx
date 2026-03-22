'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Zap, Plus, X, Loader2, Save, AlertTriangle } from 'lucide-react'

interface OracleConfig {
  operator_wallets: string[]
  auto_distribute: boolean
  confidence_threshold: number
  last_checked_ledger?: number
}

interface Props {
  assetId: string
  initialMethod: string
  initialConfig: OracleConfig | null
}

export function OracleConfigPanel({ assetId, initialMethod, initialConfig }: Props) {
  const [method, setMethod] = useState(initialMethod || 'manual')
  const [config, setConfig] = useState<OracleConfig>(
    initialConfig ?? {
      operator_wallets: [],
      auto_distribute: false,
      confidence_threshold: 90,
    }
  )
  const [newWallet, setNewWallet] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasChanges = method !== initialMethod ||
    JSON.stringify(config) !== JSON.stringify(initialConfig ?? { operator_wallets: [], auto_distribute: false, confidence_threshold: 90 })

  const save = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/oracle/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId,
          oracleMethod: method,
          oracleConfig: config,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }, [assetId, method, config])

  function addWallet() {
    const addr = newWallet.trim()
    if (!addr.startsWith('r') || addr.length < 25) {
      setError('Invalid XRPL address — must start with "r" and be 25-35 characters')
      return
    }
    if (config.operator_wallets.includes(addr)) {
      setError('Wallet already added')
      return
    }
    setConfig({ ...config, operator_wallets: [...config.operator_wallets, addr] })
    setNewWallet('')
    setError(null)
  }

  function removeWallet(addr: string) {
    setConfig({
      ...config,
      operator_wallets: config.operator_wallets.filter((w) => w !== addr),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Oracle Configuration
        </CardTitle>
        <CardDescription>
          Configure autonomous revenue monitoring and distribution
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Oracle Method */}
        <div>
          <label className="text-xs font-medium text-muted-foreground">Revenue Detection Method</label>
          <div className="grid grid-cols-2 gap-2 mt-1.5">
            <button
              onClick={() => setMethod('manual')}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                method === 'manual'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:border-primary/30'
              }`}
            >
              <p className="font-medium">Manual</p>
              <p className="text-xs text-muted-foreground mt-0.5">Issuer triggers distributions</p>
            </button>
            <button
              onClick={() => setMethod('lease_income')}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                method === 'lease_income'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:border-primary/30'
              }`}
            >
              <p className="font-medium">XRPL Oracle</p>
              <p className="text-xs text-muted-foreground mt-0.5">Auto-detect operator payments</p>
            </button>
          </div>
        </div>

        {method === 'lease_income' && (
          <>
            {/* Operator Wallets */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Operator Wallets
              </label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                XRPL addresses of companies that make revenue payments to this asset&apos;s wallet
              </p>

              {config.operator_wallets.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {config.operator_wallets.map((addr) => (
                    <div
                      key={addr}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                    >
                      <span className="font-mono text-xs truncate mr-2">{addr}</span>
                      <button
                        onClick={() => removeWallet(addr)}
                        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newWallet}
                  onChange={(e) => setNewWallet(e.target.value)}
                  placeholder="rAddress..."
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
                  onKeyDown={(e) => e.key === 'Enter' && addWallet()}
                />
                <button
                  onClick={addWallet}
                  className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Confidence Threshold */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Auto-Approve Threshold
              </label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                Payments with confidence score above this % are auto-distributed. Below → flagged for review.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={50}
                  max={100}
                  step={5}
                  value={config.confidence_threshold}
                  onChange={(e) =>
                    setConfig({ ...config, confidence_threshold: Number(e.target.value) })
                  }
                  className="flex-1"
                />
                <span className="text-sm font-mono font-medium w-12 text-right">
                  {config.confidence_threshold}%
                </span>
              </div>
            </div>

            {/* Auto-distribute toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Auto-Distribute
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Automatically distribute validated payments to token holders
                </p>
              </div>
              <button
                onClick={() => setConfig({ ...config, auto_distribute: !config.auto_distribute })}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  config.auto_distribute ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    config.auto_distribute ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            {config.auto_distribute && config.confidence_threshold < 80 && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-status-warning p-3">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-warning">
                  Low confidence threshold with auto-distribute enabled. Consider raising to 80%+ to avoid incorrect distributions.
                </p>
              </div>
            )}

            {/* Last checked info */}
            {config.last_checked_ledger && (
              <div className="text-xs text-muted-foreground">
                Last checked ledger: <span className="font-mono">{config.last_checked_ledger.toLocaleString()}</span>
              </div>
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        {/* Save button */}
        {hasChanges && (
          <button
            onClick={save}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              'Saved!'
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Oracle Config
              </>
            )}
          </button>
        )}
      </CardContent>
    </Card>
  )
}
