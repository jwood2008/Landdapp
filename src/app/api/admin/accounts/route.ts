import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { signAndSubmit, signAndSubmitFromAddress, getCustodialAddress } from '@/lib/xrpl/wallet-manager'

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const { supabase } = auth
  const body = await request.json()
  const { userId, action } = body as { userId: string; action: 'approve' | 'reject' }

  if (!userId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected'

  const { error } = await supabase
    .from('users')
    .update({ account_status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // On approval: auto-setup trust lines + authorization for all active tokens
  // This puts the investor into the permission domain immediately
  if (action === 'approve') {
    try {
      const investorAddress = await getCustodialAddress(userId)
      if (investorAddress) {
        // Fetch all active assets to setup trust lines
        const { data: assets } = await supabase
          .from('assets')
          .select('token_symbol, issuer_wallet')
          .eq('is_active', true)

        for (const asset of (assets ?? [])) {
          // 1. Investor creates trust line to issuer
          try {
            await signAndSubmit(userId, {
              TransactionType: 'TrustSet',
              LimitAmount: {
                currency: asset.token_symbol,
                issuer: asset.issuer_wallet,
                value: '999999999',
              },
            })
            console.log(`[account-approve] TrustSet created for ${investorAddress} → ${asset.token_symbol}`)
          } catch (err) {
            const msg = err instanceof Error ? err.message : ''
            if (!msg.includes('tecDUPLICATE') && !msg.includes('already')) {
              console.warn(`[account-approve] TrustSet failed for ${asset.token_symbol}:`, msg)
            }
          }

          // 2. Issuer authorizes the trust line (RequireAuth)
          try {
            await signAndSubmitFromAddress(asset.issuer_wallet, {
              TransactionType: 'TrustSet',
              LimitAmount: {
                currency: asset.token_symbol,
                issuer: investorAddress,
                value: '0',
              },
              Flags: 65536, // tfSetfAuth
            })
            console.log(`[account-approve] Trust line authorized for ${investorAddress} on ${asset.token_symbol}`)
          } catch (err) {
            const msg = err instanceof Error ? err.message : ''
            console.warn(`[account-approve] Trust auth failed for ${asset.token_symbol}:`, msg)
          }
        }
      }
    } catch (err) {
      // Non-fatal — trust line setup is best-effort
      console.warn('[account-approve] Trust line auto-setup error:', err)
    }
  }

  return NextResponse.json({ success: true, status: newStatus })
}
