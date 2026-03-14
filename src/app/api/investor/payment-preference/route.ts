import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

const VALID_CURRENCIES = ['USD', 'RLUSD', 'XRP'] as const

/**
 * GET  /api/investor/payment-preference  — fetch current preference
 * PATCH /api/investor/payment-preference — update preference
 */
export async function GET() {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { supabase, user } = auth

  // Find platform_investor by user_id or by linked wallet
  const { data: investor } = await supabase
    .from('platform_investors')
    .select('id, receive_currency')
    .eq('user_id', user.id)
    .single()

  if (!investor) {
    // Try via wallet address
    const { data: wallet } = await supabase
      .from('wallets')
      .select('address')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .single()

    if (wallet) {
      const { data: investorByWallet } = await supabase
        .from('platform_investors')
        .select('id, receive_currency')
        .eq('wallet_address', wallet.address)
        .single()

      if (investorByWallet) {
        return NextResponse.json({ receiveCurrency: investorByWallet.receive_currency ?? 'USD' })
      }
    }

    return NextResponse.json({ receiveCurrency: 'USD' })
  }

  return NextResponse.json({ receiveCurrency: investor.receive_currency ?? 'USD' })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { supabase, user } = auth

  const { receiveCurrency } = await req.json()

  if (!VALID_CURRENCIES.includes(receiveCurrency)) {
    return NextResponse.json(
      { error: `Invalid currency. Must be one of: ${VALID_CURRENCIES.join(', ')}` },
      { status: 400 }
    )
  }

  // Try update by user_id first
  const { data: updated, error: updateErr } = await supabase
    .from('platform_investors')
    .update({ receive_currency: receiveCurrency, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .select('id')

  if (!updateErr && updated && updated.length > 0) {
    return NextResponse.json({ receiveCurrency, updated: true })
  }

  // Fallback: try via wallet address
  const { data: wallet } = await supabase
    .from('wallets')
    .select('address')
    .eq('user_id', user.id)
    .eq('is_primary', true)
    .single()

  if (wallet) {
    const { error: walletUpdateErr } = await supabase
      .from('platform_investors')
      .update({ receive_currency: receiveCurrency, updated_at: new Date().toISOString() })
      .eq('wallet_address', wallet.address)

    if (!walletUpdateErr) {
      return NextResponse.json({ receiveCurrency, updated: true })
    }
  }

  return NextResponse.json(
    { error: 'No investor profile found. Connect a wallet first.' },
    { status: 404 }
  )
}
