import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Payment {
  id: string
  amount: number
  currency: string
  ownership_percent: number
  status: string
  created_at: string
  distributions: {
    event_type: string
    assets: {
      asset_name: string
      token_symbol: string
    } | null
  } | null
}

interface RecentDistributionsProps {
  payments: Payment[]
}

function formatUSD(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

const EVENT_LABELS: Record<string, string> = {
  VALUATION: 'Valuation',
  LEASE: 'Lease Income',
  REFINANCE: 'Refinance',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'default',
  pending: 'secondary',
  processing: 'outline',
  failed: 'destructive',
}

export function RecentDistributions({ payments }: RecentDistributionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Distributions</CardTitle>
        <CardDescription>Your last 5 income payments</CardDescription>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No distributions received yet.</p>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    {payment.distributions?.assets?.asset_name ?? 'Unknown Asset'}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {EVENT_LABELS[payment.distributions?.event_type ?? ''] ?? 'Distribution'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(payment.created_at).toLocaleDateString('en-US', {
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
                      {formatUSD(payment.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">{payment.currency}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[payment.status] ?? 'secondary'}>
                    {payment.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
