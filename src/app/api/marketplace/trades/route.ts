import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

export async function GET() {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { supabase, user } = auth

  try {
    // Find caller's platform_investor record
    const { data: wallet } = await supabase
      .from('wallets')
      .select('address')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .single()

    if (!wallet) {
      return NextResponse.json({ trades: [] })
    }

    const { data: investor } = await supabase
      .from('platform_investors')
      .select('id')
      .eq('wallet_address', wallet.address)
      .single()

    if (!investor) {
      return NextResponse.json({ trades: [] })
    }

    const { data, error } = await supabase
      .from('trades')
      .select('*, assets(asset_name, token_symbol)')
      .or(`buyer_id.eq.${investor.id},seller_id.eq.${investor.id}`)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ trades: data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
