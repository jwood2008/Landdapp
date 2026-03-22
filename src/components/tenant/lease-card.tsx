'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Calendar, DollarSign } from 'lucide-react'

interface LeaseCardProps {
  lease: {
    id: string
    monthly_rent: number
    due_day: number
    lease_start_date: string
    lease_end_date: string | null
    status: string
    property_unit: string | null
    asset: {
      asset_name: string
      location: string | null
    }
  }
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

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function LeaseCard({ lease }: LeaseCardProps) {
  const startDate = new Date(lease.lease_start_date)
  const endDate = lease.lease_end_date ? new Date(lease.lease_end_date) : null

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-base">{lease.asset.asset_name}</h3>
            {lease.property_unit && (
              <p className="text-sm text-muted-foreground">Unit: {lease.property_unit}</p>
            )}
          </div>
          <Badge className={`rounded-full text-xs px-3 ${STATUS_STYLES[lease.status] ?? STATUS_STYLES.pending}`}>
            {lease.status.charAt(0).toUpperCase() + lease.status.slice(1)}
          </Badge>
        </div>

        {lease.asset.location && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
            <MapPin className="h-3.5 w-3.5" />
            {lease.asset.location}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <DollarSign className="h-3 w-3" />
              Monthly Rent
            </div>
            <p className="text-lg font-bold tabular-nums">{formatUSD(lease.monthly_rent)}</p>
            <p className="text-xs text-muted-foreground">Due {ordinal(lease.due_day)} of each month</p>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Calendar className="h-3 w-3" />
              Start Date
            </div>
            <p className="text-sm font-medium">
              {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Calendar className="h-3 w-3" />
              End Date
            </div>
            <p className="text-sm font-medium">
              {endDate
                ? endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Month-to-month'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
