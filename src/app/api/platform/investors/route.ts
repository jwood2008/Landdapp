import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth && auth.error) return auth.error
  const { supabase } = auth

  const status = req.nextUrl.searchParams.get('status')

  let query = supabase
    .from('platform_investors')
    .select('*, platform_authorizations(id, asset_id, status)')
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('kyc_status', status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ investors: data })
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if ('error' in auth && auth.error) return auth.error
  const { supabase, user } = auth

  try {
    const body = await req.json()
    const { wallet_address, full_name, email, kyc_status, aml_cleared, accredited, country_code, notes } = body

    if (!wallet_address) {
      return NextResponse.json({ error: 'wallet_address required' }, { status: 400 })
    }

    const insert: Record<string, unknown> = {
      wallet_address,
      full_name: full_name || null,
      email: email || null,
      kyc_status: kyc_status || 'pending',
      aml_cleared: aml_cleared ?? false,
      accredited: accredited ?? false,
      country_code: country_code || null,
      notes: notes || null,
    }

    if (kyc_status === 'verified') {
      insert.kyc_verified_at = new Date().toISOString()
      insert.approved_by = user.id
      insert.approved_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('platform_investors')
      .insert(insert)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // If auto_authorize is enabled and investor is verified, authorize for all tokens
    if (kyc_status === 'verified') {
      const { data: settings } = await supabase
        .from('platform_settings')
        .select('auto_authorize_tokens')
        .limit(1)
        .single()

      if (settings?.auto_authorize_tokens) {
        const { data: assets } = await supabase
          .from('assets')
          .select('id')
          .eq('is_active', true)

        if (assets && assets.length > 0) {
          const authInserts = assets.map((a) => ({
            investor_id: data.id,
            asset_id: a.id,
            status: 'pending',
          }))
          await supabase.from('platform_authorizations').insert(authInserts)
        }
      }
    }

    return NextResponse.json({ investor: data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin()
  if ('error' in auth && auth.error) return auth.error
  const { supabase, user } = auth

  try {
    const body = await req.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (updates.kyc_status !== undefined) updateData.kyc_status = updates.kyc_status
    if (updates.aml_cleared !== undefined) updateData.aml_cleared = updates.aml_cleared
    if (updates.accredited !== undefined) updateData.accredited = updates.accredited
    if (updates.full_name !== undefined) updateData.full_name = updates.full_name
    if (updates.email !== undefined) updateData.email = updates.email
    if (updates.country_code !== undefined) updateData.country_code = updates.country_code
    if (updates.notes !== undefined) updateData.notes = updates.notes

    if (updates.kyc_status === 'verified') {
      updateData.kyc_verified_at = new Date().toISOString()
      updateData.approved_by = user.id
      updateData.approved_at = new Date().toISOString()
      updateData.aml_cleared = true
    }

    const { data, error } = await supabase
      .from('platform_investors')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Auto-authorize if just verified
    if (updates.kyc_status === 'verified') {
      const { data: settings } = await supabase
        .from('platform_settings')
        .select('auto_authorize_tokens')
        .limit(1)
        .single()

      if (settings?.auto_authorize_tokens) {
        const { data: assets } = await supabase
          .from('assets')
          .select('id')
          .eq('is_active', true)

        if (assets && assets.length > 0) {
          for (const a of assets) {
            await supabase
              .from('platform_authorizations')
              .upsert(
                { investor_id: id, asset_id: a.id, status: 'pending' },
                { onConflict: 'investor_id,asset_id' }
              )
          }
        }
      }
    }

    return NextResponse.json({ investor: data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
