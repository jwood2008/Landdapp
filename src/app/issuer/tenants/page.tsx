import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { IssuerTenantManager } from '@/components/issuer/issuer-tenant-manager'

export default async function IssuerTenantsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'issuer' && profile?.role !== 'admin') redirect('/dashboard')

  // Fetch issuer's assets
  const { data: assets } = await supabase
    .from('assets')
    .select('id, asset_name, location, token_symbol')
    .eq('owner_id', user.id)
    .eq('is_active', true)
    .order('asset_name')

  // Fetch all leases for issuer's assets with tenant info
  const assetIds = (assets ?? []).map((a) => a.id)
  let leases: Record<string, unknown>[] = []

  if (assetIds.length > 0) {
    const { data } = await supabase
      .from('asset_leases')
      .select('*, assets(asset_name, location), users!asset_leases_tenant_user_id_fkey(email, full_name)')
      .in('asset_id', assetIds)
      .order('created_at', { ascending: false })

    leases = (data ?? []) as Record<string, unknown>[]
  }

  // Get payment stats per lease
  const leaseIds = leases.map((l) => l.id as string)
  let paymentStats: Record<string, { total: number; paid: number; late: number }> = {}

  if (leaseIds.length > 0) {
    const { data: payments } = await supabase
      .from('lease_payments')
      .select('lease_id, status')
      .in('lease_id', leaseIds)

    for (const p of payments ?? []) {
      if (!paymentStats[p.lease_id]) paymentStats[p.lease_id] = { total: 0, paid: 0, late: 0 }
      paymentStats[p.lease_id].total++
      if (p.status === 'paid') paymentStats[p.lease_id].paid++
      if (p.status === 'late') paymentStats[p.lease_id].late++
    }
  }

  const leaseData = leases.map((l) => {
    const asset = l.assets as { asset_name: string; location: string | null } | null
    const tenant = l.users as { email: string; full_name: string | null } | null
    const stats = paymentStats[l.id as string] ?? { total: 0, paid: 0, late: 0 }
    return {
      id: l.id as string,
      asset_id: l.asset_id as string,
      monthly_rent: Number(l.monthly_rent),
      due_day: l.due_day as number,
      lease_start_date: l.lease_start_date as string,
      lease_end_date: l.lease_end_date as string | null,
      status: l.status as string,
      property_unit: l.property_unit as string | null,
      asset_name: asset?.asset_name ?? 'Unknown',
      location: asset?.location ?? null,
      tenant_email: tenant?.email ?? 'Unknown',
      tenant_name: tenant?.full_name ?? null,
      payment_stats: stats,
    }
  })

  return (
    <IssuerTenantManager
      leases={leaseData}
      assets={(assets ?? []).map((a) => ({ id: a.id, asset_name: a.asset_name, location: a.location }))}
    />
  )
}
