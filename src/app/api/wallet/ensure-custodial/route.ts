import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createCustodialWallet } from '@/lib/xrpl/wallet-manager'

/**
 * Ensures the authenticated user has a custodial wallet.
 * Called automatically on signup callback and login.
 * Idempotent — returns existing wallet if one already exists.
 *
 * POST — no body needed (uses auth session)
 * Returns: { address: string, created: boolean }
 */
export async function POST() {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { user } = auth

  try {
    // Check user role — only investors get auto-wallets
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    // Only create wallets for investors
    if (profile?.role !== 'investor') {
      return NextResponse.json({ address: null, created: false, reason: 'not_investor' })
    }

    // Check if user already has a custodial wallet
    const { data: existing } = await supabase
      .from('custodial_wallets')
      .select('address')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .single()

    if (existing) {
      return NextResponse.json({ address: existing.address, created: false })
    }

    // Create one
    const { address } = await createCustodialWallet(user.id)
    return NextResponse.json({ address, created: true })
  } catch (err) {
    console.error('[ensure-custodial]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to ensure wallet' },
      { status: 500 }
    )
  }
}
