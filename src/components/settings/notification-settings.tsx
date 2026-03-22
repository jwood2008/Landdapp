'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Bell, ShoppingCart, Coins, UserCheck, Loader2 } from 'lucide-react'

interface Preferences {
  trade_confirmations: boolean
  order_updates: boolean
  distribution_alerts: boolean
  account_updates: boolean
}

const DEFAULT_PREFS: Preferences = {
  trade_confirmations: true,
  order_updates: true,
  distribution_alerts: true,
  account_updates: true,
}

const PREF_ITEMS: { key: keyof Preferences; label: string; description: string; icon: React.ElementType }[] = [
  {
    key: 'trade_confirmations',
    label: 'Trade Confirmations',
    description: 'Get notified when your buy or sell trades are executed',
    icon: ShoppingCart,
  },
  {
    key: 'order_updates',
    label: 'Order Updates',
    description: 'Receive alerts when your orders are filled or partially filled',
    icon: Bell,
  },
  {
    key: 'distribution_alerts',
    label: 'Distribution Alerts',
    description: 'Get notified when you receive royalty or distribution payments',
    icon: Coins,
  },
  {
    key: 'account_updates',
    label: 'Account Updates',
    description: 'Notifications about account verification and status changes',
    icon: UserCheck,
  },
]

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/notification-preferences')
      .then((r) => r.json())
      .then((data) => {
        if (data.preferences) setPrefs({ ...DEFAULT_PREFS, ...data.preferences })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function toggle(key: keyof Preferences) {
    const newValue = !prefs[key]
    setPrefs((prev) => ({ ...prev, [key]: newValue }))
    setSaving(key)

    try {
      await fetch('/api/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newValue }),
      })
    } catch {
      // Revert on error
      setPrefs((prev) => ({ ...prev, [key]: !newValue }))
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {PREF_ITEMS.map((item) => {
        const Icon = item.icon
        const checked = prefs[item.key]
        const isSaving = saving === item.key

        return (
          <Card key={item.key}>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
              <button
                onClick={() => toggle(item.key)}
                disabled={isSaving}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  checked ? 'bg-primary' : 'bg-muted'
                } ${isSaving ? 'opacity-50' : ''}`}
                role="switch"
                aria-checked={checked}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    checked ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </CardContent>
          </Card>
        )
      })}

      <p className="text-xs text-muted-foreground pt-2">
        Email notifications are sent to your account email address. All critical security notifications are always sent regardless of these settings.
      </p>
    </div>
  )
}
