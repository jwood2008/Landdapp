import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

export async function GET() {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { supabase, user } = auth

  const { data } = await supabase
    .from('notification_preferences')
    .select('trade_confirmations, order_updates, distribution_alerts, account_updates')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({
    preferences: data ?? {
      trade_confirmations: true,
      order_updates: true,
      distribution_alerts: true,
      account_updates: true,
    },
  })
}

export async function PUT(req: Request) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { supabase, user } = auth

  const body = await req.json()

  // Only allow valid preference keys
  const allowed = ['trade_confirmations', 'order_updates', 'distribution_alerts', 'account_updates']
  const updates: Record<string, boolean> = {}
  for (const key of allowed) {
    if (key in body && typeof body[key] === 'boolean') {
      updates[key] = body[key]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid preferences provided' }, { status: 400 })
  }

  // Upsert
  const { error } = await supabase
    .from('notification_preferences')
    .upsert(
      { user_id: user.id, ...updates, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
