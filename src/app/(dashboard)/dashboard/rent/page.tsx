import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RentPaymentPortal } from '@/components/tenant/rent-payment-portal'

export default async function RentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch active leases with asset info
  const { data: leases } = await supabase
    .from('asset_leases')
    .select('id, monthly_rent, due_day, asset_id, assets(asset_name, location)')
    .eq('tenant_user_id', user.id)
    .eq('status', 'active')

  const leaseData = (leases ?? []).map((l) => {
    const asset = (l as Record<string, unknown>).assets as { asset_name: string; location: string | null } | null
    return {
      id: l.id,
      monthly_rent: Number(l.monthly_rent),
      due_day: l.due_day,
      asset_name: asset?.asset_name ?? 'Unknown Property',
      location: asset?.location ?? null,
    }
  })

  // Fetch all payments for this tenant, ordered by due date
  const { data: allPayments } = await supabase
    .from('lease_payments')
    .select('id, lease_id, due_date, amount_due, amount_paid, status, paid_at, asset_id, assets(asset_name)')
    .eq('tenant_user_id', user.id)
    .order('due_date', { ascending: false })
    .limit(50)

  const paymentData = (allPayments ?? []).map((p) => {
    const asset = (p as Record<string, unknown>).assets as { asset_name: string } | null
    return {
      id: p.id,
      lease_id: p.lease_id,
      due_date: p.due_date,
      amount_due: Number(p.amount_due),
      amount_paid: p.amount_paid ? Number(p.amount_paid) : null,
      status: p.status,
      paid_at: p.paid_at,
      asset_name: asset?.asset_name ?? 'Unknown Property',
    }
  })

  // Find next payment due (earliest unpaid)
  const nextPayment = paymentData.find((p) => p.status === 'due' || p.status === 'late') ?? null

  // Compute stats
  const paidPayments = paymentData.filter((p) => p.status === 'paid')
  const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount_due, 0)
  const upcomingCount = paymentData.filter((p) => p.status === 'due').length

  // On-time rate: paid payments where paid_at <= due_date
  const onTimeCount = paidPayments.filter((p) => {
    if (!p.paid_at) return false
    return new Date(p.paid_at) <= new Date(p.due_date + 'T23:59:59')
  }).length
  const onTimeRate = paidPayments.length > 0 ? Math.round((onTimeCount / paidPayments.length) * 100) : 100

  return (
    <RentPaymentPortal
      leases={leaseData}
      nextPayment={nextPayment}
      payments={paymentData}
      stats={{ totalPaid, onTimeRate, upcomingCount }}
    />
  )
}
