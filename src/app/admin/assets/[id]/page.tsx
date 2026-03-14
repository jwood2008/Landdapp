import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ArrowLeft, Building2, ShieldCheck, DollarSign, Coins, Users, Percent } from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/lib/button-variants'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { NavUpdateForm } from '@/components/dashboard/nav-update-form'
import { OnChainAnalytics } from '@/components/admin/on-chain-analytics'
import { ValuationAuditTrail } from '@/components/assets/valuation-audit-trail'
import { TrustlineManager } from '@/components/admin/trustline-manager'
import { ContractUpload } from '@/components/admin/contract-upload'
import { AssetStatusToggle } from '@/components/admin/asset-status-toggle'
import type { AssetRow } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminAssetDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: asset, error } = await supabase
    .from('assets')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !asset) notFound()

  const typedAsset = asset as AssetRow

  // Fetch valuations + docs for audit trail
  const [{ data: valuations }, { data: valuationDocs }, { data: approvals }, { data: activeContract }] = await Promise.all([
    supabase
      .from('valuations')
      .select('*')
      .eq('asset_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('valuation_documents')
      .select('id, valuation_id, file_name, ai_extracted_value, ai_appraiser_name, ai_appraisal_date, ai_methodology, ai_summary, integrity_score, integrity_flags, signature_detected, status, created_at')
      .eq('asset_id', id)
      .in('status', ['passed', 'flagged'])
      .order('created_at', { ascending: false }),
    supabase
      .from('investor_approvals')
      .select('id, investor_address, status, created_at')
      .eq('asset_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('asset_contracts')
      .select('*')
      .eq('asset_id', id)
      .eq('is_active', true)
      .single(),
  ])

  const approvedCount = (approvals ?? []).filter((a) => (a as { status: string }).status === 'approved').length

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            '-ml-2 gap-1.5 text-muted-foreground'
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to admin
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{typedAsset.asset_name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline">{typedAsset.token_symbol}</Badge>
                <Badge className={typedAsset.is_active ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}>
                  {typedAsset.is_active ? 'Active' : 'Inactive'}
                </Badge>
                {typedAsset.require_auth && (
                  <Badge className="text-xs bg-green-500/10 text-green-500 border-green-500/20 gap-1">
                    <ShieldCheck className="h-2.5 w-2.5" />
                    Permissioned
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <AssetStatusToggle assetId={id} isActive={typedAsset.is_active} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valuation</p>
                <p className="text-2xl font-bold tabular-nums">${Number(typedAsset.current_valuation).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Coins className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">NAV / Token</p>
                <p className="text-2xl font-bold font-mono tabular-nums">${typedAsset.nav_per_token.toFixed(4)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10">
                <Coins className="h-5 w-5 text-teal-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Supply</p>
                <p className="text-2xl font-bold tabular-nums">{Number(typedAsset.token_supply).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
                <Users className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Approved Investors</p>
                <p className="text-2xl font-bold tabular-nums">{approvedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Percent className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Owner Retained</p>
                <p className="text-2xl font-bold tabular-nums">{typedAsset.owner_retained_percent ?? 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Valuation update */}
          <NavUpdateForm asset={typedAsset} />

          {/* Audit trail */}
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
                valuations={(valuations ?? []) as Array<{
                  id: string; event_type: string; previous_value: number;
                  current_value: number; nav_per_token: number; notes: string | null; created_at: string
                }>}
                documents={(valuationDocs ?? []) as Array<{
                  id: string; valuation_id: string | null; file_name: string;
                  ai_extracted_value: number | null; ai_appraiser_name: string | null;
                  ai_appraisal_date: string | null; ai_methodology: string | null;
                  ai_summary: string | null; integrity_score: number | null;
                  integrity_flags: Array<{ type: string; severity: string; message: string }>;
                  signature_detected: boolean; status: string; created_at: string
                }>}
                tokenSymbol={typedAsset.token_symbol}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Contract upload */}
          <ContractUpload
            assetId={id}
            assetName={typedAsset.asset_name}
            activeContract={(activeContract ?? null) as React.ComponentProps<typeof ContractUpload>['activeContract']}
          />

          {/* Trust line manager */}
          <TrustlineManager
            issuerWallet={typedAsset.issuer_wallet}
            tokenSymbol={typedAsset.token_symbol}
          />

          {/* On-chain analytics */}
          <OnChainAnalytics
            issuerWallet={typedAsset.issuer_wallet}
            tokenSymbol={typedAsset.token_symbol}
            totalSupply={typedAsset.token_supply}
          />

          {/* Asset metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Asset Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">LLC / SPV</p>
                <p className="mt-0.5">{typedAsset.llc_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Issuer Wallet</p>
                <p className="font-mono text-xs mt-0.5 break-all">{typedAsset.issuer_wallet}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Oracle Method</p>
                <p className="capitalize mt-0.5">{typedAsset.oracle_method?.replace('_', ' ') ?? 'Manual'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="mt-0.5">
                  {new Date(typedAsset.created_at).toLocaleDateString('en-US', {
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
