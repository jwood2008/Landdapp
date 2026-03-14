'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Coins,
  History,
  ChevronRight,
  Eye,
} from 'lucide-react'

interface Asset {
  id: string
  asset_name: string
  token_symbol: string
  current_valuation: number
  nav_per_token: number
  token_supply: number
  annual_yield: number | null
  issuer_wallet: string
  oracle_method: string
  require_auth: boolean
  created_at: string
}

interface Valuation {
  id: string
  event_type: string
  previous_value: number
  current_value: number
  nav_per_token: number
  created_at: string
  assets: { asset_name: string; token_symbol: string } | null
}

interface Distribution {
  id: string
  event_type: string
  total_amount: number
  currency: string
  status: string
  created_at: string
  assets: { asset_name: string; token_symbol: string } | null
}

interface Props {
  assets: Asset[]
  recentValuations: Valuation[]
  recentDistributions: Distribution[]
}

export function IssuerOverview({ assets, recentValuations, recentDistributions }: Props) {
  const totalValuation = assets.reduce((sum, a) => sum + Number(a.current_valuation), 0)
  const totalSupply = assets.reduce((sum, a) => sum + Number(a.token_supply), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Assets</h1>
        <p className="text-muted-foreground">
          View your tokenized assets, valuations, and investor activity
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Assets</p>
                <p className="text-2xl font-bold">{assets.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Valuation</p>
                <p className="text-2xl font-bold">${totalValuation.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                <Coins className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Tokens</p>
                <p className="text-2xl font-bold">{totalSupply.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Asset Cards */}
      {assets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No assets assigned to your account yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Contact your platform administrator to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Your Assets</h2>
          {assets.map((asset) => (
            <Link key={asset.id} href={`/issuer/asset/${asset.id}`}>
              <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                <CardContent className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{asset.asset_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs">
                          {asset.token_symbol}
                        </Badge>
                        {asset.require_auth && (
                          <Badge className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
                            Permissioned
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm font-bold">${Number(asset.current_valuation).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">
                        NAV: ${Number(asset.nav_per_token).toFixed(4)}
                      </p>
                    </div>
                    {asset.annual_yield != null && (
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-500">
                          {Number(asset.annual_yield).toFixed(2)}%
                        </p>
                        <p className="text-xs text-muted-foreground">Yield</p>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Eye className="h-4 w-4" />
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Valuations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Recent Valuations
            </CardTitle>
            <CardDescription>Latest valuation updates on your assets</CardDescription>
          </CardHeader>
          <CardContent>
            {recentValuations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No valuations yet</p>
            ) : (
              <div className="space-y-3">
                {recentValuations.map((val) => {
                  const change = val.previous_value > 0
                    ? ((val.current_value - val.previous_value) / val.previous_value) * 100
                    : 0
                  const isUp = change >= 0
                  return (
                    <div key={val.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium">{val.assets?.asset_name ?? 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(val.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-medium">${val.current_value.toLocaleString()}</p>
                        <p className={`text-xs font-medium ${isUp ? 'text-green-500' : 'text-red-500'}`}>
                          {isUp ? '+' : ''}{change.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Distributions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" />
              Recent Distributions
            </CardTitle>
            <CardDescription>Latest distributions to investors</CardDescription>
          </CardHeader>
          <CardContent>
            {recentDistributions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No distributions yet</p>
            ) : (
              <div className="space-y-3">
                {recentDistributions.map((dist) => (
                  <div key={dist.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{dist.assets?.asset_name ?? 'Unknown'}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-xs">{dist.event_type}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(dist.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-medium">
                        ${Number(dist.total_amount).toLocaleString()}
                      </p>
                      <Badge className={`text-xs ${
                        dist.status === 'completed'
                          ? 'bg-green-500/10 text-green-500'
                          : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {dist.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
