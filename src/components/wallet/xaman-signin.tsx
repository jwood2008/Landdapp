'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, QrCode, Smartphone, CheckCircle2, XCircle } from 'lucide-react'

interface XamanSignInProps {
  onSuccess: (address: string) => void
  onCancel: () => void
}

type Step = 'idle' | 'creating' | 'scanning' | 'success' | 'error' | 'expired'

export function XamanSignIn({ onSuccess, onCancel }: XamanSignInProps) {
  const [step, setStep] = useState<Step>('idle')
  const [qrPng, setQrPng] = useState<string | null>(null)
  const [deepLink, setDeepLink] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const uuidRef = useRef<string | null>(null)

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  useEffect(() => {
    startSignIn()
    return () => stopPolling()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function startSignIn() {
    setStep('creating')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/xaman/create-signin', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to create Xaman request')

      uuidRef.current = data.uuid
      setQrPng(data.qr_png)
      setDeepLink(data.deep_link)
      setStep('scanning')
      startPolling(data.uuid)
    } catch (err) {
      setStep('error')
      setErrorMsg(err instanceof Error ? err.message : 'Failed to reach Xaman')
    }
  }

  function startPolling(uuid: string) {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/xaman/check-signin?uuid=${uuid}`)
        const data = await res.json()
        if (data.expired) {
          stopPolling()
          setStep('expired')
          return
        }
        if (data.signed && data.address) {
          stopPolling()
          setStep('success')
          onSuccess(data.address)
        }
      } catch {
        // Network hiccup — keep polling
      }
    }, 2000)

    // Auto-expire after 5 minutes
    setTimeout(() => {
      stopPolling()
      setStep((s) => (s === 'scanning' ? 'expired' : s))
    }, 5 * 60 * 1000)
  }

  if (step === 'creating') {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Creating sign-in request…</p>
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
        <p className="text-sm font-medium">Wallet connected!</p>
      </div>
    )
  }

  if (step === 'expired') {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <XCircle className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Request expired.</p>
        <Button size="sm" onClick={startSignIn}>Try again</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <XCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive text-center">{errorMsg}</p>
        <Button size="sm" onClick={startSignIn}>Retry</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    )
  }

  // scanning step
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <QrCode className="h-4 w-4" />
        <span>Scan with the Xaman app</span>
      </div>

      {qrPng && (
        <img
          src={qrPng}
          alt="Xaman QR code"
          className="rounded-lg border border-border"
          width={200}
          height={200}
        />
      )}

      <div className="flex items-center gap-1 text-xs text-muted-foreground animate-pulse">
        <Loader2 className="h-3 w-3 animate-spin" />
        Waiting for approval…
      </div>

      {deepLink && (
        <a
          href={deepLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <Smartphone className="h-3.5 w-3.5" />
          Open in Xaman app
        </a>
      )}

      <Button size="sm" variant="ghost" onClick={onCancel} className="text-muted-foreground">
        Cancel
      </Button>
    </div>
  )
}
