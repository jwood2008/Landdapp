'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart3, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react'

interface Props {
  state: string
  county: string
  currentValuation: number
  totalAcres: number | null
}

interface NassData {
  state: string
  county: string
  year: number
  croplandValuePerAcre: number | null
  pastureValuePerAcre: number | null
  allLandValuePerAcre: number | null
  cashRentCropland: number | null
  cashRentPasture: number | null
}

function formatUSD(v: number) {
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export function UsdaBenchmarkCard({ state, county, currentValuation, totalAcres }: Props) {
  const [data, setData] = useState<NassData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/oracle/usda-data?state=${encodeURIComponent(state)}&county=${encodeURIComponent(county)}`)
        const json = await res.json()
        if (json.data) setData(json.data)
        else setError('No data available')
      } catch {
        setError('Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [state, county])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error || !data) return null

  const statedPerAcre = totalAcres && totalAcres > 0 ? currentValuation / totalAcres : null
  const benchmarkPerAcre = data.allLandValuePerAcre ?? data.croplandValuePerAcre
  const deviation = statedPerAcre && benchmarkPerAcre
    ? ((statedPerAcre - benchmarkPerAcre) / benchmarkPerAcre) * 100
    : null

  const deviationStatus = deviation === null ? null
    : deviation < -5 ? 'below'
    : deviation <= 15 ? 'at_market'
    : deviation <= 30 ? 'above'
    : 'significantly_above'

  const statusConfig = {
    below: { label: 'Below Average', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', icon: TrendingDown },
    at_market: { label: 'At Market', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', icon: Minus },
    above: { label: 'Above Average', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', icon: TrendingUp },
    significantly_above: { label: 'Well Above Average', className: 'bg-red-500/10 text-red-600 dark:text-red-400', icon: TrendingUp },
  }

  const cfg = deviationStatus ? statusConfig[deviationStatus] : null
  const StatusIcon = cfg?.icon ?? Minus

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          USDA Land Value Benchmark
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {benchmarkPerAcre && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">County Average</p>
              <p className="text-lg font-bold tabular-nums">{formatUSD(benchmarkPerAcre)}<span className="text-xs font-normal text-muted-foreground">/acre</span></p>
            </div>
          )}
          {statedPerAcre && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">This Property</p>
              <p className="text-lg font-bold tabular-nums">{formatUSD(statedPerAcre)}<span className="text-xs font-normal text-muted-foreground">/acre</span></p>
            </div>
          )}
        </div>

        {cfg && deviation !== null && (
          <div className="flex items-center gap-2">
            <Badge className={`rounded-full text-xs px-3 py-1 gap-1.5 ${cfg.className}`}>
              <StatusIcon className="h-3 w-3" />
              {cfg.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {deviation > 0 ? '+' : ''}{deviation.toFixed(1)}% vs county avg
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          {data.cashRentCropland && (
            <div>
              <p className="text-xs text-muted-foreground">Cropland Cash Rent</p>
              <p className="text-sm font-medium tabular-nums">{formatUSD(data.cashRentCropland)}/acre/yr</p>
            </div>
          )}
          {data.cashRentPasture && (
            <div>
              <p className="text-xs text-muted-foreground">Pasture Cash Rent</p>
              <p className="text-sm font-medium tabular-nums">{formatUSD(data.cashRentPasture)}/acre/yr</p>
            </div>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground/60">
          Source: USDA NASS Quick Stats ({data.year}) — {data.county} County, {data.state}
        </p>
      </CardContent>
    </Card>
  )
}
