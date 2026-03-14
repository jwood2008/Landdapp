import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createCustodialWallet } from '@/lib/xrpl/wallet-manager'

/**
 * Creates a custodial XRPL wallet for the authenticated user.
 * Called automatically when an investor first funds their account.
 * Returns only the address — never the seed.
 *
 * POST — no body needed (uses auth session)
 * Returns: { address: string }
 */
export async function POST() {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { user } = auth

  try {
    const { address } = await createCustodialWallet(user.id)

    return NextResponse.json({ address })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create wallet' },
      { status: 500 }
    )
  }
}
