import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface DistributionEntry {
  id: string
  event_type: string
  total_amount: number
  currency: string
  distributable_amount: number
  created_at: string
  status: string
  myPayment: {
    amount: number
    currency: string
    status: string
  } | null
}

interface DistributionHistoryProps {
  distributions: DistributionEntry[]
}

function formatUSD(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

const EVENT_LABELS: Record<string, string> = {
  VALUATION: 'Valuation Update',
  LEASE: 'Lease Income',
  REFINANCE: 'Refinance Proceeds',
}

export function DistributionHistory({ distributions }: DistributionHistoryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Royalty History</CardTitle>
        <CardDescription>All completed royalty payments for this asset</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {distributions.length === 0 ? (
          <div className="px-6 pb-6">
            <p className="text-sm text-muted-foreground">No distributions completed yet.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Total Distributed</TableHead>
                <TableHead className="text-right">My Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {distributions.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-sm">
                    {new Date(d.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {EVENT_LABELS[d.event_type] ?? d.event_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatUSD(d.distributable_amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {d.myPayment ? (
                      <span className="font-medium text-success">
                        {formatUSD(d.myPayment.amount)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
