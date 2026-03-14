import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/lib/button-variants'
import { ArrowLeft, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AssetRow, InvestorHoldingRow } from '@/types/database'

const ASSET_TYPE_LABELS: Record<string, string> = {
  land: 'Land',
  real_estate: 'Real Estate',
  aircraft: 'Aircraft',
  vessel: 'Vessel',
  energy: 'Energy',
  private_credit: 'Private Credit',
  infrastructure: 'Infrastructure',
}

interface AssetHeaderProps {
  asset: AssetRow
  holding: InvestorHoldingRow | null
}

export function AssetHeader({ asset, holding }: AssetHeaderProps) {
  return (
    <div className="space-y-4">
      <Link
        href="/dashboard"
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-ml-2 gap-1.5 text-muted-foreground')}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Marketplace
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{asset.asset_name}</h1>
            <Badge variant="secondary">{ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type}</Badge>
          </div>
          <p className="text-muted-foreground">{asset.llc_name}</p>
          {asset.location && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {asset.location}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {holding ? (
            <Badge className="gap-1.5 text-sm px-3 py-1">
              You own {holding.ownership_percent.toFixed(2)}%
            </Badge>
          ) : (
            <Badge variant="outline" className="text-sm px-3 py-1">
              Not in portfolio
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
