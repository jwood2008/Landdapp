'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, CheckCircle, XCircle, ExternalLink, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface XamanSignModalProps {
  uuid: string
  qrUrl: string | null
  deepLink: string | null
  instruction: string
  onSigned: (txHash: string) => void
  onExpired: () => void
  onCancel: () => void
}

export function XamanSignModal({
  uuid,
  qrUrl,
  deepLink,
  instruction,
  onSigned,
  onExpired,
  onCancel,
}: XamanSignModalProps) {
  const [status, setStatus] = useState<'waiting' | 'signed' | 'expired'>('waiting')
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    // Poll Xaman every 3 seconds
    intervalRef.current = setInterval(async () => {
      if (doneRef.current) return

      try {
        const res = await fetch(`/api/xaman/check-signin?uuid=${uuid}`)
        const data = await res.json()

        if (data.signed) {
          // Signed — proceed even if txHash is missing (e.g. duplicate trust line)
          doneRef.current = true
          setStatus('signed')
          onSigned(data.txHash ?? '')
        } else if (data.expired) {
          doneRef.current = true
          setStatus('expired')
          onExpired()
        }
      } catch {
        // Silently retry on next interval
      }
    }, 3000)

    // Elapsed time counter
    timerRef.current = setInterval(() => {
      setElapsed((e) => e + 1)
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [uuid, onSigned, onExpired])

  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  const timeLeft = Math.max(0, 300 - elapsed)
  const timeLeftMin = Math.floor(timeLeft / 60)
  const timeLeftSec = timeLeft % 60

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Sign in Xaman</h3>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{instruction}</p>
        </div>

        {/* Body */}
        <div className="px-6 py-6 flex flex-col items-center gap-4">
          {status === 'waiting' && (
            <>
              {/* QR Code */}
              {qrUrl ? (
                <div className="rounded-xl border border-border p-3 bg-white">
                  <img
                    src={qrUrl}
                    alt="Scan with Xaman"
                    className="w-48 h-48"
                  />
                </div>
              ) : (
                <div className="w-48 h-48 rounded-xl border border-border bg-muted/40 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* Deep link */}
              {deepLink && (
                <a
                  href={deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  Open in Xaman
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}

              {/* Status */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Waiting for signature...</span>
              </div>

              {/* Timer */}
              <p className="text-xs text-muted-foreground/70">
                Expires in {timeLeftMin}:{timeLeftSec.toString().padStart(2, '0')}
              </p>
            </>
          )}

          {status === 'signed' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-status-success">
                <CheckCircle className="h-7 w-7 text-success" />
              </div>
              <p className="font-semibold text-success">Transaction Signed</p>
              <p className="text-sm text-muted-foreground">Payment submitted to XRPL</p>
            </div>
          )}

          {status === 'expired' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-status-warning">
                <XCircle className="h-7 w-7 text-warning" />
              </div>
              <p className="font-semibold text-warning">Payload Expired</p>
              <p className="text-sm text-muted-foreground">The signing request timed out. You can retry.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 flex justify-end">
          {status === 'waiting' && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Skip this payment
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
