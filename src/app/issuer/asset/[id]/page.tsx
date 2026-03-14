import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { IssuerAssetDetail } from '@/components/issuer/issuer-asset-detail'

interface Props {
  params: Promise<{ id: string }>
}

export default async function IssuerAssetPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch asset — must be owned by this issuer
  const { data: asset, error } = await supabase
    .from('assets')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (error || !asset) notFound()

  // Fetch all related data in parallel
  const [
    { data: valuations },
    { data: valuationDocs },
    { data: distributions },
    { data: approvals },
  ] = await Promise.all([
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
      .from('distributions')
      .select('*')
      .eq('asset_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('investor_approvals')
      .select('*')
      .eq('asset_id', id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <IssuerAssetDetail
      asset={asset as Record<string, unknown>}
      valuations={(valuations ?? []) as Array<Record<string, unknown>>}
      valuationDocs={(valuationDocs ?? []) as Array<Record<string, unknown>>}
      distributions={(distributions ?? []) as Array<Record<string, unknown>>}
      approvals={(approvals ?? []) as Array<Record<string, unknown>>}
    />
  )
}
