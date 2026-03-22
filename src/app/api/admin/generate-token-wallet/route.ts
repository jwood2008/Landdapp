import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import { encryptSeed } from '@/lib/crypto/wallet-encryption'
import { generateWallet, xrplSignAndSubmit } from '@/lib/xrpl/rpc'

/**
 * Generate a new custodial XRPL wallet for a token/asset.
 * Admin-only. The wallet is stored with wallet_type = 'token'.
 * Automatically enables RequireAuth on the new wallet.
 *
 * POST body: { label?: string }
 * Returns: { address, walletId, requireAuthEnabled }
 */
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if ('error' in auth && auth.error) return auth.error

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { label } = await req.json().catch(() => ({ label: undefined }))

    // Generate XRPL wallet (testnet: faucet, mainnet: wallet_propose)
    const { address, seed } = await generateWallet()

    // Encrypt seed
    const encryptedSeed = encryptSeed(seed)

    // Store as token wallet (no user_id)
    const { data: wallet, error: insertErr } = await supabase
      .from('custodial_wallets')
      .insert({
        user_id: null,
        address,
        encrypted_seed: encryptedSeed,
        encryption_method: 'aes-256-gcm-env',
        wallet_type: 'token',
        label: label || null,
        is_primary: true,
      })
      .select('id, address')
      .single()

    if (insertErr || !wallet) {
      throw new Error(`Failed to store wallet: ${insertErr?.message}`)
    }

    // Automatically enable DefaultRipple + RequireAuth on the new wallet
    let defaultRippleEnabled = false
    let requireAuthEnabled = false

    try {
      const rippleResult = await xrplSignAndSubmit(seed, {
        TransactionType: 'AccountSet',
        Account: address,
        SetFlag: 8, // asfDefaultRipple
      })
      defaultRippleEnabled = rippleResult.success
    } catch (err) {
      console.warn('[generate-token-wallet] Failed to enable DefaultRipple:', err)
    }

    try {
      const authResult = await xrplSignAndSubmit(seed, {
        TransactionType: 'AccountSet',
        Account: address,
        SetFlag: 2, // asfRequireAuth
      })
      requireAuthEnabled = authResult.success
    } catch (authErr) {
      console.warn('[generate-token-wallet] Failed to enable RequireAuth:', authErr)
    }

    console.warn(
      `[AUDIT] Admin ${auth.user.id} generated token wallet ${address}` +
      ` (DefaultRipple: ${defaultRippleEnabled}, RequireAuth: ${requireAuthEnabled})`
    )

    return NextResponse.json({
      address: wallet.address,
      walletId: wallet.id,
      requireAuthEnabled,
    })
  } catch (err) {
    console.error('[generate-token-wallet]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate wallet' },
      { status: 500 }
    )
  }
}
