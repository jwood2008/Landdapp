import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import { decryptSeed } from '@/lib/crypto/wallet-encryption'

/**
 * Admin-only: Decrypt and return a custodial wallet's private key.
 * Requires admin auth. Logs the access for audit trail.
 *
 * POST body: { walletId: string }
 * Returns: { seed: string, address: string }
 */
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if ('error' in auth && auth.error) return auth.error
  const { user } = auth

  try {
    const { walletId } = await req.json()

    if (!walletId) {
      return NextResponse.json({ error: 'walletId required' }, { status: 400 })
    }

    // Use service role to access encrypted_seed (admin's session can't read it via RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: wallet, error } = await supabase
      .from('custodial_wallets')
      .select('id, address, encrypted_seed, user_id')
      .eq('id', walletId)
      .single()

    if (error || !wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }

    // Decrypt the seed
    const seed = decryptSeed(wallet.encrypted_seed)

    // Log the access for audit
    console.warn(
      `[AUDIT] Admin ${user.id} (${user.email}) revealed private key for wallet ${wallet.address} (user: ${wallet.user_id})`
    )

    return NextResponse.json({
      seed,
      address: wallet.address,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to decrypt key' },
      { status: 500 }
    )
  }
}
