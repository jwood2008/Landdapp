import { NextResponse } from 'next/server'
import { signAndSubmitFromAddress } from '@/lib/xrpl/wallet-manager'

/**
 * One-time admin endpoint to enable DefaultRipple on an issuer wallet.
 * This is required for tokens to flow between accounts on the XRPL.
 *
 * GET /api/admin/enable-ripple?address=rXXX
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const address = url.searchParams.get('address')

  if (!address) {
    return NextResponse.json({ error: 'address param required' }, { status: 400 })
  }

  try {
    // AccountSet with SetFlag: 8 (asfDefaultRipple)
    const { hash, engineResult } = await signAndSubmitFromAddress(address, {
      TransactionType: 'AccountSet',
      SetFlag: 8,
    })

    return NextResponse.json({
      success: true,
      hash,
      engineResult,
      message: `DefaultRipple enabled on ${address}`,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    )
  }
}
