import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth && auth.error) return auth.error
  const { supabase } = auth

  const { data, error } = await supabase
    .from('platform_settings')
    .select('*')
    .limit(1)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data })
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin()
  if ('error' in auth && auth.error) return auth.error
  const { supabase } = auth

  try {
    const body = await req.json()

    const allowed = [
      'platform_name', 'domain_wallet', 'require_kyc', 'require_aml',
      'require_accreditation', 'auto_authorize_tokens', 'marketplace_enabled',
      'marketplace_fee_bps', 'tokenization_fee_bps',
    ]

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key]
    }

    // Get the singleton ID first
    const { data: existing } = await supabase
      .from('platform_settings')
      .select('id')
      .limit(1)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('platform_settings')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ settings: data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
