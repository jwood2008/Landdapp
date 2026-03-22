import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/oracle/review
 * Admin reviews a flagged payment: approve or reject.
 * Body: { paymentId, action: 'approve' | 'reject', notes?: string }
 */
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if ('error' in auth && auth.error) return auth.error
  const { user } = auth

  const { paymentId, action, notes } = await req.json()
  if (!paymentId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'paymentId and action (approve/reject) required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: payment } = await supabase
    .from('operator_payments')
    .select('id, status')
    .eq('id', paymentId)
    .single()

  if (!payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  if (payment.status !== 'flagged') {
    return NextResponse.json({ error: `Payment is ${payment.status}, not flagged` }, { status: 400 })
  }

  if (action === 'approve') {
    // Move to validated — the next oracle run will pick it up for distribution
    await supabase
      .from('operator_payments')
      .update({ status: 'validated', flagged_reason: null })
      .eq('id', paymentId)

    // Update validation record
    await supabase
      .from('oracle_validations')
      .update({
        auto_approved: false,
        requires_review: false,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: notes ?? 'Manually approved by admin',
      })
      .eq('operator_payment_id', paymentId)
  } else {
    await supabase
      .from('operator_payments')
      .update({ status: 'ignored', flagged_reason: notes ?? 'Rejected by admin' })
      .eq('id', paymentId)

    await supabase
      .from('oracle_validations')
      .update({
        requires_review: false,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: notes ?? 'Rejected by admin',
      })
      .eq('operator_payment_id', paymentId)
  }

  return NextResponse.json({ success: true, action })
}
