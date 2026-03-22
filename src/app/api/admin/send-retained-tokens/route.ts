import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { signAndSubmitFromAddress, signAndSubmit } from '@/lib/xrpl/wallet-manager'
import { buildPaymentAmount } from '@/lib/xrpl/amount'

/**
 * Send the owner-retained tokens from the asset wallet to the owner's personal wallet.
 *
 * POST body: { assetId: string }
 *
 * Flow:
 * 1. Owner wallet creates trust line for the token
 * 2. Issuer wallet authorizes the trust line (if RequireAuth)
 * 3. Issuer wallet sends retained tokens to owner wallet
 * 4. Updates investor_holdings
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
    const { assetId } = await req.json()
    if (!assetId) {
      return NextResponse.json({ error: 'assetId required' }, { status: 400 })
    }

    const { data: asset } = await supabase
      .from('assets')
      .select('id, token_symbol, issuer_wallet, token_supply, owner_retained_percent, owner_wallet, owner_id')
      .eq('id', assetId)
      .single()

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    if (!asset.owner_wallet) {
      return NextResponse.json({ error: 'No owner wallet set on this asset' }, { status: 400 })
    }

    if (!asset.owner_retained_percent || asset.owner_retained_percent <= 0) {
      return NextResponse.json({ error: 'No retained tokens to send (owner_retained_percent is 0)' }, { status: 400 })
    }

    const retainedTokens = Math.floor(asset.token_supply * asset.owner_retained_percent / 100)
    if (retainedTokens <= 0) {
      return NextResponse.json({ error: 'Retained token amount rounds to 0' }, { status: 400 })
    }

    // Check if owner wallet is a custodial wallet (platform-managed)
    const { data: ownerCustodial } = await supabase
      .from('custodial_wallets')
      .select('address')
      .eq('address', asset.owner_wallet)
      .single()

    const isCustodial = !!ownerCustodial

    // Step 1: Owner wallet creates trust line for the token
    if (isCustodial) {
      try {
        await signAndSubmitFromAddress(asset.owner_wallet, {
          TransactionType: 'TrustSet',
          LimitAmount: {
            currency: asset.token_symbol,
            issuer: asset.issuer_wallet,
            value: '999999999',
          },
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        if (!msg.includes('tecDUPLICATE') && !msg.includes('already')) {
          console.warn('[send-retained] TrustSet warning:', msg)
        }
      }
    }

    // Step 2: Issuer authorizes the trust line (required when RequireAuth is enabled)
    try {
      await signAndSubmitFromAddress(asset.issuer_wallet, {
        TransactionType: 'TrustSet',
        LimitAmount: {
          currency: asset.token_symbol,
          issuer: asset.owner_wallet,
          value: '0',
        },
        Flags: 65536, // tfSetfAuth
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      console.warn('[send-retained] Trust line auth:', msg)
    }

    // Step 3: Send retained tokens from issuer wallet to owner wallet
    const tokenAmount = buildPaymentAmount(asset.token_symbol, String(retainedTokens), asset.issuer_wallet)

    const { hash, engineResult } = await signAndSubmitFromAddress(asset.issuer_wallet, {
      TransactionType: 'Payment',
      Destination: asset.owner_wallet,
      Amount: tokenAmount,
    })

    if (engineResult !== 'tesSUCCESS') {
      const errorMessages: Record<string, string> = {
        tecPATH_DRY: 'Trust line may not be ready. If using Xaman, the owner must set up the trust line first.',
        tecNO_LINE: 'No trust line found. Owner must create a trust line for this token first.',
        tecUNFUNDED_PAYMENT: 'Not enough tokens available in the issuer wallet.',
      }
      return NextResponse.json(
        { error: errorMessages[engineResult] ?? `Token delivery failed: ${engineResult}`, hash },
        { status: 500 }
      )
    }

    // Step 4: Update investor_holdings
    const { data: existingHolding } = await supabase
      .from('investor_holdings')
      .select('id, token_balance')
      .eq('wallet_address', asset.owner_wallet)
      .eq('asset_id', asset.id)
      .single()

    const ownershipPercent = (retainedTokens / asset.token_supply) * 100

    if (existingHolding) {
      await supabase
        .from('investor_holdings')
        .update({
          token_balance: Number(existingHolding.token_balance) + retainedTokens,
          ownership_percent: ownershipPercent,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', existingHolding.id)
    } else {
      await supabase.from('investor_holdings').insert({
        wallet_address: asset.owner_wallet,
        asset_id: asset.id,
        token_balance: retainedTokens,
        ownership_percent: ownershipPercent,
        last_synced_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      hash,
      engineResult,
      retainedTokens,
      ownerWallet: asset.owner_wallet,
      message: `${retainedTokens} ${asset.token_symbol} sent to owner wallet ${asset.owner_wallet.slice(0, 8)}...`,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send retained tokens' },
      { status: 500 }
    )
  }
}
