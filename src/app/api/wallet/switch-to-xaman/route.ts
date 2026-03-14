import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

/**
 * When a user connects their Xaman wallet, this endpoint:
 * 1. Deletes their auto-created custodial wallet (encrypted seed included)
 * 2. Links the Xaman address as their primary wallet
 * 3. Updates platform_investors with the new address
 *
 * POST { xamanAddress: string }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { user } = auth

  const { xamanAddress } = await req.json()
  if (!xamanAddress || !/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(xamanAddress)) {
    return NextResponse.json({ error: 'Invalid XRPL address' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // 1. Delete the auto-created custodial wallet (seed and all)
    const { data: custodial } = await supabase
      .from('custodial_wallets')
      .select('id, address')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .single()

    if (custodial) {
      // Remove from wallets table first
      await supabase
        .from('wallets')
        .delete()
        .eq('user_id', user.id)
        .eq('address', custodial.address)

      // Delete the custodial wallet (encrypted seed wiped from DB)
      await supabase
        .from('custodial_wallets')
        .delete()
        .eq('id', custodial.id)
    }

    // 2. Upsert the Xaman address into wallets table
    // First deactivate any existing primary wallets
    await supabase
      .from('wallets')
      .update({ is_primary: false })
      .eq('user_id', user.id)

    await supabase
      .from('wallets')
      .upsert({
        user_id: user.id,
        address: xamanAddress,
        label: 'Xaman Wallet',
        is_primary: true,
      }, { onConflict: 'user_id,address' })

    // 3. Update platform_investors with the new wallet address
    await supabase
      .from('platform_investors')
      .update({ wallet_address: xamanAddress })
      .eq('user_id', user.id)

    return NextResponse.json({ success: true, address: xamanAddress })
  } catch (err) {
    console.error('[switch-to-xaman]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to switch wallet' },
      { status: 500 }
    )
  }
}
