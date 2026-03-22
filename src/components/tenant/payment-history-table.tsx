'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, CheckCircle2, AlertCircle, Loader2, XCircle } from 'lucide-react'

interface Payment {
  id: string
  due_date: string
  amount_due: number
  amount_paid: number | null
  status: string
  paid_at: string | null
  property_name: string
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  paid: { label: 'Paid', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
  due: { label: 'Due', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: Clock },
  late: { label: 'Overdue', className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20', icon: AlertCircle },
  processing: { label: 'Processing', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', icon: Loader2 },
  failed: { label: 'Failed', className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20', icon: XCircle },
  waived: { label: 'Waived', className: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20', icon: CheckCircle2 },
}

function formatUSD(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v)
}

export function PaymentHistoryTable({ payments }: { payments: Payment[] }) {
  if (payments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-16 text-center">
            <Clock className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No payment history yet.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payment History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Due Date</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Property</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map((p) => {
                const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.due
                const StatusIcon = cfg.icon
                return (
                  <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-5 py-4 font-medium tabular-nums">
                      {new Date(p.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{p.property_name}</td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums">{formatUSD(p.amount_due)}</td>
                    <td className="px-5 py-4 text-center">
                      <Badge className={`rounded-full text-xs px-3 py-1 gap-1.5 ${cfg.className}`}>
                        <StatusIcon className="h-3 w-3" />
                        {cfg.label}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground tabular-nums">
                      {p.paid_at
                        ? new Date(p.paid_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
