import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { supabase } = auth

  const assetId = req.nextUrl.searchParams.get('asset_id')
  const side = req.nextUrl.searchParams.get('side')
  const status = req.nextUrl.searchParams.get('status') ?? 'open'

  let query = supabase
    .from('marketplace_orders')
    .select('*, assets(asset_name, token_symbol, nav_per_token), platform_investors(wallet_address, full_name)')
    .eq('status', status)
    .order('created_at', { ascending: false })

  if (assetId) query = query.eq('asset_id', assetId)
  if (side) query = query.eq('side', side)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orders: data })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { supabase, user } = auth

  try {
    const { asset_id, side, token_amount, price_per_token, currency, expires_at } = await req.json()

    if (!asset_id || !side || !token_amount || !price_per_token) {
      return NextResponse.json(
        { error: 'asset_id, side, token_amount, and price_per_token required' },
        { status: 400 }
      )
    }

    // Find caller's wallet → platform_investor
    const { data: wallet } = await supabase
      .from('wallets')
      .select('address')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .single()

    if (!wallet) {
      return NextResponse.json({ error: 'No wallet linked to your account' }, { status: 400 })
    }

    const { data: investor } = await supabase
      .from('platform_investors')
      .select('id, kyc_status')
      .eq('wallet_address', wallet.address)
      .single()

    if (!investor) {
      return NextResponse.json({ error: 'Not a platform-approved investor' }, { status: 403 })
    }

    if (investor.kyc_status !== 'verified') {
      return NextResponse.json({ error: 'KYC not verified. Contact platform admin.' }, { status: 403 })
    }

    // Check marketplace is enabled
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('marketplace_enabled')
      .limit(1)
      .single()

    if (!settings?.marketplace_enabled) {
      return NextResponse.json({ error: 'Marketplace is currently disabled' }, { status: 403 })
    }

    const { data: order, error } = await supabase
      .from('marketplace_orders')
      .insert({
        investor_id: investor.id,
        asset_id,
        side,
        token_amount,
        price_per_token,
        currency: currency ?? 'RLUSD',
        expires_at: expires_at || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ order })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { supabase, user } = auth

  const orderId = req.nextUrl.searchParams.get('id')
  if (!orderId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Verify ownership
  const { data: wallet } = await supabase
    .from('wallets')
    .select('address')
    .eq('user_id', user.id)
    .eq('is_primary', true)
    .single()

  if (!wallet) return NextResponse.json({ error: 'No wallet linked' }, { status: 400 })

  const { data: investor } = await supabase
    .from('platform_investors')
    .select('id')
    .eq('wallet_address', wallet.address)
    .single()

  if (!investor) return NextResponse.json({ error: 'Not a platform investor' }, { status: 403 })

  const { error } = await supabase
    .from('marketplace_orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('investor_id', investor.id)
    .in('status', ['open', 'partial'])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
