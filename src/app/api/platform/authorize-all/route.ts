import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'

/**
 * Batch-authorize an investor for ALL active assets in the permission domain.
 * Creates platform_authorization records (status: 'pending') for each asset
 * that doesn't already have one for this investor.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if ('error' in auth && auth.error) return auth.error
  const { supabase, user } = auth

  try {
    const { investorId } = await req.json()
    if (!investorId) {
      return NextResponse.json({ error: 'investorId required' }, { status: 400 })
    }

    // Verify investor exists and is verified
    const { data: investor } = await supabase
      .from('platform_investors')
      .select('id, kyc_status, wallet_address')
      .eq('id', investorId)
      .single()

    if (!investor) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 })
    }

    // Get all active assets
    const { data: assets } = await supabase
      .from('assets')
      .select('id, token_symbol')
      .eq('is_active', true)

    if (!assets || assets.length === 0) {
      return NextResponse.json({ authorizations: [], count: 0 })
    }

    // Get existing authorizations
    const { data: existing } = await supabase
      .from('platform_authorizations')
      .select('asset_id')
      .eq('investor_id', investorId)

    const existingAssetIds = new Set((existing ?? []).map((e) => e.asset_id))

    // Insert missing authorizations
    const newAuths = assets
      .filter((a) => !existingAssetIds.has(a.id))
      .map((a) => ({
        investor_id: investorId,
        asset_id: a.id,
        status: 'pending' as const,
        authorized_by: user.id,
      }))

    if (newAuths.length === 0) {
      // All already authorized — fetch and return existing
      const { data: allAuths } = await supabase
        .from('platform_authorizations')
        .select('*')
        .eq('investor_id', investorId)

      return NextResponse.json({
        authorizations: allAuths ?? [],
        count: 0,
        message: 'Investor already authorized for all active assets',
      })
    }

    const { data: inserted, error } = await supabase
      .from('platform_authorizations')
      .insert(newAuths)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      authorizations: inserted,
      count: inserted?.length ?? 0,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
