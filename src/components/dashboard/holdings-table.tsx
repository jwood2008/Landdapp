'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { ArrowRight, DollarSign, TrendingUp, Percent, Coins } from 'lucide-react'

interface Holding {
  asset_id: string
  token_balance: number
  ownership_percent: number
  assets: {
    asset_name: string
    asset_type: string
    llc_name: string
    token_symbol: string
    nav_per_token: number
    current_valuation: number
    annual_yield: number | null
    is_active: boolean
  } | null
}

interface HoldingsTableProps {
  holdings: Holding[]
  assetBasePath?: string
}

function formatUSD(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  land: 'Land',
  real_estate: 'Real Estate',
  aircraft: 'Aircraft',
  vessel: 'Vessel',
  energy: 'Energy',
  private_credit: 'Private Credit',
  infrastructure: 'Infrastructure',
}

export function HoldingsTable({ holdings, assetBasePath = '/dashboard/assets' }: HoldingsTableProps) {
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null)

  if (holdings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
          <CardDescription>No holdings detected for your wallet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Once your wallet holds tokens from a registered asset, they will appear here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Holdings</CardTitle>
        <CardDescription>Your tokenized asset positions</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Tokens</TableHead>
              <TableHead className="text-right">Ownership</TableHead>
              <TableHead className="text-right">NAV Value</TableHead>
              <TableHead className="text-right">Yield</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.map((holding) => {
              const asset = holding.assets
              if (!asset) return null
              const navValue = holding.token_balance * asset.nav_per_token

              return (
                <TableRow key={holding.asset_id} onClick={() => setSelectedHolding(holding)} className="cursor-pointer">
                  <TableCell className="py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{asset.asset_name}</p>
                        {!asset.is_active && (
                          <Badge variant="outline" className="text-xs rounded-full border-warning/30 text-warning">
                            Delisted
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{asset.llc_name}</p>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge variant="secondary" className="text-xs rounded-full">
                      {ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums py-4">
                    <div>
                      <p>{new Intl.NumberFormat('en-US').format(holding.token_balance)}</p>
                      <p className="text-xs text-muted-foreground">{asset.token_symbol}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums py-4">
                    {holding.ownership_percent.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium py-4">
                    {formatUSD(navValue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums py-4">
                    {asset.annual_yield != null ? (
                      <span className="text-success">
                        {asset.annual_yield.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-4">
                    <Link
                      href={`${assetBasePath}/${holding.asset_id}`}
                      className="flex items-center justify-end text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        </div>
      </CardContent>

      {/* Holding detail side sheet */}
      <Sheet open={!!selectedHolding} onOpenChange={(open) => { if (!open) setSelectedHolding(null) }}>
        <SheetContent side="right" className="overflow-y-auto">
          {(() => {
            if (!selectedHolding?.assets) return null
            const asset = selectedHolding.assets
            const navValue = selectedHolding.token_balance * asset.nav_per_token

            return (
              <>
                <SheetHeader>
                  <SheetTitle>{asset.asset_name}</SheetTitle>
                  <SheetDescription className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{asset.token_symbol}</Badge>
                    <Badge className="text-xs bg-muted/60 text-muted-foreground rounded-full">
                      {ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type}
                    </Badge>
                  </SheetDescription>
                </SheetHeader>

                <div className="space-y-6 mt-6">
                  {/* Large NAV value display */}
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
                      <DollarSign className="h-4 w-4" />
                      <p className="text-sm font-medium">Your Position Value</p>
                    </div>
                    <p className="text-3xl font-bold tabular-nums">{formatUSD(navValue)}</p>
                  </div>

                  {/* Details card */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border p-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                        <Coins className="h-3.5 w-3.5" />
                        <p className="text-[11px] font-medium">Token Balance</p>
                      </div>
                      <p className="text-lg font-bold tabular-nums">
                        {new Intl.NumberFormat('en-US').format(selectedHolding.token_balance)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{asset.token_symbol}</p>
                    </div>
                    <div className="rounded-lg border border-border p-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                        <Percent className="h-3.5 w-3.5" />
                        <p className="text-[11px] font-medium">Ownership</p>
                      </div>
                      <p className="text-lg font-bold tabular-nums">
                        {selectedHolding.ownership_percent.toFixed(2)}%
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                        <DollarSign className="h-3.5 w-3.5" />
                        <p className="text-[11px] font-medium">NAV / Token</p>
                      </div>
                      <p className="text-lg font-bold font-mono tabular-nums">
                        ${asset.nav_per_token.toFixed(4)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <p className="text-[11px] font-medium">Annual Yield</p>
                      </div>
                      <p className="text-lg font-bold tabular-nums">
                        {asset.annual_yield != null ? (
                          <span className="text-success">{asset.annual_yield.toFixed(1)}%</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Asset valuation */}
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-[11px] text-muted-foreground font-medium">Total Asset Valuation</p>
                    <p className="text-lg font-bold tabular-nums mt-1">{formatUSD(asset.current_valuation)}</p>
                  </div>

                  {/* View full details link */}
                  <Link href={`${assetBasePath}/${selectedHolding.asset_id}`}>
                    <Button variant="outline" className="w-full gap-2">
                      View Full Details
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>
    </Card>
  )
}
