import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createCustodialWallet } from '@/lib/xrpl/wallet-manager'

/**
 * Generate a personal custodial wallet for an issuer/owner.
 * Admin-only. This is separate from the token/asset wallet.
 *
 * POST body: { userId: string }
 * Returns: { address: string }
 */
export async function POST(req: Request) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { supabase, user } = auth

  // Verify admin
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  try {
    const { userId } = await req.json()
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const { address } = await createCustodialWallet(userId)
    return NextResponse.json({ address })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate owner wallet' },
      { status: 500 }
    )
  }
}
