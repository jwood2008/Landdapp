'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  History,
  ShoppingCart,
  Tag,
  Filter,
  ExternalLink,
} from 'lucide-react'

// ── Types ──

interface AssetInfo {
  asset_name: string
  token_symbol: string
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// Supabase joins return arrays for related tables — we accept `any` here and
// safely extract the first element below.
interface OrderRow {
  id: string
  side: 'buy' | 'sell'
  token_amount: number
  price_per_token: number
  currency: string
  filled_amount: number
  status: string
  xrpl_offer_tx: string | null
  created_at: string
  updated_at: string
  assets: any
}

interface TradeRow {
  id: string
  token_amount: number
  price_per_token: number
  total_price: number
  currency: string
  status: string
  xrpl_tx_hash: string | null
  settled_at: string | null
  created_at: string
  assets: any
}

interface DistPaymentRow {
  id: string
  amount: number
  currency: string
  ownership_percent: number
  status: string
  tx_hash: string | null
  created_at: string
  distributions: any
}
/* eslint-enable @typescript-eslint/no-explicit-any */

type TxType = 'buy' | 'sell' | 'trade_buy' | 'trade_sell' | 'distribution'

interface UnifiedTx {
  id: string
  type: TxType
  asset: string
  symbol: string
  amount: number
  tokenAmount: number
  currency: string
  status: string
  txHash: string | null
  date: string
}

// ── Helpers ──

const TYPE_LABELS: Record<TxType, string> = {
  buy: 'Buy Order',
  sell: 'Sell Order',
  trade_buy: 'Purchase',
  trade_sell: 'Sale',
  distribution: 'Distribution',
}

const TYPE_FILTER_LABELS: Record<string, string> = {
  all: 'All',
  orders: 'Orders',
  trades: 'Trades',
  distributions: 'Distributions',
}

function statusColor(status: string) {
  switch (status) {
    case 'settled':
    case 'completed':
    case 'filled':
      return 'bg-status-success text-success'
    case 'pending':
    case 'open':
    case 'partial':
      return 'bg-status-warning text-warning'
    case 'cancelled':
    case 'expired':
    case 'failed':
      return 'bg-status-danger text-destructive'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function typeIcon(type: TxType) {
  switch (type) {
    case 'buy':
      return <ShoppingCart className="h-4 w-4" />
    case 'sell':
      return <Tag className="h-4 w-4" />
    case 'trade_buy':
      return <ArrowDownLeft className="h-4 w-4" />
    case 'trade_sell':
      return <ArrowUpRight className="h-4 w-4" />
    case 'distribution':
      return <Coins className="h-4 w-4" />
  }
}

function typeColor(type: TxType) {
  switch (type) {
    case 'buy':
    case 'trade_buy':
      return 'bg-status-info text-info'
    case 'sell':
    case 'trade_sell':
      return 'bg-status-warning text-warning'
    case 'distribution':
      return 'bg-status-success text-success'
  }
}

function formatCurrency(value: number, currency: string) {
  if (currency === 'RLUSD' || currency === 'USD') {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${currency}`
}

function shortenHash(hash: string) {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

// ── Component ──

interface Props {
  orders: OrderRow[]
  buyTrades: TradeRow[]
  sellTrades: TradeRow[]
  distributionPayments: DistPaymentRow[]
  walletAddress: string
}

export function TransactionHistory({
  orders,
  buyTrades,
  sellTrades,
  distributionPayments,
  walletAddress,
}: Props) {
  const [filter, setFilter] = useState<'all' | 'orders' | 'trades' | 'distributions'>('all')
  const [selectedTx, setSelectedTx] = useState<UnifiedTx | null>(null)

  // Safely unwrap Supabase join — may be object, array, or null
  function unwrap<T>(val: unknown): T | null {
    if (!val) return null
    if (Array.isArray(val)) return (val[0] as T) ?? null
    return val as T
  }

  // Unify all transactions into a single sorted list
  const transactions = useMemo(() => {
    const unified: UnifiedTx[] = []

    // Orders
    for (const o of orders) {
      const a = unwrap<AssetInfo>(o.assets)
      unified.push({
        id: `order-${o.id}`,
        type: o.side,
        asset: a?.asset_name ?? 'Unknown',
        symbol: a?.token_symbol ?? '?',
        amount: o.token_amount * o.price_per_token,
        tokenAmount: o.token_amount,
        currency: o.currency,
        status: o.status,
        txHash: o.xrpl_offer_tx,
        date: o.created_at,
      })
    }

    // Buy trades
    for (const t of buyTrades) {
      const a = unwrap<AssetInfo>(t.assets)
      unified.push({
        id: `trade-buy-${t.id}`,
        type: 'trade_buy',
        asset: a?.asset_name ?? 'Unknown',
        symbol: a?.token_symbol ?? '?',
        amount: t.total_price,
        tokenAmount: t.token_amount,
        currency: t.currency,
        status: t.status,
        txHash: t.xrpl_tx_hash,
        date: t.settled_at ?? t.created_at,
      })
    }

    // Sell trades
    for (const t of sellTrades) {
      const a = unwrap<AssetInfo>(t.assets)
      unified.push({
        id: `trade-sell-${t.id}`,
        type: 'trade_sell',
        asset: a?.asset_name ?? 'Unknown',
        symbol: a?.token_symbol ?? '?',
        amount: t.total_price,
        tokenAmount: t.token_amount,
        currency: t.currency,
        status: t.status,
        txHash: t.xrpl_tx_hash,
        date: t.settled_at ?? t.created_at,
      })
    }

    // Distribution payments
    for (const p of distributionPayments) {
      const dist = unwrap<{ event_type: string; royalty_period: string | null; is_royalty: boolean; assets: unknown }>(p.distributions)
      const a = unwrap<AssetInfo>(dist?.assets)
      unified.push({
        id: `dist-${p.id}`,
        type: 'distribution',
        asset: a?.asset_name ?? 'Unknown',
        symbol: a?.token_symbol ?? '?',
        amount: p.amount,
        tokenAmount: 0,
        currency: p.currency,
        status: p.status,
        txHash: p.tx_hash,
        date: p.created_at,
      })
    }

    // Sort newest first
    unified.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return unified
  }, [orders, buyTrades, sellTrades, distributionPayments])

  // Filter
  const filtered = useMemo(() => {
    if (filter === 'all') return transactions
    if (filter === 'orders') return transactions.filter((t) => t.type === 'buy' || t.type === 'sell')
    if (filter === 'trades')
      return transactions.filter((t) => t.type === 'trade_buy' || t.type === 'trade_sell')
    return transactions.filter((t) => t.type === 'distribution')
  }, [transactions, filter])

  // Stats
  const totalBought = transactions
    .filter((t) => (t.type === 'buy' || t.type === 'trade_buy') && (t.status === 'filled' || t.status === 'settled'))
    .reduce((sum, t) => sum + t.amount, 0)

  const totalSold = transactions
    .filter((t) => (t.type === 'sell' || t.type === 'trade_sell') && (t.status === 'filled' || t.status === 'settled'))
    .reduce((sum, t) => sum + t.amount, 0)

  const totalDistributions = transactions
    .filter((t) => t.type === 'distribution' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground">
          Activity for{' '}
          <span className="font-mono text-xs">
            {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
          </span>
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-info">
                <ArrowDownLeft className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Bought</p>
                <p className="text-2xl font-bold tabular-nums">
                  {formatCurrency(totalBought, 'USD')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-warning">
                <ArrowUpRight className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Sold</p>
                <p className="text-2xl font-bold tabular-nums">
                  {formatCurrency(totalSold, 'USD')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-success">
                <Coins className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Distributions Received</p>
                <p className="text-2xl font-bold tabular-nums">
                  {formatCurrency(totalDistributions, 'USD')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" />
                Transaction History
              </CardTitle>
              <CardDescription>{transactions.length} total transactions</CardDescription>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
              {(Object.keys(TYPE_FILTER_LABELS) as Array<'all' | 'orders' | 'trades' | 'distributions'>).map(
                (key) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      filter === key
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {TYPE_FILTER_LABELS[key]}
                  </button>
                )
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Filter className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No transactions found.</p>
              <p className="text-xs text-muted-foreground mt-1">
                {filter !== 'all'
                  ? 'Try changing the filter above.'
                  : 'Your transaction history will appear here once you make trades or receive distributions.'}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              {/* Desktop table */}
              <table className="w-full text-sm max-sm:hidden">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                      Type
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                      Asset
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">
                      Tokens
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">
                      Amount
                    </th>
                    <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">
                      Date
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">
                      Tx
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/10 transition-colors cursor-pointer" onClick={() => setSelectedTx(tx)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-lg ${typeColor(tx.type)}`}
                          >
                            {typeIcon(tx.type)}
                          </div>
                          <span className="text-xs font-medium">{TYPE_LABELS[tx.type]}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-xs">{tx.asset}</p>
                        <p className="text-xs text-muted-foreground">{tx.symbol}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                        {tx.tokenAmount > 0
                          ? tx.tokenAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-medium tabular-nums">
                        {tx.type === 'trade_sell' || tx.type === 'sell' ? '+' : ''}
                        {tx.type === 'distribution' ? '+' : ''}
                        {formatCurrency(tx.amount, tx.currency)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={`text-xs ${statusColor(tx.status)}`}>
                          {tx.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {new Date(tx.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {tx.txHash ? (
                          <a
                            href={`https://testnet.xrpl.org/transactions/${tx.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-mono text-primary hover:underline"
                          >
                            {shortenHash(tx.txHash)}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile list */}
              <div className="divide-y divide-border sm:hidden">
                {filtered.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/10 transition-colors" onClick={() => setSelectedTx(tx)}>
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${typeColor(tx.type)}`}
                    >
                      {typeIcon(tx.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">
                          {TYPE_LABELS[tx.type]}
                        </p>
                        <p className="text-sm font-mono font-medium tabular-nums shrink-0">
                          {tx.type === 'trade_sell' || tx.type === 'sell' || tx.type === 'distribution'
                            ? '+'
                            : ''}
                          {formatCurrency(tx.amount, tx.currency)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate">
                          {tx.symbol} · {tx.tokenAmount > 0 ? `${tx.tokenAmount} tokens` : '—'}
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={`text-xs ${statusColor(tx.status)}`}>
                            {tx.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(tx.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Transaction detail sheet */}
      <Sheet open={!!selectedTx} onOpenChange={(open) => { if (!open) setSelectedTx(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              {selectedTx && (
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${typeColor(selectedTx.type)}`}>
                  {typeIcon(selectedTx.type)}
                </div>
              )}
              {selectedTx && TYPE_LABELS[selectedTx.type]}
            </SheetTitle>
            <SheetDescription>
              {selectedTx?.asset} &middot; {selectedTx?.symbol}
            </SheetDescription>
          </SheetHeader>

          {selectedTx && (
            <div className="mt-8 space-y-6">
              {/* Amount */}
              <div className="text-center">
                <p className="text-3xl font-bold tabular-nums">
                  {selectedTx.type === 'trade_sell' || selectedTx.type === 'sell' || selectedTx.type === 'distribution' ? '+' : '-'}
                  {formatCurrency(selectedTx.amount, selectedTx.currency)}
                </p>
                {selectedTx.tokenAmount > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedTx.tokenAmount.toLocaleString()} tokens
                  </p>
                )}
              </div>

              {/* Details grid */}
              <div className="space-y-4 rounded-xl border border-border p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge className={`text-xs rounded-full ${statusColor(selectedTx.status)}`}>
                    {selectedTx.status}
                  </Badge>
                </div>
                <div className="border-t border-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Type</span>
                  <span className="text-sm font-medium">{TYPE_LABELS[selectedTx.type]}</span>
                </div>
                <div className="border-t border-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Asset</span>
                  <span className="text-sm font-medium">{selectedTx.asset}</span>
                </div>
                <div className="border-t border-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Date</span>
                  <span className="text-sm font-medium">
                    {new Date(selectedTx.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                {selectedTx.txHash && (
                  <>
                    <div className="border-t border-border" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">TX Hash</span>
                      <a
                        href={`https://testnet.xrpl.org/transactions/${selectedTx.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm font-mono text-primary hover:underline"
                      >
                        {shortenHash(selectedTx.txHash)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
