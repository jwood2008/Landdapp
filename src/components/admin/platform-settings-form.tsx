'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sliders, Save, Loader2, ShieldCheck, Store, Globe, Coins } from 'lucide-react'
import type { PlatformSettingsRow } from '@/types/database'

interface Props {
  settings: PlatformSettingsRow | null
}

export function PlatformSettingsForm({ settings: initial }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    platform_name: initial?.platform_name ?? 'RWA Platform',
    domain_wallet: initial?.domain_wallet ?? '',
    require_kyc: initial?.require_kyc ?? true,
    require_aml: initial?.require_aml ?? true,
    require_accreditation: initial?.require_accreditation ?? false,
    auto_authorize_tokens: initial?.auto_authorize_tokens ?? true,
    marketplace_enabled: initial?.marketplace_enabled ?? true,
    marketplace_fee_bps: initial?.marketplace_fee_bps ?? 0,
    tokenization_fee_bps: initial?.tokenization_fee_bps ?? 100,
  })

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch('/api/platform/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSuccess(true)
      router.refresh()
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            General
          </CardTitle>
          <CardDescription>Platform identity and domain configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Platform Name</label>
            <input
              className="input w-full"
              value={form.platform_name}
              onChange={(e) => update('platform_name', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Domain Wallet (XRPL)</label>
            <input
              className="input w-full font-mono text-sm"
              value={form.domain_wallet}
              onChange={(e) => update('domain_wallet', e.target.value)}
              placeholder="rXXX... (optional platform-level wallet)"
            />
            <p className="text-[11px] text-muted-foreground">Optional. Used for platform-level operations like fee collection.</p>
          </div>
        </CardContent>
      </Card>

      {/* Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Compliance Requirements
          </CardTitle>
          <CardDescription>What investors need before they can participate</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle
            label="Require KYC Verification"
            description="Investors must complete KYC before trading or receiving tokens"
            checked={form.require_kyc}
            onChange={(v) => update('require_kyc', v)}
          />
          <Toggle
            label="Require AML Clearance"
            description="Investors must pass anti-money laundering checks"
            checked={form.require_aml}
            onChange={(v) => update('require_aml', v)}
          />
          <Toggle
            label="Require Accreditation"
            description="Only accredited investors can participate (SEC Reg D)"
            checked={form.require_accreditation}
            onChange={(v) => update('require_accreditation', v)}
          />
          <Toggle
            label="Auto-Authorize All Tokens"
            description="When an investor is approved, automatically create authorization records for all active tokens"
            checked={form.auto_authorize_tokens}
            onChange={(v) => update('auto_authorize_tokens', v)}
          />
        </CardContent>
      </Card>

      {/* Marketplace */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="h-4 w-4" />
            Marketplace
          </CardTitle>
          <CardDescription>Secondary market for token trading between approved investors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Toggle
            label="Enable Marketplace"
            description="Allow approved investors to buy and sell tokens on the platform"
            checked={form.marketplace_enabled}
            onChange={(v) => update('marketplace_enabled', v)}
          />
        </CardContent>
      </Card>

      {/* Fees */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-4 w-4" />
            Fee Collection
          </CardTitle>
          <CardDescription>Platform fees collected to the domain wallet on transactions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Tokenization Fee (basis points)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                className="input w-32 font-mono"
                value={form.tokenization_fee_bps}
                onChange={(e) => update('tokenization_fee_bps', parseInt(e.target.value) || 0)}
                min={0}
                max={1000}
              />
              <Badge variant="outline" className="text-xs">
                {(form.tokenization_fee_bps / 100).toFixed(2)}%
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Percentage of tokens sent to domain wallet on each primary market purchase. 100 bps = 1%.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Exchange Fee (basis points)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                className="input w-32 font-mono"
                value={form.marketplace_fee_bps}
                onChange={(e) => update('marketplace_fee_bps', parseInt(e.target.value) || 0)}
                min={0}
                max={1000}
              />
              <Badge variant="outline" className="text-xs">
                {(form.marketplace_fee_bps / 100).toFixed(2)}%
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Percentage of payment currency sent to domain wallet on each secondary market trade. 100 bps = 1%.
            </p>
          </div>
          {!form.domain_wallet && (
            <p className="text-xs text-amber-500">
              Set a Domain Wallet above to enable fee collection.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center justify-between">
        <div>
          {success && <p className="text-sm text-green-500">Settings saved successfully.</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          checked ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <span
          className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
