import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/lib/button-variants'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'

interface Distribution {
  id: string
  event_type: string
  total_amount: number
  distributable_amount: number
  currency: string
  status: string
  created_at: string
  assets: {
    asset_name: string
    token_symbol: string
  } | null
}

interface RecentDistributionsAdminProps {
  distributions: Distribution[]
}

function formatUSD(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'default',
  pending: 'secondary',
  processing: 'outline',
  failed: 'destructive',
}

const EVENT_LABELS: Record<string, string> = {
  LEASE: 'Lease Income',
  REFINANCE: 'Refinance',
  VALUATION: 'Valuation',
}

export function RecentDistributionsAdmin({ distributions }: RecentDistributionsAdminProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recent Distributions</CardTitle>
          <CardDescription>Latest distribution events across all assets</CardDescription>
        </div>
        <Link href="/admin/distributions/new" className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}>
          <Plus className="h-4 w-4" />
          New Distribution
        </Link>
      </CardHeader>
      <CardContent>
        {distributions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No distributions created yet.</p>
        ) : (
          <div className="space-y-3">
            {distributions.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    {d.assets?.asset_name ?? 'Unknown Asset'}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {EVENT_LABELS[d.event_type] ?? d.event_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums">
                      {formatUSD(d.distributable_amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">{d.currency} distributed</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[d.status] ?? 'secondary'}>{d.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
