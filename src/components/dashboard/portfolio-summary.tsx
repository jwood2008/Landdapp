import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, Wallet, BarChart3, Coins } from 'lucide-react'

interface Holding {
  token_balance: number
  ownership_percent: number
  assets: {
    nav_per_token: number
    annual_yield: number | null
  } | null
}

interface PortfolioSummaryProps {
  holdings: Holding[]
}

function formatUSD(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export function PortfolioSummary({ holdings }: PortfolioSummaryProps) {
  const totalValue = holdings.reduce((sum, h) => {
    return sum + (h.token_balance * (h.assets?.nav_per_token ?? 0))
  }, 0)

  const totalAssets = holdings.length

  const avgYield =
    holdings.length > 0
      ? holdings.reduce((sum, h) => sum + (h.assets?.annual_yield ?? 0), 0) /
        holdings.length
      : 0

  const totalTokens = holdings.reduce((sum, h) => sum + h.token_balance, 0)

  const stats = [
    {
      label: 'Portfolio Value',
      value: formatUSD(totalValue),
      icon: Wallet,
      sub: 'NAV-weighted',
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Assets Held',
      value: totalAssets.toString(),
      icon: BarChart3,
      sub: 'tokenized positions',
      color: 'text-teal-500',
      bg: 'bg-teal-500/10',
    },
    {
      label: 'Avg. Annual Yield',
      value: `${avgYield.toFixed(1)}%`,
      icon: TrendingUp,
      sub: 'across holdings',
      color: 'text-success',
      bg: 'bg-status-success',
    },
    {
      label: 'Total Tokens',
      value: new Intl.NumberFormat('en-US').format(totalTokens),
      icon: Coins,
      sub: 'token units held',
      color: 'text-warning',
      bg: 'bg-status-warning',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.bg}`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold tabular-nums tracking-tight mt-0.5">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{stat.sub}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
