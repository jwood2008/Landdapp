import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { signAndSubmit } from '@/lib/xrpl/wallet-manager'
import { getXrpUsdPrice, usdToXrp } from '@/lib/xrpl/xrp-price'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { user, supabase } = auth

  try {
    const { paymentId } = await req.json()
    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId is required' }, { status: 400 })
    }

    // Fetch payment and verify ownership
    const { data: payment, error: payErr } = await supabase
      .from('lease_payments')
      .select('*, asset_leases(asset_id, assets(issuer_wallet, token_symbol))')
      .eq('id', paymentId)
      .eq('tenant_user_id', user.id)
      .single()

    if (payErr || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    if (payment.status !== 'due' && payment.status !== 'late') {
      return NextResponse.json({ error: 'Payment is not in a payable state' }, { status: 400 })
    }

    const lease = payment.asset_leases as Record<string, unknown> | null
    const asset = (lease?.assets ?? null) as { issuer_wallet: string; token_symbol: string } | null

    if (!asset?.issuer_wallet) {
      return NextResponse.json({ error: 'Property wallet not configured' }, { status: 500 })
    }

    // Mark as processing
    await supabase
      .from('lease_payments')
      .update({ status: 'processing' })
      .eq('id', paymentId)

    // Convert USD to XRP
    const xrpPrice = await getXrpUsdPrice()
    const xrpAmount = usdToXrp(Number(payment.amount_due), xrpPrice)
    const dropsAmount = Math.floor(xrpAmount * 1_000_000).toString()

    // Execute XRPL payment from tenant's custodial wallet to issuer wallet
    const { hash, engineResult } = await signAndSubmit(user.id, {
      TransactionType: 'Payment',
      Destination: asset.issuer_wallet,
      Amount: dropsAmount,
    })

    if (engineResult !== 'tesSUCCESS') {
      await supabase
        .from('lease_payments')
        .update({ status: 'failed' })
        .eq('id', paymentId)

      return NextResponse.json({ error: `Transaction failed: ${engineResult}` }, { status: 500 })
    }

    // Update payment record
    const now = new Date().toISOString()
    await supabase
      .from('lease_payments')
      .update({
        status: 'paid',
        amount_paid: payment.amount_due,
        payment_method: 'platform',
        xrp_amount: xrpAmount,
        xrp_price_at_payment: xrpPrice,
        xrpl_tx_hash: hash,
        paid_at: now,
      })
      .eq('id', paymentId)

    // Insert into operator_payments so the oracle can pick it up for distribution
    // Use service role to bypass RLS
    const svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await svc.from('operator_payments').insert({
      asset_id: payment.asset_id,
      tx_hash: hash,
      sender_address: '', // will be filled by oracle monitor
      destination_address: asset.issuer_wallet,
      amount: xrpAmount,
      currency: 'XRP',
      ledger_index: 0,
      tx_date: now,
      matched: true,
      match_confidence: 100,
      match_notes: 'Tenant rent payment via platform',
      status: 'validated',
    }).then(() => {}) // fire-and-forget, oracle will process

    return NextResponse.json({
      success: true,
      txHash: hash,
      confirmationId: paymentId.slice(0, 8).toUpperCase(),
      amountPaid: payment.amount_due,
      xrpAmount,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Payment failed' },
      { status: 500 }
    )
  }
}
