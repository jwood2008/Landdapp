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
import { buttonVariants } from '@/lib/button-variants'
import { cn } from '@/lib/utils'
import { Landmark, Plus, Settings, DollarSign, Coins, TrendingUp, ExternalLink } from 'lucide-react'
import type { AssetRow } from '@/types/database'

interface AssetsManagementTableProps {
  assets: AssetRow[]
}

function formatUSD(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function AssetsManagementTable({ assets }: AssetsManagementTableProps) {
  const [selectedAsset, setSelectedAsset] = useState<AssetRow | null>(null)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Assets</CardTitle>
          <CardDescription>Manage tokenized assets and oracle data</CardDescription>
        </div>
        <Link href="/admin/assets/new" className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}>
          <Plus className="h-4 w-4" />
          New Asset
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {assets.length === 0 ? (
          <div className="py-12 text-center">
            <Landmark className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No assets yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create your first tokenized asset to get started.</p>
          </div>
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Token</TableHead>
              <TableHead className="text-right">Valuation</TableHead>
              <TableHead className="text-right">NAV / Token</TableHead>
              <TableHead className="text-right">Yield</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map((asset) => (
              <TableRow key={asset.id} onClick={() => setSelectedAsset(asset)} className="cursor-pointer">
                <TableCell>
                  <div>
                    <p className="font-medium">{asset.asset_name}</p>
                    <p className="text-xs text-muted-foreground">{asset.llc_name}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm">{asset.token_symbol}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatUSD(asset.current_valuation)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  ${asset.nav_per_token.toFixed(4)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {asset.annual_yield != null ? `${asset.annual_yield.toFixed(1)}%` : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={asset.is_active ? 'default' : 'secondary'}>
                    {asset.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link href={`/admin/assets/${asset.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                    <Settings className="h-4 w-4" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )}
      </CardContent>

      {/* Asset detail side sheet */}
      <Sheet open={!!selectedAsset} onOpenChange={(open) => { if (!open) setSelectedAsset(null) }}>
        <SheetContent side="right" className="overflow-y-auto">
          {selectedAsset && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedAsset.asset_name}</SheetTitle>
                <SheetDescription className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs font-mono">{selectedAsset.token_symbol}</Badge>
                  <Badge className="text-xs bg-muted/60 text-muted-foreground rounded-full">
                    {selectedAsset.asset_type}
                  </Badge>
                  <Badge variant={selectedAsset.is_active ? 'default' : 'secondary'} className="text-xs rounded-full">
                    {selectedAsset.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {selectedAsset.llc_name && (
                  <p className="text-sm text-muted-foreground">{selectedAsset.llc_name}</p>
                )}

                {/* Key financials */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                      <DollarSign className="h-3.5 w-3.5" />
                      <p className="text-[11px] font-medium">Valuation</p>
                    </div>
                    <p className="text-lg font-bold tabular-nums">{formatUSD(selectedAsset.current_valuation)}</p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                      <DollarSign className="h-3.5 w-3.5" />
                      <p className="text-[11px] font-medium">NAV / Token</p>
                    </div>
                    <p className="text-lg font-bold font-mono tabular-nums">${selectedAsset.nav_per_token.toFixed(4)}</p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                      <Coins className="h-3.5 w-3.5" />
                      <p className="text-[11px] font-medium">Token Supply</p>
                    </div>
                    <p className="text-lg font-bold tabular-nums">{Number(selectedAsset.token_supply).toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <p className="text-[11px] font-medium">Annual Yield</p>
                    </div>
                    <p className="text-lg font-bold tabular-nums">
                      {selectedAsset.annual_yield != null ? (
                        <span className="text-success">{selectedAsset.annual_yield.toFixed(1)}%</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Status info */}
                <div className="rounded-lg border border-border p-4">
                  <p className="text-[11px] text-muted-foreground font-medium mb-2">Status</p>
                  <div className="flex items-center gap-3">
                    <div className={`h-2.5 w-2.5 rounded-full ${selectedAsset.is_active ? 'bg-success' : 'bg-muted-foreground/40'}`} />
                    <p className="text-sm font-medium">
                      {selectedAsset.is_active ? 'Active — visible on marketplace' : 'Inactive — hidden from marketplace'}
                    </p>
                  </div>
                </div>

                {/* Manage link */}
                <Link href={`/admin/assets/${selectedAsset.id}`}>
                  <Button variant="outline" className="w-full gap-2">
                    <Settings className="h-4 w-4" />
                    Manage Asset
                    <ExternalLink className="h-3.5 w-3.5 ml-auto" />
                  </Button>
                </Link>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </Card>
  )
}
