'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { CreditCard, Loader2, CheckCircle2, ExternalLink, AlertCircle } from 'lucide-react'

interface MoonPayBuyModalProps {
  open: boolean
  onClose: () => void
  onComplete: () => void
  asset: {
    id: string
    asset_name: string
    token_symbol: string
    nav_per_token: number
    issuer_wallet: string
  }
  tokenAmount: number
  payCurrency: 'RLUSD' | 'XRP'
}

type Step = 'confirm' | 'loading' | 'widget' | 'pending' | 'success' | 'error'

export function MoonPayBuyModal({
  open,
  onClose,
  onComplete,
  asset,
  tokenAmount,
  payCurrency,
}: MoonPayBuyModalProps) {
  const [step, setStep] = useState<Step>('confirm')
  const [error, setError] = useState<string | null>(null)
  const [moonpayUrl, setMoonpayUrl] = useState<string | null>(null)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [txResult, setTxResult] = useState<{ hash: string; result: string } | null>(null)

  const totalUsd = tokenAmount * asset.nav_per_token

  const formatUSD = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v)

  const initiateBuy = useCallback(async () => {
    setStep('loading')
    setError(null)

    try {
      const res = await fetch('/api/moonpay/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: asset.id,
          tokenAmount,
          pricePerToken: asset.nav_per_token,
          tokenSymbol: asset.token_symbol,
          issuerWallet: asset.issuer_wallet,
          payCurrency,
        }),
      })

      const data = await res.json()

      if (data.error) {
        setError(data.error)
        setStep('error')
        return
      }

      setWalletAddress(data.walletAddress)

      // DEV MODE: trade was executed directly (no MoonPay keys configured)
      if (data.devMode) {
        setTxResult({ hash: data.txHash, result: data.engineResult })
        setStep('success')
        return
      }

      // PRODUCTION: open MoonPay widget
      setMoonpayUrl(data.moonpayUrl)

      const popup = window.open(data.moonpayUrl, 'moonpay', 'width=500,height=700')

      if (!popup) {
        // Popup blocked — show link instead
        setStep('widget')
      } else {
        setStep('pending')
        // Poll for popup close
        const interval = setInterval(() => {
          if (popup.closed) {
            clearInterval(interval)
            onComplete()
          }
        }, 1000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start purchase')
      setStep('error')
    }
  }, [asset, tokenAmount, payCurrency, onComplete])

  const handleClose = () => {
    setStep('confirm')
    setError(null)
    setMoonpayUrl(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Buy with USD
          </DialogTitle>
          <DialogDescription>
            Purchase {asset.token_symbol} tokens using your debit card or bank transfer
          </DialogDescription>
        </DialogHeader>

        {/* Confirm step */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Asset</span>
                  <span className="font-medium">{asset.asset_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tokens</span>
                  <span className="font-mono">{tokenAmount.toLocaleString()} {asset.token_symbol}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Price per Token</span>
                  <span className="font-mono">${asset.nav_per_token.toFixed(4)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-sm font-bold">
                  <span>Total</span>
                  <span>{formatUSD(totalUsd)}</span>
                </div>
              </CardContent>
            </Card>

            <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <p>Powered by MoonPay. You&apos;ll complete payment in a secure window.</p>
              <p>MoonPay will convert your USD to {payCurrency}, then we automatically buy {asset.token_symbol} tokens for you on the XRPL DEX.</p>
              <p>A custodial wallet is created and managed securely by the platform — no crypto knowledge needed.</p>
            </div>

            <Button
              onClick={initiateBuy}
              className="w-full gap-2 bg-green-600 hover:bg-green-700"
            >
              <CreditCard className="h-4 w-4" />
              Pay {formatUSD(totalUsd)} with MoonPay
            </Button>
          </div>
        )}

        {/* Loading */}
        {step === 'loading' && (
          <div className="py-8 text-center space-y-3">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Setting up your purchase...</p>
            <p className="text-xs text-muted-foreground">Creating wallet & preparing payment</p>
          </div>
        )}

        {/* Widget link (popup was blocked) */}
        {step === 'widget' && moonpayUrl && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-center">
              <AlertCircle className="mx-auto h-6 w-6 text-amber-500 mb-2" />
              <p className="text-sm">Popup was blocked by your browser.</p>
              <p className="text-xs text-muted-foreground mt-1">Click below to open MoonPay in a new tab.</p>
            </div>

            {walletAddress && (
              <div className="text-xs text-muted-foreground text-center">
                Funds will be sent to: <span className="font-mono">{walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}</span>
              </div>
            )}

            <a href={moonpayUrl} target="_blank" rel="noopener noreferrer">
              <Button className="w-full gap-2 bg-green-600 hover:bg-green-700">
                <ExternalLink className="h-4 w-4" />
                Open MoonPay
              </Button>
            </a>

            <Button variant="outline" className="w-full" onClick={() => { onComplete(); handleClose() }}>
              I&apos;ve completed payment
            </Button>
          </div>
        )}

        {/* Pending — popup is open */}
        {step === 'pending' && (
          <div className="py-8 text-center space-y-3">
            <div className="relative mx-auto w-12 h-12">
              <CreditCard className="h-12 w-12 text-green-500/20" />
              <Loader2 className="absolute inset-0 h-12 w-12 animate-spin text-green-500" />
            </div>
            <p className="text-sm font-medium">Complete your payment in the MoonPay window</p>
            <p className="text-xs text-muted-foreground">
              Once payment is confirmed, we&apos;ll automatically buy your tokens.
            </p>
            {walletAddress && (
              <Badge variant="outline" className="text-[10px] font-mono">
                Wallet: {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => { onComplete(); handleClose() }}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              I&apos;ve completed payment
            </Button>
          </div>
        )}

        {/* Success — dev mode or completed */}
        {step === 'success' && (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
            <p className="text-sm font-medium">Trade submitted to XRPL DEX!</p>
            {txResult && (
              <div className="space-y-1">
                <Badge variant={txResult.result === 'tesSUCCESS' ? 'default' : 'outline'} className="text-[10px]">
                  {txResult.result}
                </Badge>
                <p className="text-[10px] font-mono text-muted-foreground break-all">
                  TX: {txResult.hash}
                </p>
              </div>
            )}
            {walletAddress && (
              <p className="text-xs text-muted-foreground">
                Custodial wallet: <span className="font-mono">{walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}</span>
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">
              MoonPay not configured — trade executed directly via custodial wallet (dev mode)
            </p>
            <Button
              className="mt-2 bg-green-600 hover:bg-green-700"
              onClick={() => { onComplete(); handleClose() }}
            >
              Done
            </Button>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center">
              <AlertCircle className="mx-auto h-6 w-6 text-destructive mb-2" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={() => setStep('confirm')}>
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
