import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, TrendingUp, Coins, Percent } from 'lucide-react'
import type { AssetRow, InvestorHoldingRow } from '@/types/database'

function formatUSD(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

interface AssetStatsProps {
  asset: AssetRow
  holding: InvestorHoldingRow | null
  circulatingSupply?: number
}

export function AssetStats({ asset, holding, circulatingSupply = 0 }: AssetStatsProps) {
  const myNavValue = holding ? holding.token_balance * asset.nav_per_token : null
  const available = asset.token_supply - circulatingSupply
  const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n)

  const stats = [
    {
      label: 'Asset Valuation',
      value: formatUSD(asset.current_valuation),
      sub: 'Total LLC asset value',
      icon: DollarSign,
    },
    {
      label: 'NAV per Token',
      value: `$${asset.nav_per_token.toFixed(4)}`,
      sub: `${asset.token_symbol} token`,
      icon: Coins,
    },
    {
      label: 'Annual Yield',
      value: asset.annual_yield != null ? `${asset.annual_yield.toFixed(1)}%` : '—',
      sub: 'Target distribution yield',
      icon: TrendingUp,
    },
    {
      label: 'Tokens Available',
      value: fmt(available),
      sub: `${fmt(circulatingSupply)} sold of ${fmt(asset.token_supply)}`,
      icon: Percent,
    },
  ]

  // If user has a holding, add their position as a 5th stat
  if (holding) {
    stats.push({
      label: 'My Position',
      value: formatUSD(myNavValue!),
      sub: `${fmt(holding.token_balance)} ${asset.token_symbol}`,
      icon: Coins,
    })
  }

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold tabular-nums">{stat.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{stat.sub}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
