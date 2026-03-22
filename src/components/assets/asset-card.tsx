import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, TrendingUp, ArrowRight, Zap, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AssetRow } from '@/types/database'

const ASSET_TYPE_LABELS: Record<string, string> = {
  land: 'Land',
  real_estate: 'Real Estate',
  aircraft: 'Aircraft',
  vessel: 'Vessel',
  energy: 'Energy',
  private_credit: 'Private Credit',
  infrastructure: 'Infrastructure',
}

const ORACLE_BADGE: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  lease_income: {
    label: 'Auto-yield',
    icon: Zap,
    className: 'text-info',
  },
  external_feed: {
    label: 'Live feed',
    icon: Radio,
    className: 'text-primary',
  },
}

interface AssetCardProps {
  asset: AssetRow
  holding: { token_balance: number; ownership_percent: number } | null
}

function formatUSD(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function AssetCard({ asset, holding }: AssetCardProps) {
  const oracle = ORACLE_BADGE[asset.oracle_method]

  return (
    <Link href={`/dashboard/assets/${asset.id}`} className="block group">
      <Card className="card-hover h-full transition-shadow group-hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <h3 className="text-base font-semibold leading-tight">{asset.asset_name}</h3>
              <p className="text-xs text-muted-foreground">{asset.llc_name}</p>
            </div>
            <Badge variant="secondary" className="shrink-0 text-xs rounded-full">
              {ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-0 space-y-4">
          {asset.location && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {asset.location}
              {asset.total_acres && ` · ${asset.total_acres.toLocaleString()} acres`}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Valuation</p>
              <p className="font-semibold tabular-nums">{formatUSD(asset.current_valuation)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">NAV / Token</p>
              <p className="font-semibold tabular-nums">${asset.nav_per_token.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {asset.annual_yield != null && (
                <div className="flex items-center gap-1 text-xs text-success">
                  <TrendingUp className="h-3 w-3" />
                  <span className="tabular-nums">{asset.annual_yield.toFixed(1)}%</span> yield
                </div>
              )}
              {oracle && (
                <div className={cn('flex items-center gap-0.5 text-xs', oracle.className)}>
                  <oracle.icon className="h-2.5 w-2.5" />
                  {oracle.label}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {holding && holding.token_balance > 0 ? (
                <Badge className="text-xs">
                  <span className="tabular-nums">{holding.ownership_percent.toFixed(2)}%</span> owned
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground font-mono">{asset.token_symbol}</span>
              )}
              <ArrowRight className={cn(
                'h-4 w-4 transition-transform text-muted-foreground',
                'group-hover:translate-x-0.5'
              )} />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
