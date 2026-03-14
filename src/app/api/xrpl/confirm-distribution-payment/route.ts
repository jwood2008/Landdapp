import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'

/**
 * Confirms a distribution payment by checking the Xaman payload status.
 * If signed, marks the payment as completed with the tx_hash.
 * If expired/rejected, resets to pending for retry.
 * Also checks if all payments in the distribution are done → marks distribution completed.
 *
 * Body: { distributionPaymentId, xamanUuid }
 */
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if ('error' in auth && auth.error) return auth.error

  const { supabase } = auth

  try {
    const { distributionPaymentId, xamanUuid } = await req.json()

    if (!distributionPaymentId || !xamanUuid) {
      return NextResponse.json({ error: 'distributionPaymentId and xamanUuid required' }, { status: 400 })
    }

    const apiKey = process.env.XUMM_APIKEY
    const apiSecret = process.env.XUMM_APISECRET

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Xaman API not configured' }, { status: 500 })
    }

    // Check Xaman payload status
    const xamanRes = await fetch(`https://xumm.app/api/v1/platform/payload/${xamanUuid}`, {
      headers: {
        'x-api-key': apiKey,
        'x-api-secret': apiSecret,
      },
    })

    if (!xamanRes.ok) {
      return NextResponse.json({ error: 'Failed to check Xaman payload' }, { status: 500 })
    }

    const xamanData = await xamanRes.json()
    const signed = xamanData.meta?.signed ?? false
    const expired = xamanData.meta?.expired ?? false
    const txHash = xamanData.response?.txid ?? null

    if (signed && txHash) {
      // Payment was signed successfully — mark completed
      await supabase
        .from('distribution_payments')
        .update({
          status: 'completed',
          tx_hash: txHash,
          completed_at: new Date().toISOString(),
        })
        .eq('id', distributionPaymentId)

      // Check if all payments in this distribution are completed
      const { data: payment } = await supabase
        .from('distribution_payments')
        .select('distribution_id')
        .eq('id', distributionPaymentId)
        .single()

      if (payment?.distribution_id) {
        const { count: pendingCount } = await supabase
          .from('distribution_payments')
          .select('*', { count: 'exact', head: true })
          .eq('distribution_id', payment.distribution_id)
          .neq('status', 'completed')

        if (pendingCount === 0) {
          // All payments done — mark distribution as completed
          await supabase
            .from('distributions')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', payment.distribution_id)
        }
      }

      return NextResponse.json({
        status: 'completed',
        txHash,
      })
    }

    if (expired) {
      // Payload expired — reset to pending for retry
      await supabase
        .from('distribution_payments')
        .update({ status: 'pending' })
        .eq('id', distributionPaymentId)

      return NextResponse.json({ status: 'expired' })
    }

    // Still waiting for signature
    return NextResponse.json({
      status: 'pending',
      signed: false,
      expired: false,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
