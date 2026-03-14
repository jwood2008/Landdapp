import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { AssetHeader } from '@/components/assets/asset-header'
import { AssetStats } from '@/components/assets/asset-stats'
import { ValuationChart } from '@/components/assets/valuation-chart'
import { DistributionHistory } from '@/components/assets/distribution-history'
import { AssetDetails } from '@/components/assets/asset-details'
import { ValuationAuditTrail } from '@/components/assets/valuation-audit-trail'
import { QuarterlyUpdates } from '@/components/assets/quarterly-updates'
import { AssetDocumentsList } from '@/components/assets/asset-documents-list'
import type { IssuerUpdateRow, AssetDocumentRow } from '@/types/database'

interface AssetPageProps {
  params: Promise<{ id: string }>
}

export default async function AssetPage({ params }: AssetPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch asset
  const { data: asset, error } = await supabase
    .from('assets')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (error || !asset) notFound()

  // Fetch user's wallets to find holdings
  const { data: walletsRaw } = await supabase
    .from('wallets')
    .select('address')
    .eq('user_id', user!.id)

  const wallets = walletsRaw as { address: string }[] | null
  const walletAddresses = wallets?.map((w) => w.address) ?? []

  // Fetch holding for this asset
  let holding = null
  if (walletAddresses.length) {
    const { data } = await supabase
      .from('investor_holdings')
      .select('*')
      .eq('asset_id', id)
      .in('wallet_address', walletAddresses)
      .single()
    holding = data
  }

  // Fetch valuation history
  const { data: valuations } = await supabase
    .from('valuations')
    .select('*')
    .eq('asset_id', id)
    .order('recorded_at', { ascending: true })
    .limit(24)

  // Fetch valuation documents for audit trail
  const { data: valuationDocs } = await supabase
    .from('valuation_documents')
    .select('id, valuation_id, file_name, ai_extracted_value, ai_appraiser_name, ai_appraisal_date, ai_methodology, ai_summary, integrity_score, integrity_flags, signature_detected, status, created_at')
    .eq('asset_id', id)
    .in('status', ['passed', 'flagged'])
    .order('created_at', { ascending: false })

  // Fetch royalty history for this asset (filtered to user's wallets)
  type DistRow = {
    id: string
    event_type: string
    total_amount: number
    distributable_amount: number
    currency: string
    status: string
    created_at: string
    distribution_payments: { wallet_address: string; amount: number; currency: string; status: string }[] | null
  }

  const { data: distributionsRaw } = await supabase
    .from('distributions')
    .select(`
      id, event_type, total_amount, distributable_amount, currency, status, created_at,
      distribution_payments ( wallet_address, amount, currency, status )
    `)
    .eq('asset_id', id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(10)

  const distributions = distributionsRaw as DistRow[] | null

  const userPayments = distributions?.map((d) => ({
    ...d,
    myPayment: d.distribution_payments?.find((p) =>
      walletAddresses.includes(p.wallet_address)
    ) ?? null,
  }))

  // Fetch published quarterly updates
  const { data: updatesRaw } = await supabase
    .from('issuer_updates')
    .select('*')
    .eq('asset_id', id)
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(8)

  const updates = (updatesRaw ?? []) as IssuerUpdateRow[]

  // Fetch circulating supply (sum of all holdings for this asset)
  const { data: holdingsAgg } = await supabase
    .from('investor_holdings')
    .select('token_balance')
    .eq('asset_id', id)

  const circulatingSupply = (holdingsAgg ?? []).reduce(
    (sum, h) => sum + Number(h.token_balance), 0
  )

  // Fetch asset documents
  const { data: docsRaw } = await supabase
    .from('asset_documents')
    .select('*')
    .eq('asset_id', id)
    .order('created_at', { ascending: false })

  const documents = (docsRaw ?? []) as AssetDocumentRow[]

  return (
    <div className="space-y-6">
      <AssetHeader asset={asset} holding={holding} />
      <AssetStats asset={asset} holding={holding} circulatingSupply={circulatingSupply} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <ValuationChart valuations={valuations ?? []} />
          <QuarterlyUpdates updates={updates} tokenSymbol={(asset as { token_symbol: string }).token_symbol} />
          <ValuationAuditTrail
            valuations={(valuations ?? []).slice().reverse() as Array<{
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
            tokenSymbol={(asset as { token_symbol: string }).token_symbol}
          />
          <DistributionHistory distributions={userPayments ?? []} />
        </div>
        <div className="space-y-4">
          <AssetDetails asset={asset} circulatingSupply={circulatingSupply} />
          <AssetDocumentsList documents={documents} />
        </div>
      </div>
    </div>
  )
}
