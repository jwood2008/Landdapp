'use client'

import { useEffect, useState } from 'react'
import { DollarSign, Coins, Check } from 'lucide-react'

const CURRENCY_OPTIONS = [
  {
    value: 'USD',
    label: 'US Dollar',
    sublabel: 'Receive payments in USD (auto-converted via RLUSD)',
    icon: DollarSign,
  },
  {
    value: 'RLUSD',
    label: 'RLUSD',
    sublabel: 'Receive payments as RLUSD stablecoin on-chain',
    icon: DollarSign,
  },
  {
    value: 'XRP',
    label: 'XRP',
    sublabel: 'Receive payments in native XRP',
    icon: Coins,
  },
] as const

export function PaymentSettings() {
  const [selected, setSelected] = useState<string>('USD')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/investor/payment-preference')
      .then((r) => r.json())
      .then((data) => {
        if (data.receiveCurrency) setSelected(data.receiveCurrency)
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  async function handleSelect(currency: string) {
    if (currency === selected) return
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const res = await fetch('/api/investor/payment-preference', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiveCurrency: currency }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to update preference')
        return
      }

      setSelected(currency)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Failed to update preference')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-20 rounded-lg border border-border bg-muted/30 animate-pulse" />
        <div className="h-20 rounded-lg border border-border bg-muted/30 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {CURRENCY_OPTIONS.map((option) => {
        const isSelected = selected === option.value
        const Icon = option.icon

        return (
          <button
            key={option.value}
            onClick={() => handleSelect(option.value)}
            disabled={saving}
            className={`w-full flex items-center gap-4 rounded-lg border p-4 text-left transition-colors ${
              isSelected
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
            } ${saving ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{option.label}</span>
                {isSelected && <Check className="h-4 w-4 text-primary" />}
              </div>
              <p className="text-sm text-muted-foreground">{option.sublabel}</p>
            </div>
          </button>
        )
      })}

      {saved && (
        <p className="text-sm text-emerald-500 flex items-center gap-1">
          <Check className="h-3.5 w-3.5" />
          Payment preference updated
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <p className="text-xs text-muted-foreground">
        When someone sends you a payment in a different currency, the platform automatically
        converts it to your preferred currency. You won&apos;t need to do anything extra.
      </p>
    </div>
  )
}
