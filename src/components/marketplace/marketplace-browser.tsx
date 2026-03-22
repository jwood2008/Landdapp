'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Store, TrendingUp, Building2, DollarSign, ArrowUpDown,
  Loader2, ShieldAlert, AlertCircle, ExternalLink, CreditCard, Wallet,
  Coins, Calendar, MapPin, Users, Repeat, CheckCircle2, ArrowRight, Copy, Check, Lock, ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'
import { XamanSignModal } from '@/components/admin/xaman-sign-modal'
import { MoonPayBuyModal } from '@/components/marketplace/moonpay-buy-modal'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'

interface Asset {
  id: string
  asset_name: string
  asset_type: string
  token_symbol: string
  current_valuation: number
  nav_per_token: number
  annual_yield: number | null
  token_supply: number
  issuer_wallet: string
  location: string | null
  total_acres: number | null
  ai_rating: number | null
  royalty_frequency: string | null
  access_type?: string
  third_party_verified?: boolean
}

interface ContractInfo {
  asset_id: string
  tenant_name: string | null
  annual_amount: number | null
  payment_frequency: string | null
  lease_start_date: string | null
  lease_end_date: string | null
  currency: string
}

interface DistributionInfo {
  asset_id: string
  total_amount: number
  currency: string
  status: string
  royalty_period: string | null
  created_at: string
}

interface Order {
  id: string
  investor_id: string
  asset_id: string
  side: 'buy' | 'sell'
  token_amount: number
  filled_amount: number
  price_per_token: number
  currency: string
  status: string
  created_at: string
  assets: { asset_name: string; token_symbol: string; nav_per_token: number } | null
}

interface Settings {
  marketplace_enabled: boolean
  marketplace_fee_bps: number
}

type MarketTab = 'all' | 'primary' | 'secondary'

interface Props {
  assets: Asset[]
  orders: Order[]
  filledOrders: Order[]
  currentInvestor: { id: string; kyc_status: string; wallet_address: string } | null
  settings: Settings | null
  contracts?: ContractInfo[]
  distributions?: DistributionInfo[]
  hasCustodialWallet?: boolean
  availableByAssetId?: Record<string, number>
}

function formatUSD(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v)
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function formatFrequency(freq: string | null): string {
  if (!freq) return 'N/A'
  return freq.replace('_', '-').replace(/\b\w/g, (c) => c.toUpperCase())
}

/* ─── Transaction Complete Sheet ─────────────────────────────── */

