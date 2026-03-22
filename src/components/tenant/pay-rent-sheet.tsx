'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { CheckCircle2, Loader2, AlertCircle, MapPin } from 'lucide-react'

interface PayRentSheetProps {
  payment: {
    id: string
    due_date: string
    amount_due: number
    property_name: string
    property_location: string | null
  } | null
  onClose: () => void
  onSuccess: () => void
}

type Step = 'confirm' | 'processing' | 'success' | 'error'

function formatUSD(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v)
}

export function PayRentSheet({ payment, onClose, onSuccess }: PayRentSheetProps) {
  const [step, setStep] = useState<Step>('confirm')
  const [error, setError] = useState<string | null>(null)
  const [confirmationId, setConfirmationId] = useState<string | null>(null)

  if (!payment) return null

  async function handlePay() {
    setStep('processing')
    setError(null)

    try {
      const res = await fetch('/api/tenant/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: payment!.id }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error ?? 'Payment failed. Please try again.')
        setStep('error')
        return
      }

      setConfirmationId(data.confirmationId ?? payment!.id.slice(0, 8).toUpperCase())
      setStep('success')
    } catch {
      setError('Unable to process payment. Please check your connection and try again.')
      setStep('error')
    }
  }

  function handleClose() {
    if (step === 'success') onSuccess()
    setStep('confirm')
    setError(null)
    onClose()
  }

  const dueDate = new Date(payment.due_date)

  return (
    <Sheet open={!!payment} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-2xl px-0 pb-8 sm:max-w-lg sm:mx-auto">
        <div className="flex flex-col items-center px-6 pt-2">
          {/* Step: Confirm */}
          {step === 'confirm' && (
            <>
              <SheetHeader className="text-center space-y-1 mb-6">
                <SheetTitle className="text-xl font-semibold tracking-tight">
                  Confirm Payment
                </SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  Review the details below before submitting your payment
                </SheetDescription>
              </SheetHeader>

              <div className="w-full rounded-xl border border-border bg-card p-6 space-y-4 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Property</span>
                  <span className="text-sm font-medium">{payment.property_name}</span>
                </div>
                {payment.property_location && (
                  <>
                    <div className="h-px bg-border" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Location</span>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {payment.property_location}
                      </span>
                    </div>
                  </>
                )}
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Due Date</span>
                  <span className="text-sm font-medium">
                    {dueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="text-lg font-bold tabular-nums">{formatUSD(payment.amount_due)}</span>
                </div>
              </div>

              <div className="w-full space-y-3">
                <Button onClick={handlePay} className="w-full h-12 text-base font-semibold">
                  Pay {formatUSD(payment.amount_due)}
                </Button>
                <button
                  onClick={handleClose}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* Step: Processing */}
          {step === 'processing' && (
            <div className="flex flex-col items-center py-12">
              <div className="relative mb-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/20">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                </div>
              </div>
              <h3 className="text-lg font-semibold mb-2">Processing Payment</h3>
              <p className="text-sm text-muted-foreground text-center">
                Please wait while we process your payment of {formatUSD(payment.amount_due)}...
              </p>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && (
            <>
              <div className="relative mb-6 mt-4">
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" style={{ animationDuration: '1.5s', animationIterationCount: '1' }} />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 ring-4 ring-emerald-500/20">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                </div>
              </div>

              <SheetHeader className="text-center space-y-1 mb-6">
                <SheetTitle className="text-xl font-semibold tracking-tight">
                  Payment Successful
                </SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  Your rent payment has been received and confirmed
                </SheetDescription>
              </SheetHeader>

              <div className="w-full rounded-xl border border-border bg-card p-6 space-y-4 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Amount Paid</span>
                  <span className="text-lg font-bold tabular-nums">{formatUSD(payment.amount_due)}</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Property</span>
                  <span className="text-sm font-medium">{payment.property_name}</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Confirmation</span>
                  <Badge className="rounded-full text-xs px-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
                    #{confirmationId}
                  </Badge>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge className="rounded-full text-xs px-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Confirmed
                  </Badge>
                </div>
              </div>

              <Button onClick={handleClose} className="w-full h-12 text-base font-semibold bg-emerald-600 hover:bg-emerald-700 text-white">
                Done
              </Button>
            </>
          )}

          {/* Step: Error */}
          {step === 'error' && (
            <>
              <div className="relative mb-6 mt-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 ring-4 ring-red-500/20">
                  <AlertCircle className="h-10 w-10 text-red-500" />
                </div>
              </div>

              <SheetHeader className="text-center space-y-1 mb-6">
                <SheetTitle className="text-xl font-semibold tracking-tight">
                  Payment Failed
                </SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  {error}
                </SheetDescription>
              </SheetHeader>

              <div className="w-full space-y-3">
                <Button onClick={() => setStep('confirm')} className="w-full h-12">
                  Try Again
                </Button>
                <button
                  onClick={handleClose}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
