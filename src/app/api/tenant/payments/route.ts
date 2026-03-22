import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { user, supabase } = auth

  const url = new URL(req.url)
  const leaseId = url.searchParams.get('leaseId')
  const status = url.searchParams.get('status')
  const page = parseInt(url.searchParams.get('page') ?? '1')
  const limit = 20

  let query = supabase
    .from('lease_payments')
    .select('*, assets(asset_name)', { count: 'exact' })
    .eq('tenant_user_id', user.id)
    .order('due_date', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (leaseId) query = query.eq('lease_id', leaseId)
  if (status) query = query.eq('status', status)

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    payments: data ?? [],
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / limit),
  })
}