function TransactionCompleteSheet({
  tx,
  onClose,
  isTestnet = false,
}: {
  tx: {
    hash: string
    tokenAmount: number
    tokenSymbol: string
    assetName: string
    pricePerToken: number
    totalCost: number
    currency: string
    side: 'buy' | 'sell'
    sellOrderRemaining?: number
  } | null
  onClose: () => void
  isTestnet?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  if (!tx) return null

  const explorerBase = isTestnet
    ? 'https://testnet.xrpl.org/transactions/'
    : 'https://livenet.xrpl.org/transactions/'

  function copyHash() {
    navigator.clipboard.writeText(tx!.hash)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Sheet open={!!tx} onOpenChange={() => onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl px-0 pb-8 sm:max-w-lg sm:mx-auto">
        <div className="flex flex-col items-center px-6 pt-2">
          {/* Success animation */}
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-success/20 animate-ping" style={{ animationDuration: '1.5s', animationIterationCount: '1' }} />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-success/10 ring-4 ring-success/20">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
          </div>

          <SheetHeader className="text-center space-y-1 mb-8">
            <SheetTitle className="text-xl font-semibold tracking-tight">
              Transaction Complete
            </SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              Your {tx.side === 'buy' ? 'purchase' : 'sale'} has been confirmed on the XRPL
            </SheetDescription>
          </SheetHeader>

          {/* Token amount highlight */}
          <div className="mb-8 flex flex-col items-center">
            <p className="text-4xl font-bold tracking-tight tabular-nums">
              {tx.side === 'buy' ? '+' : '-'}{tx.tokenAmount.toLocaleString()}
            </p>
            <p className="text-lg font-medium text-muted-foreground mt-1">
              {tx.tokenSymbol} tokens
            </p>
          </div>

          {/* Transaction details card */}
          <div className="w-full rounded-xl border border-border bg-card-inset p-5 space-y-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Asset</span>
              <span className="text-sm font-medium">{tx.assetName}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Price per token</span>
              <span className="text-sm font-mono font-medium tabular-nums">{formatUSD(tx.pricePerToken)}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {tx.side === 'buy' ? 'Total paid' : 'Total received'}
              </span>
              <span className="text-sm font-mono font-semibold tabular-nums">
                {formatUSD(tx.totalCost)}
              </span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge className="text-xs bg-status-success text-status-success-foreground border-0 rounded-full px-3">
                Confirmed
              </Badge>
            </div>
            <div className="h-px bg-border" />
            <div className="space-y-1.5">
              <span className="text-sm text-muted-foreground">Transaction hash</span>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
                  {tx.hash}
                </code>
                <button
                  onClick={copyHash}
                  className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                  title="Copy hash"
                >
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="w-full space-y-3">
            <a
              href={`${explorerBase}${tx.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
            >
              <ExternalLink className="h-4 w-4" />
              View on XRPL Explorer
            </a>
            <Button
              onClick={() => { onClose(); router.push('/dashboard/portfolio') }}
              className="w-full gap-2 bg-success hover:bg-success/90 text-success-foreground"
            >
              View Portfolio
              <ArrowRight className="h-4 w-4" />
            </Button>
            <button
              onClick={onClose}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              Continue trading
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function MarketplaceBrowser({ assets, orders, filledOrders, currentInvestor, settings, contracts = [], distributions = [], hasCustodialWallet = false, availableByAssetId = {} }: Props) {
  const router = useRouter()
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('')
  const [payCurrency, setPayCurrency] = useState<'RLUSD' | 'XRP'>('XRP')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [completedTx, setCompletedTx] = useState<{
    hash: string
    tokenAmount: number
    tokenSymbol: string
    assetName: string
    pricePerToken: number
    totalCost: number
    currency: string
    side: 'buy' | 'sell'
    sellOrderRemaining?: number
  } | null>(null)
  const [detailAssetId, setDetailAssetId] = useState<string | null>(null)
  const [marketTab, setMarketTab] = useState<MarketTab>('all')
  // Optimistic: track order IDs that have been fully filled so they vanish instantly
  const [filledOrderIds, setFilledOrderIds] = useState<Set<string>>(new Set())
  // Optimistic: track partial fills (orderId → additional filled amount) so listings update instantly
  const [optimisticFills, setOptimisticFills] = useState<Record<string, number>>({})

  // Clear optimistic state when server data refreshes (server data is now canonical)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setFilledOrderIds(new Set()); setOptimisticFills({}) }, [orders])

  // Supply limit popup
  const [supplyError, setSupplyError] = useState<{ requested: number; available: number; symbol: string } | null>(null)

  // Payment method: platform (custodial wallet — XRP payment + token delivery) or xaman (self-custody QR signing)
  const [paymentMethod, setPaymentMethod] = useState<'platform' | 'xaman'>('platform')
  const [showMoonpayModal, setShowMoonpayModal] = useState(false)

  // Xaman signing state
  const [xamanUuid, setXamanUuid] = useState<string | null>(null)
  const [xamanQrUrl, setXamanQrUrl] = useState<string | null>(null)
  const [xamanDeepLink, setXamanDeepLink] = useState<string | null>(null)
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null)

  // Pending Xaman buy — after TrustSet is signed, we deliver tokens from issuer
  const [pendingXamanBuy, setPendingXamanBuyRaw] = useState<{
    orderId: string
    tokenAmount: number
    tokenSymbol: string
    issuerWallet: string
    pricePerToken: number
    investorAddress: string
  } | null>(null)

  // Pending Xaman payment — after Payment is signed, we deliver tokens
  const [pendingXamanPayment, setPendingXamanPaymentRaw] = useState<{
    orderId: string
    tokenAmount: number
    tokenSymbol: string
    issuerWallet: string
    pricePerToken: number
    investorAddress: string
    payCurrency: string
  } | null>(null)

  // Persist state in sessionStorage so it survives app switching
  function setPendingXamanBuy(val: typeof pendingXamanBuy) {
    setPendingXamanBuyRaw(val)
    if (val) {
      sessionStorage.setItem('pendingXamanBuy', JSON.stringify(val))
    } else {
      sessionStorage.removeItem('pendingXamanBuy')
    }
  }

  function setPendingXamanPayment(val: typeof pendingXamanPayment) {
    setPendingXamanPaymentRaw(val)
    if (val) {
      sessionStorage.setItem('pendingXamanPayment', JSON.stringify(val))
    } else {
      sessionStorage.removeItem('pendingXamanPayment')
    }
  }

  // Restore state on mount (e.g. after switching back from Xaman app)
  useEffect(() => {
    try {
      const savedBuy = sessionStorage.getItem('pendingXamanBuy')
      const savedPayment = sessionStorage.getItem('pendingXamanPayment')
      const savedUuid = sessionStorage.getItem('xamanUuid')
      const savedQr = sessionStorage.getItem('xamanQrUrl')
      const savedDeepLink = sessionStorage.getItem('xamanDeepLink')
      if (savedBuy) setPendingXamanBuyRaw(JSON.parse(savedBuy))
      if (savedPayment) setPendingXamanPaymentRaw(JSON.parse(savedPayment))
      if (savedUuid) setXamanUuid(savedUuid)
      if (savedQr) setXamanQrUrl(savedQr)
      if (savedDeepLink) setXamanDeepLink(savedDeepLink)
    } catch {
      // Ignore parse errors
    }
  }, [])

  const selectedAsset = assets.find((a) => a.id === selectedAssetId)

  // Trade history for selected asset (filled orders)
  const assetTrades = selectedAssetId
    ? filledOrders.filter((o) => o.asset_id === selectedAssetId)
    : []

  // Filter out optimistically filled orders
  const liveOrders = orders.filter((o) => !filledOrderIds.has(o.id))

  // Open orders (pending on DEX — mainly sell orders)
  const assetOrders = selectedAssetId
    ? liveOrders.filter((o) => o.asset_id === selectedAssetId)
    : []
  const buyOrders = assetOrders
    .filter((o) => o.side === 'buy')
    .sort((a, b) => b.price_per_token - a.price_per_token)
  const sellOrders = assetOrders
    .filter((o) => o.side === 'sell')
    .sort((a, b) => a.price_per_token - b.price_per_token)

  // Price: locked to NAV for primary buys, editable for secondary sells
  const [customPrice, setCustomPrice] = useState('')
  const [showTradeSheet, setShowTradeSheet] = useState(false)
  const navPrice = selectedAsset ? selectedAsset.nav_per_token : 0
  const isCustomPriceAllowed = orderSide === 'sell'
  const price = isCustomPriceAllowed && customPrice ? customPrice : String(navPrice)
  const totalValue = parseFloat(amount || '0') * parseFloat(price || '0')

  // Premium/discount vs NAV
  const priceNum = parseFloat(price || '0')
  const priceDiffPercent = navPrice > 0 ? ((priceNum - navPrice) / navPrice) * 100 : 0

  if (!settings?.marketplace_enabled) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketplace</h1>
          <p className="text-base text-muted-foreground">Secondary market for tokenized assets</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Store className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-base text-muted-foreground">The marketplace is currently disabled by the platform administrator.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  async function submitOrder() {
    if (!selectedAssetId || !amount || !price || !selectedAsset || !currentInvestor) return

    // Check supply limit for primary market buys
    if (orderSide === 'buy') {
      const requestedAmount = parseFloat(amount)
      // For secondary buys, the sell order limits it. For primary buys, check supply.
      const hasSecondarySeller = liveOrders.some(
        (o) => o.asset_id === selectedAssetId && o.side === 'sell' && (o.status === 'open' || o.status === 'partial')
          && o.investor_id !== currentInvestor?.id
          && (o.token_amount - (o.filled_amount ?? 0)) > 0
      )
      if (!hasSecondarySeller) {
        const available = availableByAssetId[selectedAssetId] ?? selectedAsset.token_supply
        if (requestedAmount > available) {
          setSupplyError({
            requested: requestedAmount,
            available,
            symbol: selectedAsset.token_symbol,
          })
          return
        }
      }
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      // 1. Create order in DB
      const res = await fetch('/api/marketplace/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: selectedAssetId,
          side: orderSide,
          token_amount: parseFloat(amount),
          price_per_token: parseFloat(price),
          currency: payCurrency,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const orderId = data.order?.id
      setPendingOrderId(orderId)

      if (!orderId) throw new Error('Order creation failed')

      // 2. Platform/custodial buy — check if secondary (matching sell order) or primary (from issuer)
      if (orderSide === 'buy' && paymentMethod !== 'xaman') {
        try {
          // Check for an open sell order on this asset (secondary market)
          const matchingSellOrder = liveOrders.find(
            (o) => o.asset_id === selectedAssetId && o.side === 'sell' && (o.status === 'open' || o.status === 'partial')
              && o.investor_id !== currentInvestor?.id // don't match your own sell order
              && (o.token_amount - (o.filled_amount ?? 0)) > 0
          )

          let buyRes: Response
          if (matchingSellOrder) {
            // Secondary market buy — use the SELLER'S listed currency so the DEX offers match
            buyRes = await fetch('/api/wallet/secondary-buy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                buyOrderId: orderId,
                sellOrderId: matchingSellOrder.id,
                tokenAmount: parseFloat(amount),
                tokenSymbol: selectedAsset.token_symbol,
                issuerWallet: selectedAsset.issuer_wallet,
                pricePerToken: matchingSellOrder.price_per_token,
                currency: matchingSellOrder.currency,
              }),
            })
          } else {
            // Primary market buy — issuer sends tokens directly to investor
            buyRes = await fetch('/api/wallet/primary-buy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId,
                tokenAmount: parseFloat(amount),
                pricePerToken: parseFloat(price),
                tokenSymbol: selectedAsset.token_symbol,
                issuerWallet: selectedAsset.issuer_wallet,
                currency: payCurrency,
              }),
            })
          }
          const buyData = await buyRes.json()

          if (buyData.hash) {
            if (orderId) setFilledOrderIds((prev) => new Set(prev).add(orderId))
            if (matchingSellOrder) {
              if (!buyData.sellOrderRemaining || buyData.sellOrderRemaining <= 0) {
                // Fully filled — remove listing entirely
                setFilledOrderIds((prev) => new Set(prev).add(matchingSellOrder.id))
              } else {
                // Partially filled — optimistically reduce the remaining count
                setOptimisticFills((prev) => ({
                  ...prev,
                  [matchingSellOrder.id]: (prev[matchingSellOrder.id] ?? 0) + parseFloat(amount),
                }))
              }
            }
            // For secondary buys, use the seller's currency; for primary, use buyer's
            const txCurrency = matchingSellOrder ? (matchingSellOrder.currency || payCurrency) : payCurrency
            const txPrice = matchingSellOrder ? matchingSellOrder.price_per_token : parseFloat(price)
            setCompletedTx({
              hash: buyData.hash,
              tokenAmount: parseFloat(amount),
              tokenSymbol: selectedAsset.token_symbol,
              assetName: selectedAsset.asset_name,
              pricePerToken: txPrice,
              totalCost: parseFloat(amount) * txPrice,
              currency: txCurrency,
              side: 'buy',
              sellOrderRemaining: buyData.sellOrderRemaining,
            })
            setAmount('')
            setSelectedAssetId(null)
            router.refresh()
            return
          }

          if (buyData.error) {
            throw new Error(buyData.error)
          }
        } catch (err) {
          if (err instanceof Error && err.message) {
            throw err
          }
          throw new Error('Purchase failed. Please try again.')
        }
      }

      // 2b. Sell orders via custodial wallet (only if not using Xaman)
      if (orderSide === 'sell' && paymentMethod !== 'xaman') {
        try {
          const tradeRes = await fetch('/api/wallet/trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId,
              side: orderSide,
              tokenAmount: parseFloat(amount),
              pricePerToken: parseFloat(price),
              tokenSymbol: selectedAsset.token_symbol,
              issuerWallet: selectedAsset.issuer_wallet,
              currency: payCurrency,
            }),
          })
          const tradeData = await tradeRes.json()

          if (tradeData.hash) {
            if (orderId) setFilledOrderIds((prev) => new Set(prev).add(orderId))
            setSuccess(`Sell order placed on XRPL! Hash: ${tradeData.hash.slice(0, 12)}...`)
            setAmount('')
            setSelectedAssetId(null)
            router.refresh()
            setTimeout(() => setSuccess(null), 5000)
            return
          }

          if (tradeData.error) {
            console.warn('[trade] Custodial sell failed, falling back to Xaman:', tradeData.error)
          }
        } catch {
          // Fall through to Xaman
        }
      }

      // 3. Xaman flow — different for buy vs sell
      if (orderSide === 'buy') {
        const buyDetails = {
          orderId,
          tokenAmount: parseFloat(amount),
          tokenSymbol: selectedAsset.token_symbol,
          issuerWallet: selectedAsset.issuer_wallet,
          pricePerToken: parseFloat(price),
          investorAddress: currentInvestor.wallet_address,
        }

        // Check if trust line already exists — skip TrustSet if so
        let hasTrustline = false
        try {
          const tlRes = await fetch(
            `/api/xrpl/has-trustline?address=${currentInvestor.wallet_address}&currency=${selectedAsset.token_symbol}&issuer=${selectedAsset.issuer_wallet}`
          )
          const tlData = await tlRes.json()
          hasTrustline = tlData.hasTrustline === true
        } catch {
          // If check fails, assume no trust line
        }

        if (hasTrustline) {
          // Trust line exists — create Payment QR so investor pays issuer
          console.log('[xaman-buy] Trust line exists, creating payment QR')
          try {
            const totalCostUsd = buyDetails.tokenAmount * buyDetails.pricePerToken
            const payRes = await fetch('/api/xrpl/create-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                investorAddress: buyDetails.investorAddress,
                issuerWallet: buyDetails.issuerWallet,
                amount: totalCostUsd,
                payCurrency: payCurrency,
              }),
            })
            const payData = await payRes.json()

            if (payData.uuid) {
              setPendingXamanPayment({
                orderId: buyDetails.orderId,
                tokenAmount: buyDetails.tokenAmount,
                tokenSymbol: buyDetails.tokenSymbol,
                issuerWallet: buyDetails.issuerWallet,
                pricePerToken: buyDetails.pricePerToken,
                investorAddress: buyDetails.investorAddress,
                payCurrency: payCurrency,
              })
              setXamanUuid(payData.uuid)
              setXamanQrUrl(payData.qrUrl)
              setXamanDeepLink(payData.deepLink)
              sessionStorage.setItem('xamanUuid', payData.uuid)
              if (payData.qrUrl) sessionStorage.setItem('xamanQrUrl', payData.qrUrl)
              if (payData.deepLink) sessionStorage.setItem('xamanDeepLink', payData.deepLink)
              setSubmitting(false)
              return
            } else {
              throw new Error(payData.error ?? 'Failed to create payment request')
            }
          } catch (err) {
            console.error('[xaman-buy] Payment QR creation failed:', err)
            throw new Error(err instanceof Error ? err.message : 'Failed to create payment.')
          }
        } else {
          // No trust line — 1 QR for TrustSet, then auto-deliver after signing
          try {
            const trustRes = await fetch('/api/xrpl/create-trustline', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                investorAddress: currentInvestor.wallet_address,
                tokenSymbol: selectedAsset.token_symbol,
                issuerWallet: selectedAsset.issuer_wallet,
              }),
            })
            const trustData = await trustRes.json()
            if (trustData.error) throw new Error(trustData.error)

            if (trustData.uuid) {
              setPendingXamanBuy(buyDetails)
              setXamanUuid(trustData.uuid)
              setXamanQrUrl(trustData.qrUrl)
              setXamanDeepLink(trustData.deepLink)
              sessionStorage.setItem('xamanUuid', trustData.uuid)
              if (trustData.qrUrl) sessionStorage.setItem('xamanQrUrl', trustData.qrUrl)
              if (trustData.deepLink) sessionStorage.setItem('xamanDeepLink', trustData.deepLink)
              setSubmitting(false)
              return
            }
          } catch (err) {
            console.error('[xaman-buy] TrustSet creation failed:', err)
            throw new Error('Failed to create trust line request. Please try again.')
          }
        }
      } else {
        // SELL via Xaman: Just list on marketplace — no XRPL transaction needed.
        // Tokens stay in the seller's wallet until a buyer matches the order.
        setSuccess(`${parseFloat(amount)} ${selectedAsset.token_symbol} listed for sale at $${parseFloat(price)}/token. Your tokens remain in your wallet until sold.`)
        setAmount('')
        router.refresh()
        setTimeout(() => setSuccess(null), 5000)
        setSubmitting(false)
        return
      }

      setSuccess(`${orderSide === 'buy' ? 'Buy' : 'Sell'} order placed successfully`)
      setAmount('')
      router.refresh()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place order')
    } finally {
      setSubmitting(false)
    }
  }

  function handleMoonpayComplete() {
    setShowMoonpayModal(false)
    setSuccess('Payment initiated! Your tokens will be purchased automatically once MoonPay confirms the transaction.')
    setAmount('')
    router.refresh()
    setTimeout(() => setSuccess(null), 8000)
  }

  async function handleOfferSigned() {
    setXamanUuid(null)
    setXamanQrUrl(null)
    setXamanDeepLink(null)
    // Clear persisted state
    sessionStorage.removeItem('xamanUuid')
    sessionStorage.removeItem('xamanQrUrl')
    sessionStorage.removeItem('xamanDeepLink')
    sessionStorage.removeItem('pendingXamanPayment')

    // Step 1 complete: TrustSet signed — now create Payment QR so investor pays issuer
    if (pendingXamanBuy) {
      const buy = pendingXamanBuy
      setPendingXamanBuy(null)
      setError(null)
      setSuccess('Trust line confirmed! Now sign the XRP payment...')
      console.log('[xaman-buy] TrustSet signed, creating payment QR:', buy)

      try {
        const totalCostUsd = buy.tokenAmount * buy.pricePerToken
        const payRes = await fetch('/api/xrpl/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            investorAddress: buy.investorAddress,
            issuerWallet: buy.issuerWallet,
            amount: totalCostUsd,
            payCurrency: payCurrency,
          }),
        })
        const payData = await payRes.json()

        if (payData.uuid) {
          setPendingXamanPayment({
            orderId: buy.orderId,
            tokenAmount: buy.tokenAmount,
            tokenSymbol: buy.tokenSymbol,
            issuerWallet: buy.issuerWallet,
            pricePerToken: buy.pricePerToken,
            investorAddress: buy.investorAddress,
            payCurrency: payCurrency,
          })
          setXamanUuid(payData.uuid)
          setXamanQrUrl(payData.qrUrl)
          setXamanDeepLink(payData.deepLink)
          sessionStorage.setItem('xamanUuid', payData.uuid)
          if (payData.qrUrl) sessionStorage.setItem('xamanQrUrl', payData.qrUrl)
          if (payData.deepLink) sessionStorage.setItem('xamanDeepLink', payData.deepLink)
          setSuccess(null)
          return
        } else {
          throw new Error(payData.error ?? 'Failed to create payment request')
        }
      } catch (err) {
        console.error('[xaman-buy] Payment QR creation failed:', err)
        setSuccess(null)
        setError(err instanceof Error ? err.message : 'Failed to create payment request')
      }

      setAmount('')
      setPendingOrderId(null)
      router.refresh()
      setTimeout(() => { setError(null) }, 15000)
      return
    }

    // Step 2 complete: Payment signed — now deliver tokens from issuer
    if (pendingXamanPayment) {
      const pay = pendingXamanPayment
      setPendingXamanPayment(null)
      setError(null)
      setSuccess('Payment confirmed! Delivering tokens now...')
      console.log('[xaman-buy] Payment signed, delivering tokens:', pay)

      try {
        const buyRes = await fetch('/api/wallet/primary-buy-xaman', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: pay.orderId,
            investorAddress: pay.investorAddress,
            tokenAmount: pay.tokenAmount,
            tokenSymbol: pay.tokenSymbol,
            issuerWallet: pay.issuerWallet,
            pricePerToken: pay.pricePerToken,
          }),
        })
        const buyData = await buyRes.json()
        console.log('[xaman-buy] primary-buy-xaman response:', buyData)

        if (buyData.hash) {
          if (pay.orderId) setFilledOrderIds((prev) => new Set(prev).add(pay.orderId))
          const matchedAsset = assets.find((a) => a.token_symbol === pay.tokenSymbol)
          setCompletedTx({
            hash: buyData.hash,
            tokenAmount: pay.tokenAmount,
            tokenSymbol: pay.tokenSymbol,
            assetName: matchedAsset?.asset_name ?? pay.tokenSymbol,
            pricePerToken: pay.pricePerToken,
            totalCost: pay.tokenAmount * pay.pricePerToken,
            currency: pay.payCurrency,
            side: 'buy',
          })
          setError(null)
          setSelectedAssetId(null)
        } else {
          setSuccess(null)
          setError(buyData.error ?? 'Token delivery failed')
        }
      } catch (err) {
        console.error('[xaman-buy] Token delivery error:', err)
        setSuccess(null)
        setError('Token delivery failed. Try again from the marketplace.')
      }

      setAmount('')
      setPendingOrderId(null)
      router.refresh()
      setTimeout(() => { setSuccess(null) }, 8000)
      setTimeout(() => { setError(null) }, 15000)
      return
    }

    // Fallback: other Xaman sign completions (e.g. legacy buy offers)
    setPendingOrderId(null)
    setSuccess('Order placed and signed on XRPL!')
    setAmount('')
    router.refresh()
    setTimeout(() => setSuccess(null), 5000)
  }

  function closeXamanModal() {
    setXamanUuid(null)
    setXamanQrUrl(null)
    setXamanDeepLink(null)
    setPendingOrderId(null)
    setPendingXamanBuy(null)
    setPendingXamanPayment(null)
    sessionStorage.removeItem('xamanUuid')
    sessionStorage.removeItem('xamanQrUrl')
    sessionStorage.removeItem('xamanDeepLink')
    setSuccess('Order saved (sign on-chain later from your orders)')
    setAmount('')
    router.refresh()
    setTimeout(() => setSuccess(null), 3000)
  }

  async function cancelOrder(orderId: string) {
    try {
      const res = await fetch(`/api/marketplace/orders?id=${orderId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel')
    }
  }

  // My orders
  const myOrders = currentInvestor
    ? liveOrders.filter((o) => o.investor_id === currentInvestor.id)
    : []

  // Secondary market listings — open sell orders with enriched asset info
  // Calculate remaining tokens: token_amount - filled_amount - optimistic fills
  const secondaryListings = liveOrders
    .filter((o) => o.side === 'sell' && (o.status === 'open' || o.status === 'partial'))
    .map((o) => {
      const asset = assets.find((a) => a.id === o.asset_id)
      const optimisticExtra = optimisticFills[o.id] ?? 0
      const remaining = o.token_amount - (o.filled_amount ?? 0) - optimisticExtra
      return { ...o, remaining_tokens: remaining, asset: asset ?? null }
    })
    .filter((o) => o.asset !== null && o.remaining_tokens > 0)

  const renderOrderForm = () => {
    if (!selectedAsset) return null
    if (!currentInvestor) {
      return (
        <div className="rounded-lg border border-warning/20 bg-status-warning p-4 text-center">
          <ShieldAlert className="mx-auto h-6 w-6 text-warning mb-2" />
          <p className="text-sm text-warning">
            You must be an approved platform investor to trade.
          </p>
          <p className="text-xs text-muted-foreground mt-1">Contact your platform administrator.</p>
        </div>
      )
    }
    if (currentInvestor.kyc_status !== 'verified') {
      return (
        <div className="rounded-lg border border-warning/20 bg-status-warning p-4 text-center">
          <ShieldAlert className="mx-auto h-6 w-6 text-warning mb-2" />
          <p className="text-sm text-warning">
            Your KYC verification is pending.
          </p>
          <p className="text-xs text-muted-foreground mt-1">You can trade once verified.</p>
        </div>
      )
    }
    return (
      <div className="space-y-5">
        {/* Side toggle */}
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border p-1">
          <button
            onClick={() => { setOrderSide('buy'); setCustomPrice('') }}
            className={`rounded-md py-2 text-sm font-medium transition-colors ${
              orderSide === 'buy'
                ? 'bg-success text-white'
                : 'text-muted-foreground hover:bg-muted/30'
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => { setOrderSide('sell'); setCustomPrice(String(navPrice)) }}
            className={`rounded-md py-2 text-sm font-medium transition-colors ${
              orderSide === 'sell'
                ? 'bg-destructive text-white'
                : 'text-muted-foreground hover:bg-muted/30'
            }`}
          >
            Sell
          </button>
        </div>

        {/* Payment/signing method */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {orderSide === 'buy' ? 'Payment Method' : 'Signing Method'}
          </label>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border p-1">
            <button
              onClick={() => setPaymentMethod('platform')}
              className={`rounded-md py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                paymentMethod === 'platform'
                  ? orderSide === 'buy' ? 'bg-success text-white' : 'bg-destructive text-white'
                  : 'text-muted-foreground hover:bg-muted/30'
              }`}
            >
              <Coins className="h-3.5 w-3.5" />
              Platform Wallet
            </button>
            <button
              onClick={() => setPaymentMethod('xaman')}
              className={`rounded-md py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                paymentMethod === 'xaman'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/30'
              }`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Xaman Wallet
            </button>
          </div>
          {paymentMethod === 'platform' && (
            <p className="text-xs text-muted-foreground">
              {orderSide === 'buy'
                ? 'Pay XRP from your platform wallet. Issuer receives payment, you receive tokens.'
                : 'List tokens for sale on the XRPL DEX via your platform wallet.'}
            </p>
          )}
          {paymentMethod === 'xaman' && (
            <p className="text-xs text-muted-foreground">Sign with your own XRPL wallet via Xaman app.</p>
          )}
        </div>

        {/* Receive currency toggle — hidden for secondary buys (backend auto-handles currency) */}
        {(() => {
          const hasSecondarySell = orderSide === 'buy' && liveOrders.some(
            (o) => o.asset_id === selectedAssetId && o.side === 'sell' && (o.status === 'open' || o.status === 'partial')
              && o.investor_id !== currentInvestor?.id && (o.token_amount - (o.filled_amount ?? 0)) > 0
          )
          if (hasSecondarySell) return null // Currency handled by backend based on seller preference
          return null // Hide for now — primary buys always use XRP
        })()}
        {orderSide === 'sell' && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Receive in</label>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border p-1">
              <button
                onClick={() => setPayCurrency('RLUSD')}
                className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                  payCurrency === 'RLUSD'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted/30'
                }`}
              >
                RLUSD
              </button>
              <button
                onClick={() => setPayCurrency('XRP')}
                className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                  payCurrency === 'XRP'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted/30'
                }`}
              >
                XRP
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Token Amount</label>
          {(() => {
            const secondarySell = orderSide === 'buy' ? liveOrders.find(
              (o) => o.asset_id === selectedAssetId && o.side === 'sell' && (o.status === 'open' || o.status === 'partial')
                && o.investor_id !== currentInvestor?.id
                && (o.token_amount - (o.filled_amount ?? 0)) > 0
            ) : null
            const maxFromSeller = secondarySell
              ? secondarySell.token_amount - (secondarySell.filled_amount ?? 0) - (optimisticFills[secondarySell.id] ?? 0)
              : undefined
            const primaryAvailable = selectedAssetId ? (availableByAssetId[selectedAssetId] ?? null) : null
            const maxAvailable = maxFromSeller ?? primaryAvailable
            return (
              <>
                <input
                  type="number"
                  className="input w-full font-mono"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="0"
                  max={maxAvailable ?? undefined}
                />
                {orderSide === 'buy' && maxFromSeller && secondarySell && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-warning">
                      {maxFromSeller.toLocaleString()} available from seller
                    </p>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setAmount(String(maxFromSeller))}
                    >
                      Max
                    </button>
                  </div>
                )}
                {orderSide === 'buy' && !maxFromSeller && primaryAvailable !== null && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {primaryAvailable.toLocaleString()} of {selectedAsset.token_supply.toLocaleString()} tokens available
                    </p>
                    {primaryAvailable > 0 && (
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => setAmount(String(primaryAvailable))}
                      >
                        Max
                      </button>
                    )}
                  </div>
                )}
                {maxFromSeller && orderSide === 'buy' && parseFloat(amount) > maxFromSeller && (
                  <p className="text-xs text-destructive">
                    Cannot buy more than {maxFromSeller.toLocaleString()} tokens from this listing.
                  </p>
                )}
              </>
            )
          })()}
        </div>

        {/* Price */}
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Price per Token</p>
          {isCustomPriceAllowed ? (
            <>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-lg font-bold text-muted-foreground">$</span>
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder={navPrice.toFixed(4)}
                  className="w-full bg-background rounded-md border border-border px-2.5 py-1.5 text-lg font-bold font-mono outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-[11px] text-muted-foreground">
                  NAV: ${navPrice.toFixed(4)}
                </p>
                {priceNum > 0 && Math.abs(priceDiffPercent) > 0.01 && (
                  <span className={`text-[11px] font-semibold ${
                    priceDiffPercent > 0
                      ? 'text-success'
                      : 'text-destructive'
                  }`}>
                    {priceDiffPercent > 0 ? '+' : ''}{priceDiffPercent.toFixed(1)}% {priceDiffPercent > 0 ? 'above' : 'below'} NAV
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-lg font-bold font-mono mt-0.5">${selectedAsset.nav_per_token.toFixed(4)}</p>
              <p className="text-[11px] text-muted-foreground">Set by asset NAV</p>
            </>
          )}
        </div>

        {totalValue > 0 && (
          <div className="rounded-lg bg-muted/40 p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Cost (USD)</p>
            <p className="text-lg font-bold mt-0.5">{formatUSD(totalValue)}</p>
            {payCurrency === 'XRP' && (
              <p className="text-xs text-muted-foreground mt-1">
                Paid in XRP at live market rate
              </p>
            )}
            {payCurrency === 'RLUSD' && (
              <p className="text-[11px] text-muted-foreground">Paid in RLUSD (1:1 USD)</p>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </div>
        )}
        {success && (
          <p className="text-xs text-success">{success}</p>
        )}

        <Button
          onClick={submitOrder}
          disabled={submitting || !amount || parseFloat(amount) <= 0 || (() => {
            if (orderSide !== 'buy') return false
            const sell = liveOrders.find(
              (o) => o.asset_id === selectedAssetId && o.side === 'sell' && o.status === 'open'
                && o.investor_id !== currentInvestor?.id
            )
            return sell ? parseFloat(amount) > sell.token_amount : false
          })()}
          className={`w-full gap-2 ${
            orderSide === 'buy'
              ? 'bg-success hover:bg-success/90'
              : 'bg-destructive hover:bg-destructive/90'
          }`}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <DollarSign className="h-4 w-4" />
          )}
          {submitting
            ? 'Placing order...'
            : `${orderSide === 'buy' ? 'Buy' : 'Sell'} ${selectedAsset.token_symbol}`}
        </Button>

        {orderSide === 'buy' && totalValue > 0 && (
          <p className="text-xs text-center text-muted-foreground">
            Total: ~{formatUSD(totalValue)} from your platform wallet
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Xaman signing modal for on-chain DEX offers */}
      {xamanUuid && (
        <XamanSignModal
          uuid={xamanUuid}
          qrUrl={xamanQrUrl}
          deepLink={xamanDeepLink}
          instruction={pendingXamanBuy
            ? `Step 1/2: Set trust line for ${selectedAsset?.token_symbol ?? 'tokens'}`
            : pendingXamanPayment
            ? `Step 2/2: Pay ${(pendingXamanPayment.tokenAmount * pendingXamanPayment.pricePerToken).toFixed(2)} ${pendingXamanPayment.payCurrency} to purchase ${pendingXamanPayment.tokenAmount} ${pendingXamanPayment.tokenSymbol}`
            : `Sign sell offer: ${amount || '?'} ${selectedAsset?.token_symbol ?? 'tokens'} at $${selectedAsset?.nav_per_token.toFixed(4) ?? '0'} each`
          }
          onSigned={handleOfferSigned}
          onExpired={closeXamanModal}
          onCancel={closeXamanModal}
        />
      )}

      {/* MoonPay buy modal */}
      {selectedAsset && (
        <MoonPayBuyModal
          open={showMoonpayModal}
          onClose={() => setShowMoonpayModal(false)}
          onComplete={handleMoonpayComplete}
          asset={selectedAsset}
          tokenAmount={parseFloat(amount || '0')}
          payCurrency={payCurrency}
        />
      )}

      {/* Transaction Complete Sheet */}
      <TransactionCompleteSheet
        tx={completedTx}
        onClose={() => setCompletedTx(null)}
        isTestnet={true}
      />

      {/* Supply limit error popup */}
      {supplyError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSupplyError(null)} />
          <div className="relative mx-4 w-full max-w-sm animate-in rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold">Not Enough Tokens</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                You requested <span className="font-semibold text-foreground">{supplyError.requested.toLocaleString()} {supplyError.symbol}</span> but
                only <span className="font-semibold text-foreground">{supplyError.available.toLocaleString()}</span> tokens are available for purchase.
              </p>
              {supplyError.available > 0 && (
                <button
                  onClick={() => {
                    setAmount(String(supplyError.available))
                    setSupplyError(null)
                  }}
                  className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Buy {supplyError.available.toLocaleString()} {supplyError.symbol} instead
                </button>
              )}
              <button
                onClick={() => setSupplyError(null)}
                className="mt-2 w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50"
              >
                {supplyError.available > 0 ? 'Cancel' : 'Got it'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketplace</h1>
        <p className="text-base text-muted-foreground">
          Buy and sell tokenized assets within the permission domain
        </p>
      </div>

      {/* Market tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-border p-1.5 w-fit">
        {([
          { key: 'all' as MarketTab, label: 'All', icon: Store },
          { key: 'primary' as MarketTab, label: 'Primary', icon: Building2 },
          { key: 'secondary' as MarketTab, label: 'Secondary', icon: Repeat },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMarketTab(key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 ${
              marketTab === key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {key === 'secondary' && secondaryListings.length > 0 && (
              <Badge variant="outline" className="ml-0.5 text-xs rounded-full px-2 py-0">
                {secondaryListings.length}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Primary asset cards */}
      {(marketTab === 'all' || marketTab === 'primary') && (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((asset) => {
          const assetTradeCount = filledOrders.filter((o) => o.asset_id === asset.id).length
          const isSelected = selectedAssetId === asset.id
          return (
            <Card
              key={asset.id}
              className={`cursor-pointer transition-all ${
                isSelected ? 'ring-2 ring-primary' : 'hover:border-primary/50'
              }`}
              onClick={() => {
                setSelectedAssetId(isSelected ? null : asset.id)
              }}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base">{asset.asset_name}</h3>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Badge variant="outline" className="text-xs rounded-full px-2.5">{asset.token_symbol}</Badge>
                      <Badge className="text-xs rounded-full px-2.5 bg-muted/60 text-muted-foreground">{asset.asset_type}</Badge>
                      {asset.access_type === 'private' && (
                        <Badge className="text-xs rounded-full px-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 gap-1">
                          <Lock className="h-2.5 w-2.5" />
                          Private
                        </Badge>
                      )}
                      {asset.third_party_verified && (
                        <Badge className="text-xs rounded-full px-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1">
                          <ShieldCheck className="h-2.5 w-2.5" />
                          Verified
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Building2 className="h-5 w-5 text-muted-foreground/40" />
                </div>
                {(asset.location || asset.total_acres) && (
                  <p className="text-xs text-muted-foreground mb-2">
                    {asset.location}{asset.location && asset.total_acres ? ' · ' : ''}{asset.total_acres ? `${asset.total_acres.toLocaleString()} acres` : ''}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Valuation</p>
                    <p className="font-bold mt-0.5 tabular-nums">{formatUSD(asset.current_valuation)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">NAV/Token</p>
                    <p className="font-bold font-mono mt-0.5 tabular-nums">${asset.nav_per_token.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Est. Yield</p>
                    <p className="font-bold mt-0.5 tabular-nums">{asset.annual_yield ? `${asset.annual_yield}%` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Royalties</p>
                    <p className="font-bold mt-0.5 capitalize">{formatFrequency(asset.royalty_frequency)}</p>
                  </div>
                </div>
                <button
                  className="mt-4 flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
                  onClick={(e) => { e.stopPropagation(); setDetailAssetId(asset.id) }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View land details
                </button>
              </CardContent>
            </Card>
          )
        })}
      </div>
      )}

      {/* Secondary market listings — investor sell orders */}
      {(marketTab === 'all' || marketTab === 'secondary') && secondaryListings.length > 0 && (
        <>
          {marketTab === 'all' && (
            <div className="flex items-center gap-2 pt-2">
              <Repeat className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Secondary Market</h2>
              <Badge variant="outline" className="text-xs">{secondaryListings.length} listing{secondaryListings.length !== 1 ? 's' : ''}</Badge>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {secondaryListings.map((listing) => {
              const asset = listing.asset!
              const isSelected = selectedAssetId === asset.id
              return (
                <Card
                  key={listing.id}
                  className={`cursor-pointer transition-all relative ${
                    isSelected ? 'ring-2 ring-primary' : 'hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedAssetId(isSelected ? null : asset.id)}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{asset.asset_name}</h3>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="outline" className="text-xs rounded-full px-2.5">{asset.token_symbol}</Badge>
                          <Badge className="text-xs rounded-full px-2.5 bg-status-warning text-warning border-warning/20">
                            Secondary
                          </Badge>
                          {asset.access_type === 'private' && (
                            <Badge className="text-xs rounded-full px-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 gap-1">
                              <Lock className="h-2.5 w-2.5" />
                              Private
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Users className="h-5 w-5 text-muted-foreground/40" />
                    </div>

                    {(asset.location || asset.total_acres) && (
                      <p className="text-xs text-muted-foreground mb-2">
                        {asset.location}{asset.location && asset.total_acres ? ' · ' : ''}{asset.total_acres ? `${asset.total_acres.toLocaleString()} acres` : ''}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Ask Price</p>
                        <p className="font-bold font-mono mt-0.5 tabular-nums text-destructive">
                          ${listing.price_per_token.toFixed(4)}
                        </p>
                        {listing.asset && (() => {
                          const nav = listing.asset.nav_per_token
                          const diff = nav > 0 ? ((listing.price_per_token - nav) / nav) * 100 : 0
                          if (Math.abs(diff) < 0.01) return null
                          return (
                            <p className={`text-xs font-semibold mt-0.5 ${diff > 0 ? 'text-success' : 'text-destructive'}`}>
                              {diff > 0 ? '+' : ''}{diff.toFixed(1)}% vs NAV
                            </p>
                          )
                        })()}
                      </div>
                      <div>
                        <p className="text-muted-foreground">NAV</p>
                        <p className="font-bold font-mono mt-0.5 tabular-nums">${listing.asset?.nav_per_token.toFixed(4)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Available</p>
                        <p className="font-bold mt-0.5 tabular-nums">{listing.remaining_tokens.toLocaleString()} tokens</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total Value</p>
                        <p className="font-bold mt-0.5 tabular-nums">{formatUSD(listing.remaining_tokens * listing.price_per_token)}</p>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-muted-foreground">
                      Listed {timeAgo(listing.created_at)}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {marketTab === 'secondary' && secondaryListings.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Repeat className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-base text-muted-foreground font-medium">No secondary market listings yet</p>
            <p className="text-sm text-muted-foreground mt-1.5">When investors list tokens for sale, they&apos;ll appear here.</p>
          </CardContent>
        </Card>
      )}

      {/* Trade History + Place Order */}
      {selectedAsset && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            {/* Trade History — completed transactions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  Trade History — {selectedAsset.token_symbol}
                </CardTitle>
                <CardDescription>
                  {assetTrades.length} completed trade{assetTrades.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {assetTrades.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">
                    No trades yet. Be the first to buy {selectedAsset.token_symbol}!
                  </p>
                ) : (
                  <div className="space-y-1">
                    {assetTrades.map((t) => (
                      <div key={t.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs rounded-full px-2.5 ${
                            t.side === 'buy' ? 'bg-status-success text-success' : 'bg-status-danger text-destructive'
                          }`}>
                            {t.side.toUpperCase()}
                          </Badge>
                          <span className="font-mono tabular-nums">{t.token_amount.toLocaleString()} tokens</span>
                        </div>
                        <span className="font-mono text-muted-foreground tabular-nums">${t.price_per_token.toFixed(4)}</span>
                        <span className="font-mono font-medium tabular-nums">{formatUSD(t.token_amount * t.price_per_token)}</span>
                        <span className="text-muted-foreground">{timeAgo(t.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Open sell orders (secondary market) */}
            {sellOrders.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Open Sell Orders</CardTitle>
                  <CardDescription>Secondary market — investors selling their tokens</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {sellOrders.map((o) => {
                      const nav = selectedAsset?.nav_per_token ?? 0
                      const diff = nav > 0 ? ((o.price_per_token - nav) / nav) * 100 : 0
                      return (
                        <div key={o.id} className="flex items-center justify-between rounded-md bg-destructive/5 border border-destructive/10 px-3 py-1.5 text-xs">
                          <span className="font-mono text-destructive tabular-nums">${o.price_per_token.toFixed(4)}</span>
                          {Math.abs(diff) > 0.01 && (
                            <span className={`text-xs font-semibold ${diff > 0 ? 'text-success' : 'text-destructive'}`}>
                              {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                            </span>
                          )}
                          <span className="text-muted-foreground tabular-nums">{o.token_amount.toLocaleString()}</span>
                          <span className="font-mono tabular-nums">{formatUSD(o.token_amount * o.price_per_token)}</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* My Open Orders */}
            {myOrders.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">My Open Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {myOrders.map((o) => (
                      <div key={o.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs ${
                            o.side === 'buy' ? 'bg-status-success text-success' : 'bg-status-danger text-destructive'
                          }`}>
                            {o.side.toUpperCase()}
                          </Badge>
                          <span className="font-medium">{o.assets?.token_symbol}</span>
                          <span className="text-muted-foreground">{o.token_amount.toLocaleString()} @ ${o.price_per_token.toFixed(4)}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-destructive"
                          onClick={() => cancelOrder(o.id)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Place Order — desktop only (mobile uses bottom sheet) */}
          <div className="hidden lg:block">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Place Order
                </CardTitle>
                <CardDescription>{selectedAsset.token_symbol} — {selectedAsset.asset_name}</CardDescription>
              </CardHeader>
              <CardContent>
                {renderOrderForm()}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Mobile/tablet trade sheet */}
      {selectedAsset && (
        <>
          <div className="fixed bottom-24 right-6 lg:hidden z-30">
            <Button
              size="lg"
              className="rounded-full shadow-lg gap-2 px-6"
              onClick={() => setShowTradeSheet(true)}
            >
              <TrendingUp className="h-4 w-4" />
              Trade {selectedAsset.token_symbol}
            </Button>
          </div>
          <Sheet open={showTradeSheet} onOpenChange={setShowTradeSheet}>
            <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>Trade {selectedAsset.token_symbol}</SheetTitle>
                <SheetDescription>{selectedAsset.asset_name}</SheetDescription>
              </SheetHeader>
              <div className="mt-6">
                {renderOrderForm()}
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}

      {/* Asset detail side sheet */}
      <Sheet open={!!detailAssetId} onOpenChange={(open) => { if (!open) setDetailAssetId(null) }}>
        <SheetContent side="right" className="overflow-y-auto">
          {(() => {
            const asset = assets.find((a) => a.id === detailAssetId)
            if (!asset) return null
            const tradeCount = filledOrders.filter((o) => o.asset_id === asset.id).length
            const contract = contracts.find((c) => c.asset_id === asset.id)
            const assetDistributions = distributions.filter((d) => d.asset_id === asset.id)
            const lastDistribution = assetDistributions[0]
            return (
              <>
                <SheetHeader>
                  <SheetTitle>{asset.asset_name}</SheetTitle>
                  <SheetDescription className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{asset.token_symbol}</Badge>
                    <Badge className="text-xs bg-muted/60 text-muted-foreground">{asset.asset_type}</Badge>
                    {asset.ai_rating && (
                      <Badge className={`text-xs ${
                        asset.ai_rating >= 7 ? 'bg-status-success text-success' :
                        asset.ai_rating >= 4 ? 'bg-status-warning text-warning' :
                        'bg-status-danger text-destructive'
                      }`}>
                        AI: {asset.ai_rating}/10
                      </Badge>
                    )}
                  </SheetDescription>
                </SheetHeader>

                <div className="space-y-5 mt-2">
                  {asset.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0" />
                      {asset.location}
                      {asset.total_acres ? ` · ${asset.total_acres.toLocaleString()} acres` : ''}
                    </div>
                  )}

                  {/* Key financials */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-[11px] text-muted-foreground">Valuation</p>
                      <p className="text-lg font-bold tabular-nums">{formatUSD(asset.current_valuation)}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-[11px] text-muted-foreground">NAV / Token</p>
                      <p className="text-lg font-bold font-mono tabular-nums">${asset.nav_per_token.toFixed(4)}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-[11px] text-muted-foreground">Est. Annual Yield</p>
                      <p className="text-lg font-bold tabular-nums">{asset.annual_yield ? `${asset.annual_yield}%` : '—'}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-[11px] text-muted-foreground">Token Supply</p>
                      <p className="text-lg font-bold tabular-nums">{Number(asset.token_supply).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Royalty info */}
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
                        <Coins className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Royalty Information</p>
                        <p className="text-[11px] text-muted-foreground">Income distributed to token holders</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[11px] text-muted-foreground">Frequency</p>
                        <p className="font-medium capitalize">{formatFrequency(asset.royalty_frequency)}</p>
                      </div>
                      {contract?.annual_amount && (
                        <div>
                          <p className="text-[11px] text-muted-foreground">Annual Income</p>
                          <p className="font-medium tabular-nums">{formatUSD(contract.annual_amount)}</p>
                        </div>
                      )}
                      {contract?.tenant_name && (
                        <div>
                          <p className="text-[11px] text-muted-foreground">Tenant</p>
                          <p className="font-medium">{contract.tenant_name}</p>
                        </div>
                      )}
                      {contract?.lease_end_date && (
                        <div>
                          <p className="text-[11px] text-muted-foreground">Lease Through</p>
                          <p className="font-medium">{new Date(contract.lease_end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>
                        </div>
                      )}
                    </div>
                    {contract?.annual_amount && asset.current_valuation > 0 && (
                      <div className="rounded-md bg-background/60 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">Implied Yield from Lease</p>
                        <p className="text-sm font-bold tabular-nums text-primary">
                          {((contract.annual_amount / asset.current_valuation) * 100).toFixed(2)}%
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Distribution history */}
                  {assetDistributions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        Recent Distributions
                      </p>
                      <div className="space-y-1.5">
                        {assetDistributions.slice(0, 5).map((d, i) => (
                          <div key={i} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs">
                            <span className="text-muted-foreground">{d.royalty_period ?? new Date(d.created_at).toLocaleDateString()}</span>
                            <span className="font-mono font-medium tabular-nums">{formatUSD(d.total_amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!contract && assetDistributions.length === 0 && (
                    <div className="rounded-lg border border-border p-4 text-center">
                      <Coins className="mx-auto h-6 w-6 text-muted-foreground/30 mb-1.5" />
                      <p className="text-xs text-muted-foreground">No lease or distribution data yet.</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Royalty details will appear once a contract is uploaded.</p>
                    </div>
                  )}

                  {/* Trade activity */}
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-[11px] text-muted-foreground">Completed Trades</p>
                    <p className="text-lg font-bold tabular-nums">{tradeCount}</p>
                  </div>

                  <div className="rounded-lg border border-border p-3">
                    <p className="text-[11px] text-muted-foreground mb-1">Issuer Wallet</p>
                    <p className="font-mono text-xs break-all">{asset.issuer_wallet}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="flex-1 gap-2"
                      onClick={() => {
                        setDetailAssetId(null)
                        setSelectedAssetId(asset.id)
                        setOrderSide('buy')
                      }}
                    >
                      <DollarSign className="h-4 w-4" />
                      Buy {asset.token_symbol}
                    </Button>
                    <Link
                      href={`/dashboard/assets/${asset.id}`}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Full Details
                    </Link>
                  </div>
                </div>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>
    </div>
  )
}
