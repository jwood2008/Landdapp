'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Globe,
  RefreshCw,
  Users,
  Coins,
  Shield,
  Wallet,
  Loader2,
  AlertCircle,
} from 'lucide-react'

interface Props {
  issuerWallet: string
  tokenSymbol: string
  totalSupply: number
}

interface TokenData {
  currency: string
  totalIssued: number
  holderCount: number
  authorizedCount: number
  trustLineCount: number
  holders: Array<{
    address: string
    balance: number
    authorized: boolean
  }>
}

interface AccountData {
  address: string
  xrpBalance: number
  requireAuth: boolean
  flags: number
  token: TokenData | null
}

export function OnChainAnalytics({ issuerWallet, tokenSymbol, totalSupply }: Props) {
  const [data, setData] = useState<AccountData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/xrpl/account-info?address=${issuerWallet}&currency=${tokenSymbol}`
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to fetch')
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch on-chain data')
    } finally {
      setLoading(false)
    }
  }, [issuerWallet, tokenSymbol])

  const circulatingPct =
    data?.token && totalSupply > 0
      ? ((data.token.totalIssued / totalSupply) * 100).toFixed(1)
      : '0'

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4" />
            On-Chain Analytics
          </CardTitle>
          <CardDescription>Live data from XRPL mainnet</CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
          className="gap-1.5"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {data ? 'Refresh' : 'Fetch'}
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive mb-4">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {!data && !loading && !error && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Click &ldquo;Fetch&rdquo; to load live on-chain data for this asset.
          </p>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Connecting to XRPL...
          </div>
        )}

        {data && (
          <div className="space-y-5">
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">XRP Balance</p>
                </div>
                <p className="text-xl font-bold tabular-nums">
                  {data.xrpBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">RequireAuth</p>
                </div>
                <Badge
                  className={`text-xs ${
                    data.requireAuth
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-amber-500/10 text-amber-500'
                  }`}
                >
                  {data.requireAuth ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>

              {data.token && (
                <>
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Token Holders</p>
                    </div>
                    <p className="text-xl font-bold tabular-nums">
                      {data.token.holderCount}
                      <span className="text-xs text-muted-foreground font-normal ml-1">
                        / {data.token.trustLineCount} trust lines
                      </span>
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Coins className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Circulating</p>
                    </div>
                    <p className="text-xl font-bold tabular-nums">
                      {circulatingPct}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data.token.totalIssued.toLocaleString()} / {totalSupply.toLocaleString()}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Holder table */}
            {data.token && data.token.holders.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Token Holders ({data.token.holders.length})
                </p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40">
                        <th className="text-left px-3 py-2.5 text-muted-foreground font-medium">
                          Address
                        </th>
                        <th className="text-right px-3 py-2.5 text-muted-foreground font-medium">
                          Balance
                        </th>
                        <th className="text-right px-3 py-2.5 text-muted-foreground font-medium">
                          Ownership
                        </th>
                        <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">
                          Auth
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.token.holders
                        .sort((a, b) => b.balance - a.balance)
                        .map((holder) => {
                          const pct =
                            totalSupply > 0
                              ? ((holder.balance / totalSupply) * 100).toFixed(2)
                              : '0'
                          return (
                            <tr key={holder.address} className="hover:bg-muted/20">
                              <td className="px-3 py-2.5 font-mono">
                                {holder.address.slice(0, 8)}...{holder.address.slice(-6)}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                                {holder.balance.toLocaleString()}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                {pct}%
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {holder.authorized ? (
                                  <Badge className="text-[10px] bg-green-500/10 text-green-500">
                                    Yes
                                  </Badge>
                                ) : (
                                  <Badge className="text-[10px] bg-muted text-muted-foreground">
                                    No
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
