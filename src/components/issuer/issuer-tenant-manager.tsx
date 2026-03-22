'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  UserCheck, UserPlus, MapPin, DollarSign, Calendar,
  Loader2, CheckCircle, AlertCircle, Users,
} from 'lucide-react'

interface LeaseInfo {
  id: string
  asset_id: string
  monthly_rent: number
  due_day: number
  lease_start_date: string
  lease_end_date: string | null
  status: string
  property_unit: string | null
  asset_name: string
  location: string | null
  tenant_email: string
  tenant_name: string | null
  payment_stats: { total: number; paid: number; late: number }
}

interface AssetOption {
  id: string
  asset_name: string
  location: string | null
}

interface Props {
  leases: LeaseInfo[]
  assets: AssetOption[]
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  ended: 'bg-zinc-500/10 text-zinc-500',
  terminated: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

function formatUSD(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
}

export function IssuerTenantManager({ leases, assets }: Props) {
  const router = useRouter()
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    assetId: '',
    tenantEmail: '',
    monthlyRent: '',
    dueDay: '1',
    leaseStartDate: '',
    leaseEndDate: '',
  })

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/issuer/assign-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: form.assetId,
          tenantEmail: form.tenantEmail,
          monthlyRent: parseFloat(form.monthlyRent),
          dueDay: parseInt(form.dueDay),
          leaseStartDate: form.leaseStartDate,
          leaseEndDate: form.leaseEndDate || null,
        }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error ?? 'Failed to assign tenant')
        return
      }

      setSuccess(true)
      setTimeout(() => {
        setShowAddSheet(false)
        setSuccess(false)
        setForm({ assetId: '', tenantEmail: '', monthlyRent: '', dueDay: '1', leaseStartDate: '', leaseEndDate: '' })
        router.refresh()
      }, 1500)
    } catch {
      setError('Failed to assign tenant. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const activeLeases = leases.filter((l) => l.status === 'active')

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenant Management</h1>
          <p className="text-base text-muted-foreground mt-1">
            Manage tenants across your properties
          </p>
        </div>
        <Button onClick={() => setShowAddSheet(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Add Tenant
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Tenants</p>
                <p className="text-2xl font-bold tabular-nums">{activeLeases.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monthly Revenue</p>
                <p className="text-2xl font-bold tabular-nums">
                  {formatUSD(activeLeases.reduce((sum, l) => sum + l.monthly_rent, 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <AlertCircle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Late Payments</p>
                <p className="text-2xl font-bold tabular-nums">
                  {leases.reduce((sum, l) => sum + l.payment_stats.late, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tenant Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Tenants</CardTitle>
          <CardDescription>{leases.length} lease{leases.length !== 1 ? 's' : ''} across your properties</CardDescription>
        </CardHeader>
        <CardContent>
          {leases.length === 0 ? (
            <div className="py-16 text-center">
              <UserCheck className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground">No tenants assigned yet.</p>
              <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowAddSheet(true)}>
                <UserPlus className="h-3.5 w-3.5" />
                Add Your First Tenant
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tenant</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Property</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Rent</th>
                    <th className="text-center px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-center px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Payments</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Lease Period</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leases.map((l) => {
                    const payRate = l.payment_stats.total > 0
                      ? Math.round((l.payment_stats.paid / l.payment_stats.total) * 100)
                      : 0
                    return (
                      <tr key={l.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-medium">{l.tenant_name ?? l.tenant_email}</p>
                          {l.tenant_name && <p className="text-xs text-muted-foreground">{l.tenant_email}</p>}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-medium">{l.asset_name}</p>
                          {l.location && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {l.location}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold tabular-nums">{formatUSD(l.monthly_rent)}/mo</td>
                        <td className="px-5 py-4 text-center">
                          <Badge className={`rounded-full text-xs px-3 ${STATUS_STYLES[l.status] ?? ''}`}>
                            {l.status.charAt(0).toUpperCase() + l.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="text-sm tabular-nums">
                            {l.payment_stats.paid}/{l.payment_stats.total}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">({payRate}%)</span>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground text-xs tabular-nums">
                          {new Date(l.lease_start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                          {' — '}
                          {l.lease_end_date
                            ? new Date(l.lease_end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                            : 'Ongoing'}
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

      {/* Add Tenant Sheet */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add Tenant
            </SheetTitle>
            <SheetDescription>
              Assign a tenant to one of your properties. They must have an existing account on the platform.
            </SheetDescription>
          </SheetHeader>

          {success ? (
            <div className="flex flex-col items-center py-12">
              <CheckCircle className="h-16 w-16 text-emerald-500 mb-4" />
              <p className="text-lg font-semibold">Tenant Assigned</p>
              <p className="text-sm text-muted-foreground">The tenant has been notified.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Property <span className="text-destructive">*</span></label>
                <select
                  value={form.assetId}
                  onChange={(e) => update('assetId', e.target.value)}
                  required
                  className="input"
                >
                  <option value="">Select a property...</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>{a.asset_name}{a.location ? ` — ${a.location}` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Tenant Email <span className="text-destructive">*</span></label>
                <input
                  type="email"
                  value={form.tenantEmail}
                  onChange={(e) => update('tenantEmail', e.target.value)}
                  placeholder="tenant@example.com"
                  required
                  className="input"
                />
                <p className="text-xs text-muted-foreground">The tenant must have an existing account on TierraDex.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Monthly Rent ($) <span className="text-destructive">*</span></label>
                  <input
                    type="number"
                    value={form.monthlyRent}
                    onChange={(e) => update('monthlyRent', e.target.value)}
                    placeholder="4000"
                    min="0"
                    step="0.01"
                    required
                    className="input"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Due Day <span className="text-destructive">*</span></label>
                  <select
                    value={form.dueDay}
                    onChange={(e) => update('dueDay', e.target.value)}
                    className="input"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>{d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'} of month</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Lease Start <span className="text-destructive">*</span></label>
                  <input
                    type="date"
                    value={form.leaseStartDate}
                    onChange={(e) => update('leaseStartDate', e.target.value)}
                    required
                    className="input"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Lease End</label>
                  <input
                    type="date"
                    value={form.leaseEndDate}
                    onChange={(e) => update('leaseEndDate', e.target.value)}
                    className="input"
                  />
                  <p className="text-xs text-muted-foreground">Leave blank for month-to-month.</p>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting} className="flex-1 gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  {submitting ? 'Assigning...' : 'Assign Tenant'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddSheet(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
