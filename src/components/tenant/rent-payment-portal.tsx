'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CreditCard, MapPin, Calendar, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { PayRentSheet } from '@/components/tenant/pay-rent-sheet'
import { PaymentHistoryTable } from '@/components/tenant/payment-history-table'

interface LeaseInfo {
  id: string
  monthly_rent: number
  due_day: number
  asset_name: string
  location: string | null
}

interface PaymentInfo {
  id: string
  lease_id: string
  due_date: string
  amount_due: number
  amount_paid: number | null
  status: string
  paid_at: string | null
  asset_name: string
}

interface Props {
  leases: LeaseInfo[]
  nextPayment: PaymentInfo | null
  payments: PaymentInfo[]
  stats: {
    totalPaid: number
    onTimeRate: number
    upcomingCount: number
  }
}

function formatUSD(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v)
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function RentPaymentPortal({ leases, nextPayment, payments, stats }: Props) {
  const router = useRouter()
  const [selectedPayment, setSelectedPayment] = useState<{
    id: string
    due_date: string
    amount_due: number
    property_name: string
    property_location: string | null
  } | null>(null)

  // Find the lease info for the next payment
  const nextLease = nextPayment
    ? leases.find((l) => l.id === nextPayment.lease_id)
    : null

  const daysLeft = nextPayment ? daysUntil(nextPayment.due_date) : null
  const isOverdue = daysLeft !== null && daysLeft < 0
  const isDueSoon = daysLeft !== null && daysLeft <= 5 && daysLeft >= 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rent Payments</h1>
        <p className="text-base text-muted-foreground mt-1">
          View and manage your rent payments
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-5">
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Paid (YTD)</p>
            <p className="text-2xl font-bold tabular-nums">{formatUSD(stats.totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">On-Time Rate</p>
            <p className="text-2xl font-bold tabular-nums">{stats.onTimeRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Upcoming</p>
            <p className="text-2xl font-bold tabular-nums">{stats.upcomingCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Next Payment Due — Hero Card */}
      {nextPayment && nextPayment.status !== 'paid' ? (
        <Card className={`border-2 ${isOverdue ? 'border-red-500/30 bg-red-500/5' : isDueSoon ? 'border-amber-500/30 bg-amber-500/5' : 'border-primary/20 bg-primary/5'}`}>
          <CardContent className="p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className={`h-5 w-5 ${isOverdue ? 'text-red-500' : 'text-primary'}`} />
                  <h2 className="text-lg font-semibold">
                    {isOverdue ? 'Payment Overdue' : 'Next Payment Due'}
                  </h2>
                </div>
                <p className="text-base font-medium">{nextPayment.asset_name}</p>
                {nextLease?.location && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {nextLease.location}
                  </div>
                )}
              </div>

              <div className="text-right">
                {isOverdue ? (
                  <Badge className="rounded-full px-3 py-1 bg-red-500/10 text-red-600 dark:text-red-400 gap-1.5 text-sm">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {Math.abs(daysLeft!)} days overdue
                  </Badge>
                ) : isDueSoon ? (
                  <Badge className="rounded-full px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1.5 text-sm">
                    <Clock className="h-3.5 w-3.5" />
                    Due in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                  </Badge>
                ) : (
                  <Badge className="rounded-full px-3 py-1 bg-primary/10 text-primary gap-1.5 text-sm">
                    <Calendar className="h-3.5 w-3.5" />
                    Due in {daysLeft} days
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Amount Due</p>
                <p className="text-4xl font-bold tabular-nums">{formatUSD(nextPayment.amount_due)}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Due {new Date(nextPayment.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <Button
                size="lg"
                onClick={() => setSelectedPayment({
                  id: nextPayment.id,
                  due_date: nextPayment.due_date,
                  amount_due: nextPayment.amount_due,
                  property_name: nextPayment.asset_name,
                  property_location: nextLease?.location ?? null,
                })}
                className="h-14 px-10 text-base font-semibold"
              >
                Pay Now
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold mb-1">All Caught Up</h2>
            <p className="text-sm text-muted-foreground">
              You have no pending rent payments. Great job!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      <PaymentHistoryTable
        payments={payments.map((p) => ({
          id: p.id,
          due_date: p.due_date,
          amount_due: p.amount_due,
          amount_paid: p.amount_paid,
          status: p.status,
          paid_at: p.paid_at,
          property_name: p.asset_name,
        }))}
      />

      {/* Payment Sheet */}
      <PayRentSheet
        payment={selectedPayment}
        onClose={() => setSelectedPayment(null)}
        onSuccess={() => {
          setSelectedPayment(null)
          router.refresh()
        }}
      />
    </div>
  )
}
