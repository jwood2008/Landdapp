'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Store, TrendingUp, Building2, DollarSign, ArrowUpDown,
  Loader2, ShieldAlert, AlertCircle, ExternalLink, CreditCard, Wallet,
  Coins, Calendar, MapPin, Users, Repeat,
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

export function MarketplaceBrowser({ assets, orders, filledOrders, currentInvestor, settings, contracts = [], distributions = [] }: Props) {
  const router = useRouter()
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('')
  const [payCurrency, setPayCurrency] = useState<'RLUSD' | 'XRP'>('XRP')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [detailAssetId, setDetailAssetId] = useState<string | null>(null)
  const [marketTab, setMarketTab] = useState<MarketTab>('all')

  // Payment method: moonpay (custodial, primary) or xaman (self-custody)
  const [paymentMethod, setPaymentMethod] = useState<'moonpay' | 'xaman'>('moonpay')
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

  // Open orders (pending on DEX — mainly sell orders)
  const assetOrders = selectedAssetId
    ? orders.filter((o) => o.asset_id === selectedAssetId)
    : []
  const buyOrders = assetOrders
    .filter((o) => o.side === 'buy')
    .sort((a, b) => b.price_per_token - a.price_per_token)
  const sellOrders = assetOrders
    .filter((o) => o.side === 'sell')
    .sort((a, b) => a.price_per_token - b.price_per_token)

  // Price is always the asset's NAV per token — not user-editable
  const price = selectedAsset ? String(selectedAsset.nav_per_token) : '0'
  const totalValue = parseFloat(amount || '0') * parseFloat(price || '0')

  if (!settings?.marketplace_enabled) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketplace</h1>
          <p className="text-muted-foreground">Secondary market for tokenized assets</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Store className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">The marketplace is currently disabled by the platform administrator.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  async function submitOrder() {
    if (!selectedAssetId || !amount || !price || !selectedAsset || !currentInvestor) return

    // MoonPay flow for buy orders — open modal instead of Xaman
    if (orderSide === 'buy' && paymentMethod === 'moonpay') {
      setShowMoonpayModal(true)
      return
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

      // 2. Primary market buy — issuer sends tokens directly to investor (instant)
      if (orderSide === 'buy' && paymentMethod !== 'xaman') {
        try {
          const buyRes = await fetch('/api/wallet/primary-buy', {
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
          const buyData = await buyRes.json()

          if (buyData.hash) {
            setSuccess(`Purchased ${amount} ${selectedAsset.token_symbol}! Tx: ${buyData.hash.slice(0, 12)}...`)
            setAmount('')
            router.refresh()
            setTimeout(() => setSuccess(null), 5000)
            return
          }

          if (buyData.error) {
            // Show the error to the user — don't silently fail
            throw new Error(buyData.error)
          }
        } catch (err) {
          if (err instanceof Error && err.message) {
            throw err // Re-throw with the specific error message
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
            setSuccess(`Sell order placed on XRPL! Hash: ${tradeData.hash.slice(0, 12)}...`)
            setAmount('')
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
          // Trust line exists — go directly to payment (1 signing)
          console.log('[xaman-buy] Trust line exists, skipping to payment')
          const totalCost = buyDetails.tokenAmount * buyDetails.pricePerToken
          try {
            const payRes = await fetch('/api/xrpl/create-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                investorAddress: currentInvestor.wallet_address,
                issuerWallet: selectedAsset.issuer_wallet,
                amount: totalCost,
                payCurrency,
              }),
            })
            const payData = await payRes.json()
            if (payData.error) throw new Error(payData.error)

            if (payData.uuid) {
              setPendingXamanPayment({ ...buyDetails, payCurrency })
              setXamanUuid(payData.uuid)
              setXamanQrUrl(payData.qrUrl)
              setXamanDeepLink(payData.deepLink)
              sessionStorage.setItem('xamanUuid', payData.uuid)
              if (payData.qrUrl) sessionStorage.setItem('xamanQrUrl', payData.qrUrl)
              if (payData.deepLink) sessionStorage.setItem('xamanDeepLink', payData.deepLink)
              setSubmitting(false)
              return
            }
          } catch (err) {
            console.error('[xaman-buy] Payment creation failed:', err)
            throw new Error(err instanceof Error ? err.message : 'Failed to create payment request.')
          }
        } else {
          // No trust line — need TrustSet first (2 signings)
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
        // SELL via Xaman: OfferCreate on DEX (secondary market)
        try {
          const offerRes = await fetch('/api/xrpl/create-offer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId,
              investorAddress: currentInvestor.wallet_address,
              side: orderSide,
              tokenAmount: parseFloat(amount),
              pricePerToken: parseFloat(price),
              tokenSymbol: selectedAsset.token_symbol,
              issuerWallet: selectedAsset.issuer_wallet,
              currency: payCurrency,
            }),
          })
          const offerData = await offerRes.json()

          if (offerData.uuid) {
            setXamanUuid(offerData.uuid)
            setXamanQrUrl(offerData.qrUrl)
            setXamanDeepLink(offerData.deepLink)
            setSubmitting(false)
            return
          }
        } catch {
          // On-chain offer failed
        }
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

    // Step 1 complete: TrustSet signed — now prompt investor to pay
    if (pendingXamanBuy) {
      const buy = pendingXamanBuy
      setPendingXamanBuy(null)
      setError(null)
      setSuccess('Trust line confirmed! Now sign the payment...')
      console.log('[xaman-buy] TrustSet signed, creating payment payload:', buy)

      const totalCost = buy.tokenAmount * buy.pricePerToken
      const currency = payCurrency || 'XRP'

      try {
        const payRes = await fetch('/api/xrpl/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            investorAddress: buy.investorAddress,
            issuerWallet: buy.issuerWallet,
            amount: totalCost,
            payCurrency: currency,
          }),
        })
        const payData = await payRes.json()

        if (payData.error) {
          setSuccess(null)
          setError(payData.error)
          return
        }

        if (payData.uuid) {
          // Save payment details for after Payment is signed
          setPendingXamanPayment({
            orderId: buy.orderId,
            tokenAmount: buy.tokenAmount,
            tokenSymbol: buy.tokenSymbol,
            issuerWallet: buy.issuerWallet,
            pricePerToken: buy.pricePerToken,
            investorAddress: buy.investorAddress,
            payCurrency: currency,
          })
          setXamanUuid(payData.uuid)
          setXamanQrUrl(payData.qrUrl)
          setXamanDeepLink(payData.deepLink)
          sessionStorage.setItem('xamanUuid', payData.uuid)
          if (payData.qrUrl) sessionStorage.setItem('xamanQrUrl', payData.qrUrl)
          if (payData.deepLink) sessionStorage.setItem('xamanDeepLink', payData.deepLink)
          setSuccess(null)
          return
        }
      } catch (err) {
        console.error('[xaman-buy] Payment payload creation failed:', err)
        setSuccess(null)
        setError('Failed to create payment request. Please try again.')
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
          setSuccess(`Purchased ${pay.tokenAmount} ${pay.tokenSymbol}! Tx: ${buyData.hash.slice(0, 12)}...`)
          setError(null)
        } else {
          setSuccess(null)
          setError(buyData.error ?? 'Token delivery failed after payment')
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

    // Normal sell order signed
    setPendingOrderId(null)
    setSuccess('Order placed and signed on XRPL! Portfolio syncing...')
    setAmount('')
    router.refresh()

    // Auto-sync holdings after a short delay
    if (currentInvestor?.wallet_address) {
      setTimeout(async () => {
        try {
          await fetch('/api/sync-holdings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: currentInvestor.wallet_address }),
          })
        } catch {
          // Silent
        }
      }, 4000)
    }

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
    ? orders.filter((o) => o.investor_id === currentInvestor.id)
    : []

  // Secondary market listings — open sell orders with enriched asset info
  const secondaryListings = orders
    .filter((o) => o.side === 'sell' && o.status === 'open')
    .map((o) => {
      const asset = assets.find((a) => a.id === o.asset_id)
      return { ...o, asset: asset ?? null }
    })
    .filter((o) => o.asset !== null)

  return (
    <div className="space-y-6">
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

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marketplace</h1>
        <p className="text-muted-foreground">
          Buy and sell tokenized assets within the permission domain
        </p>
      </div>

      {/* Market tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-border p-1 w-fit">
        {([
          { key: 'all' as MarketTab, label: 'All', icon: Store },
          { key: 'primary' as MarketTab, label: 'Primary', icon: Building2 },
          { key: 'secondary' as MarketTab, label: 'Secondary', icon: Repeat },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMarketTab(key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              marketTab === key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/50'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {key === 'secondary' && secondaryListings.length > 0 && (
              <Badge variant="outline" className="ml-0.5 text-[10px] px-1.5 py-0">
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
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{asset.asset_name}</h3>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="outline" className="text-[10px]">{asset.token_symbol}</Badge>
                      <Badge className="text-[10px] bg-muted/60 text-muted-foreground">{asset.asset_type}</Badge>
                    </div>
                  </div>
                  <Building2 className="h-5 w-5 text-muted-foreground/40" />
                </div>
                {(asset.location || asset.total_acres) && (
                  <p className="text-xs text-muted-foreground mb-2">
                    {asset.location}{asset.location && asset.total_acres ? ' · ' : ''}{asset.total_acres ? `${asset.total_acres.toLocaleString()} acres` : ''}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3 text-xs">
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
                  className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
                  onClick={(e) => { e.stopPropagation(); setDetailAssetId(asset.id) }}
                >
                  <ExternalLink className="h-3 w-3" />
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
              <Badge variant="outline" className="text-[10px]">{secondaryListings.length} listing{secondaryListings.length !== 1 ? 's' : ''}</Badge>
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
                          <Badge variant="outline" className="text-[10px]">{asset.token_symbol}</Badge>
                          <Badge className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                            Secondary
                          </Badge>
                        </div>
                      </div>
                      <Users className="h-5 w-5 text-muted-foreground/40" />
                    </div>

                    {(asset.location || asset.total_acres) && (
                      <p className="text-xs text-muted-foreground mb-2">
                        {asset.location}{asset.location && asset.total_acres ? ' · ' : ''}{asset.total_acres ? `${asset.total_acres.toLocaleString()} acres` : ''}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Ask Price</p>
                        <p className="font-bold font-mono mt-0.5 tabular-nums text-red-600 dark:text-red-400">
                          ${listing.price_per_token.toFixed(4)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Available</p>
                        <p className="font-bold mt-0.5 tabular-nums">{listing.token_amount.toLocaleString()} tokens</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total Value</p>
                        <p className="font-bold mt-0.5 tabular-nums">{formatUSD(listing.token_amount * listing.price_per_token)}</p>
                      </div>
                    </div>

                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Listed {timeAgo(listing.created_at)} by investor
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
            <Repeat className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No secondary market listings yet.</p>
            <p className="text-xs text-muted-foreground mt-1">When investors list tokens for sale, they&apos;ll appear here.</p>
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
                          <Badge className={`text-[10px] ${
                            t.side === 'buy' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
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
                    {sellOrders.map((o) => (
                      <div key={o.id} className="flex items-center justify-between rounded-md bg-red-500/5 border border-red-500/10 px-3 py-1.5 text-xs">
                        <span className="font-mono text-red-600 dark:text-red-400 tabular-nums">${o.price_per_token.toFixed(4)}</span>
                        <span className="text-muted-foreground tabular-nums">{o.token_amount.toLocaleString()}</span>
                        <span className="font-mono tabular-nums">{formatUSD(o.token_amount * o.price_per_token)}</span>
                      </div>
                    ))}
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
                          <Badge className={`text-[10px] ${
                            o.side === 'buy' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                          }`}>
                            {o.side.toUpperCase()}
                          </Badge>
                          <span className="font-medium">{o.assets?.token_symbol}</span>
                          <span className="text-muted-foreground">{o.token_amount.toLocaleString()} @ ${o.price_per_token.toFixed(4)}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-destructive"
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

          {/* Place Order */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Place Order
                </CardTitle>
                <CardDescription>{selectedAsset.token_symbol} — {selectedAsset.asset_name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!currentInvestor ? (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-center">
                    <ShieldAlert className="mx-auto h-6 w-6 text-amber-500 mb-2" />
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      You must be an approved platform investor to trade.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Contact your platform administrator.</p>
                  </div>
                ) : currentInvestor.kyc_status !== 'verified' ? (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-center">
                    <ShieldAlert className="mx-auto h-6 w-6 text-amber-500 mb-2" />
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      Your KYC verification is pending.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">You can trade once verified.</p>
                  </div>
                ) : (
                  <>
                    {/* Side toggle */}
                    <div className="grid grid-cols-2 gap-1 rounded-lg border border-border p-1">
                      <button
                        onClick={() => setOrderSide('buy')}
                        className={`rounded-md py-2 text-sm font-medium transition-colors ${
                          orderSide === 'buy'
                            ? 'bg-green-500 text-white'
                            : 'text-muted-foreground hover:bg-muted/30'
                        }`}
                      >
                        Buy
                      </button>
                      <button
                        onClick={() => setOrderSide('sell')}
                        className={`rounded-md py-2 text-sm font-medium transition-colors ${
                          orderSide === 'sell'
                            ? 'bg-red-500 text-white'
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
                          onClick={() => setPaymentMethod('moonpay')}
                          className={`rounded-md py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                            paymentMethod === 'moonpay'
                              ? orderSide === 'buy' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                              : 'text-muted-foreground hover:bg-muted/30'
                          }`}
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          {orderSide === 'buy' ? 'USD (MoonPay)' : 'Platform Wallet'}
                        </button>
                        <button
                          onClick={() => setPaymentMethod('xaman')}
                          className={`rounded-md py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                            paymentMethod === 'xaman'
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-muted/30'
                          }`}
                        >
                          <Wallet className="h-3.5 w-3.5" />
                          Xaman Wallet
                        </button>
                      </div>
                      {orderSide === 'buy' && paymentMethod === 'moonpay' && (
                        <p className="text-[10px] text-muted-foreground">Pay with debit card or bank transfer. No crypto wallet needed.</p>
                      )}
                      {orderSide === 'sell' && paymentMethod === 'moonpay' && (
                        <p className="text-[10px] text-muted-foreground">Auto-sign with your platform custodial wallet.</p>
                      )}
                      {paymentMethod === 'xaman' && (
                        <p className="text-[10px] text-muted-foreground">Sign with your own XRPL wallet via Xaman app.</p>
                      )}
                    </div>

                    {/* Receive currency toggle — hidden when MoonPay buy (MoonPay handles conversion) */}
                    {!(orderSide === 'buy' && paymentMethod === 'moonpay') && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">{orderSide === 'sell' ? 'Receive in' : 'Pay with'}</label>
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
                      <input
                        type="number"
                        className="input w-full font-mono"
                        placeholder="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        min="0"
                      />
                    </div>

                    {/* Price is locked to NAV */}
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">Price per Token</p>
                      <p className="text-lg font-bold font-mono mt-0.5">${selectedAsset.nav_per_token.toFixed(4)}</p>
                      <p className="text-[11px] text-muted-foreground">Set by asset NAV</p>
                    </div>

                    {totalValue > 0 && (
                      <div className="rounded-lg bg-muted/40 p-3 text-center">
                        <p className="text-xs text-muted-foreground">Total Value</p>
                        <p className="text-lg font-bold mt-0.5">{formatUSD(totalValue)}</p>
                        <p className="text-[11px] text-muted-foreground">{payCurrency}</p>
                      </div>
                    )}

                    {error && (
                      <div className="flex items-center gap-2 text-xs text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {error}
                      </div>
                    )}
                    {success && (
                      <p className="text-xs text-green-500">{success}</p>
                    )}

                    <Button
                      onClick={submitOrder}
                      disabled={submitting || !amount || parseFloat(amount) <= 0}
                      className={`w-full gap-2 ${
                        orderSide === 'buy'
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : orderSide === 'buy' && paymentMethod === 'moonpay' ? (
                        <CreditCard className="h-4 w-4" />
                      ) : (
                        <DollarSign className="h-4 w-4" />
                      )}
                      {submitting
                        ? 'Placing order...'
                        : orderSide === 'buy' && paymentMethod === 'moonpay'
                          ? `Buy ${selectedAsset.token_symbol} with USD`
                          : `${orderSide === 'buy' ? 'Buy' : 'Sell'} ${selectedAsset.token_symbol}`}
                    </Button>

                    {/* MoonPay buy hint */}
                    {orderSide === 'buy' && paymentMethod === 'moonpay' && totalValue > 0 && (
                      <p className="text-[10px] text-center text-muted-foreground">
                        You&apos;ll pay ~{formatUSD(totalValue)} via MoonPay (card/bank)
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
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
                    <Badge variant="outline" className="text-[10px]">{asset.token_symbol}</Badge>
                    <Badge className="text-[10px] bg-muted/60 text-muted-foreground">{asset.asset_type}</Badge>
                    {asset.ai_rating && (
                      <Badge className={`text-[10px] ${
                        asset.ai_rating >= 7 ? 'bg-green-500/10 text-green-500' :
                        asset.ai_rating >= 4 ? 'bg-amber-500/10 text-amber-500' :
                        'bg-red-500/10 text-red-500'
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
                      <p className="text-[10px] text-muted-foreground mt-0.5">Royalty details will appear once a contract is uploaded.</p>
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
