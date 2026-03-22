import { NextRequest, NextResponse } from 'next/server'
import { requireIssuer } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const auth = await requireIssuer()
  if ('error' in auth && auth.error) return auth.error
  const { user, supabase } = auth

  try {
    const { assetId, tenantEmail, monthlyRent, dueDay, leaseStartDate, leaseEndDate } = await req.json()

    if (!assetId || !tenantEmail || !monthlyRent || !dueDay || !leaseStartDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (dueDay < 1 || dueDay > 28) {
      return NextResponse.json({ error: 'Due day must be between 1 and 28' }, { status: 400 })
    }

    // Verify issuer owns the asset
    const { data: asset, error: assetErr } = await supabase
      .from('assets')
      .select('id, owner_id, asset_name')
      .eq('id', assetId)
      .single()

    if (assetErr || !asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    if (asset.owner_id !== user.id) {
      // Check if admin
      const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'You do not own this asset' }, { status: 403 })
      }
    }

    // Look up tenant by email using service role (auth.users table)
    const svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // First check the users table
    const { data: tenantUser, error: tenantErr } = await svc
      .from('users')
      .select('id, email, full_name')
      .eq('email', tenantEmail.trim().toLowerCase())
      .single()

    if (tenantErr || !tenantUser) {
      return NextResponse.json(
        { error: 'No account found with that email. The tenant needs to create an account first.' },
        { status: 404 }
      )
    }

    // Check if an active lease already exists
    const { data: existing } = await svc
      .from('asset_leases')
      .select('id')
      .eq('asset_id', assetId)
      .eq('tenant_user_id', tenantUser.id)
      .eq('status', 'active')
      .single()

    if (existing) {
      return NextResponse.json({ error: 'This tenant already has an active lease for this property' }, { status: 409 })
    }

    // Create the lease
    const { data: lease, error: leaseErr } = await svc
      .from('asset_leases')
      .insert({
        asset_id: assetId,
        tenant_user_id: tenantUser.id,
        monthly_rent: monthlyRent,
        due_day: dueDay,
        lease_start_date: leaseStartDate,
        lease_end_date: leaseEndDate || null,
        status: 'active',
        assigned_by: user.id,
      })
      .select()
      .single()

    if (leaseErr || !lease) {
      return NextResponse.json({ error: leaseErr?.message ?? 'Failed to create lease' }, { status: 500 })
    }

    // Generate payment schedule (next 6 months)
    await svc.rpc('generate_lease_payments', { p_lease_id: lease.id, p_months_ahead: 6 })

    // Also add the tenant's custodial wallet as an operator wallet on the asset's oracle config
    // so the oracle can recognize rent payments automatically
    const { data: assetFull } = await svc.from('assets').select('oracle_config').eq('id', assetId).single()
    const currentConfig = (assetFull?.oracle_config ?? {}) as Record<string, unknown>

    // Get tenant's custodial wallet address
    const { data: tenantWallet } = await svc
      .from('custodial_wallets')
      .select('address')
      .eq('user_id', tenantUser.id)
      .eq('is_primary', true)
      .single()

    if (tenantWallet) {
      const operatorWallets = (currentConfig.operator_wallets as string[] ?? [])
      if (!operatorWallets.includes(tenantWallet.address)) {
        await svc.from('assets').update({
          oracle_config: {
            ...currentConfig,
            operator_wallets: [...operatorWallets, tenantWallet.address],
          },
        }).eq('id', assetId)
      }
    }

    return NextResponse.json({
      success: true,
      leaseId: lease.id,
      tenantName: tenantUser.full_name ?? tenantUser.email,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to assign tenant' },
      { status: 500 }
    )
  }
}
