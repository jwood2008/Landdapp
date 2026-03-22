import { NextResponse } from 'next/server'
import { requireIssuer } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/oracle/config?assetId=...
 * Returns oracle config for a specific asset (issuer must own the asset).
 *
 * PUT /api/oracle/config
 * Updates oracle config for an asset.
 * Body: { assetId, oracleMethod, oracleConfig }
 */

export async function GET(req: Request) {
  const auth = await requireIssuer()
  if ('error' in auth && auth.error) return auth.error
  const { user } = auth

  const { searchParams } = new URL(req.url)
  const assetId = searchParams.get('assetId')
  if (!assetId) return NextResponse.json({ error: 'assetId required' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: asset, error } = await supabase
    .from('assets')
    .select('id, asset_name, oracle_method, oracle_config, owner_id')
    .eq('id', assetId)
    .single()

  if (error || !asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  }

  // Issuers can only view their own assets (admins can view all)
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && asset.owner_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized for this asset' }, { status: 403 })
  }

  return NextResponse.json({
    assetId: asset.id,
    assetName: asset.asset_name,
    oracleMethod: asset.oracle_method ?? 'manual',
    oracleConfig: asset.oracle_config ?? {
      operator_wallets: [],
      auto_distribute: false,
      confidence_threshold: 90,
    },
  })
}

export async function PUT(req: Request) {
  const auth = await requireIssuer()
  if ('error' in auth && auth.error) return auth.error
  const { user } = auth

  const { assetId, oracleMethod, oracleConfig } = await req.json()
  if (!assetId) return NextResponse.json({ error: 'assetId required' }, { status: 400 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verify ownership
  const { data: asset } = await supabase
    .from('assets')
    .select('id, owner_id')
    .eq('id', assetId)
    .single()

  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && asset.owner_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized for this asset' }, { status: 403 })
  }

  // Validate oracle config
  if (oracleConfig) {
    if (oracleConfig.operator_wallets) {
      // Validate XRPL addresses (start with 'r', 25-35 chars)
      for (const wallet of oracleConfig.operator_wallets) {
        if (typeof wallet !== 'string' || !wallet.startsWith('r') || wallet.length < 25) {
          return NextResponse.json(
            { error: `Invalid XRPL address: ${wallet}` },
            { status: 400 }
          )
        }
      }
    }

    if (oracleConfig.confidence_threshold !== undefined) {
      const threshold = Number(oracleConfig.confidence_threshold)
      if (isNaN(threshold) || threshold < 0 || threshold > 100) {
        return NextResponse.json(
          { error: 'confidence_threshold must be between 0 and 100' },
          { status: 400 }
        )
      }
    }
  }

  // Merge with existing config to preserve last_checked_ledger etc.
  const existingConfig = (asset as Record<string, unknown>).oracle_config ?? {}
  const mergedConfig = { ...existingConfig, ...oracleConfig }

  const { error: updateErr } = await supabase
    .from('assets')
    .update({
      oracle_method: oracleMethod ?? 'lease_income',
      oracle_config: mergedConfig,
    })
    .eq('id', assetId)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, oracleMethod, oracleConfig: mergedConfig })
}
