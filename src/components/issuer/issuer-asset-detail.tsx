'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  DollarSign,
  Coins,
  TrendingUp,
  Users,
  ShieldCheck,
  FileText,
  History,
  ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import { ValuationAuditTrail } from '@/components/assets/valuation-audit-trail'

interface Props {
  asset: Record<string, unknown>
  valuations: Array<Record<string, unknown>>
  valuationDocs: Array<Record<string, unknown>>
  distributions: Array<Record<string, unknown>>
  approvals: Array<Record<string, unknown>>
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-500',
  approved: 'bg-green-500/10 text-green-500',
  rejected: 'bg-red-500/10 text-red-500',
  frozen: 'bg-blue-500/10 text-blue-500',
}

export function IssuerAssetDetail({ asset, valuations, valuationDocs, distributions, approvals }: Props) {
  const valuation = Number(asset.current_valuation)
  const navPerToken = Number(asset.nav_per_token)
  const supply = Number(asset.token_supply)
  const yield_ = asset.annual_yield != null ? Number(asset.annual_yield) : null

  const approvedCount = approvals.filter((a) => a.status === 'approved').length
  const pendingCount = approvals.filter((a) => a.status === 'pending').length

  return (
    <div className="space-y-6">
      {/* Back link + header */}
      <div>
        <Link
          href="/issuer"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to My Assets
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{asset.asset_name as string}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline">{asset.token_symbol as string}</Badge>
              {Boolean(asset.require_auth) && (
                <Badge className="text-xs bg-green-500/10 text-green-500 border-green-500/20 gap-1">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  Permissioned
                </Badge>
              )}
              <Badge className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/20">
                View Only
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Current Valuation</p>
                <p className="text-xl font-bold">${valuation.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Coins className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">NAV per Token</p>
                <p className="text-xl font-bold font-mono">${navPerToken.toFixed(4)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Coins className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Total Supply</p>
                <p className="text-xl font-bold">{supply.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Annual Yield</p>
                <p className="text-xl font-bold">
                  {yield_ != null ? `${yield_.toFixed(2)}%` : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Valuation Audit Trail */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Valuation Audit Trail
              </CardTitle>
              <CardDescription>
                All valuation changes with AI-verified appraisal documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ValuationAuditTrail
                valuations={valuations as Array<{
                  id: string; event_type: string; previous_value: number;
                  current_value: number; nav_per_token: number; notes: string | null; created_at: string
                }>}
                documents={valuationDocs as Array<{
                  id: string; valuation_id: string | null; file_name: string;
                  ai_extracted_value: number | null; ai_appraiser_name: string | null;
                  ai_appraisal_date: string | null; ai_methodology: string | null;
                  ai_summary: string | null; integrity_score: number | null;
                  integrity_flags: Array<{ type: string; severity: string; message: string }>;
                  signature_detected: boolean; status: string; created_at: string
                }>}
                tokenSymbol={asset.token_symbol as string}
              />
            </CardContent>
          </Card>

          {/* Distribution History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4" />
                Distribution History
              </CardTitle>
              <CardDescription>All distributions made to token holders</CardDescription>
            </CardHeader>
            <CardContent>
              {distributions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No distributions recorded yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {distributions.map((dist) => (
                    <div
                      key={dist.id as string}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
                          <DollarSign className="h-4 w-4 text-green-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {dist.event_type as string}
                            </Badge>
                            <Badge className={`text-xs ${
                              dist.status === 'completed'
                                ? 'bg-green-500/10 text-green-500'
                                : 'bg-amber-500/10 text-amber-500'
                            }`}>
                              {dist.status as string}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(dist.created_at as string).toLocaleDateString('en-US', {
                              year: 'numeric', month: 'short', day: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                      <p className="font-mono font-bold text-sm">
                        ${Number(dist.total_amount).toLocaleString()} {dist.currency as string}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Investor Approvals Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Token Holders
              </CardTitle>
              <CardDescription>Investor approval status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-2xl font-bold text-green-500">{approvedCount}</p>
                  <p className="text-xs text-muted-foreground">Approved</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-2xl font-bold text-amber-500">{pendingCount}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>

              {approvals.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No investor requests yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {approvals.slice(0, 10).map((a) => (
                    <div
                      key={a.id as string}
                      className="flex items-center justify-between text-sm py-1.5"
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {(a.investor_address as string).slice(0, 8)}...{(a.investor_address as string).slice(-6)}
                      </span>
                      <Badge className={`text-xs ${STATUS_STYLES[a.status as string] ?? ''}`}>
                        {a.status as string}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Asset Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Asset Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Issuer Wallet</p>
                <p className="font-mono text-xs mt-0.5 break-all">
                  {asset.issuer_wallet as string}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Oracle Method</p>
                <p className="capitalize mt-0.5">
                  {(asset.oracle_method as string)?.replace('_', ' ') ?? 'Manual'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="mt-0.5">
                  {new Date(asset.created_at as string).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
