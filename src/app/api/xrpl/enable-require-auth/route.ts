import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import { decryptSeed } from '@/lib/crypto/wallet-encryption'
import { xrplSignAndSubmit } from '@/lib/xrpl/rpc'

/**
 * Enables RequireAuth (asfRequireAuth = 2) on an issuer account.
 *
 * If the issuer wallet is custodial → signs and submits directly.
 * If external → creates a Xaman payload for signing.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth && auth.error) return auth.error

  const { issuerAddress } = await req.json()
  if (!issuerAddress) {
    return NextResponse.json({ error: 'issuerAddress required' }, { status: 400 })
  }

  // Check if this is a custodial wallet
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: custodialWallet } = await supabase
    .from('custodial_wallets')
    .select('id, encrypted_seed')
    .eq('address', issuerAddress)
    .single()

  // ── Custodial path: sign and submit directly ──
  if (custodialWallet) {
    try {
      const seed = decryptSeed(custodialWallet.encrypted_seed)
      const result = await xrplSignAndSubmit(seed, {
        TransactionType: 'AccountSet',
        Account: issuerAddress,
        SetFlag: 2, // asfRequireAuth
      })

      if (result.success) {
        return NextResponse.json({
          custodial: true,
          success: true,
          txHash: result.hash,
          engineResult: result.engineResult,
        })
      } else {
        return NextResponse.json(
          { error: `AccountSet failed: ${result.engineResult}`, custodial: true },
          { status: 400 }
        )
      }
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Signing failed' },
        { status: 500 }
      )
    }
  }

  // ── External wallet path: Xaman signing ──
  const apiKey = process.env.XUMM_APIKEY
  const apiSecret = process.env.XUMM_APISECRET

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: 'Xaman API not configured' }, { status: 503 })
  }

  const payload = {
    txjson: {
      TransactionType: 'AccountSet',
      Account: issuerAddress,
      SetFlag: 2,
    },
    options: { submit: true, expire: 300 },
    custom_meta: {
      instruction: 'Enable RequireAuth on your issuer account. This ensures only approved investors can hold your tokens.',
    },
  }

  const res = await fetch('https://xumm.app/api/v1/platform/payload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'x-api-secret': apiSecret,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `Xaman error: ${text}` }, { status: res.status })
  }

  const data = await res.json()
  return NextResponse.json({
    custodial: false,
    uuid: data.uuid,
    qr_png: data.refs?.qr_png,
    deep_link: data.next?.always,
  })
}
