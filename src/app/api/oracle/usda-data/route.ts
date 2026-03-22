import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { fetchCountyLandValues } from '@/lib/oracle/usda-nass'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error

  const url = new URL(req.url)
  const state = url.searchParams.get('state')
  const county = url.searchParams.get('county')

  if (!state || !county) {
    return NextResponse.json({ error: 'state and county are required' }, { status: 400 })
  }

  const svc = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check cache (data updates annually — 30-day cache is fine)
  const currentYear = new Date().getFullYear()
  const { data: cached } = await svc
    .from('usda_land_values')
    .select('*')
    .eq('state', state.toUpperCase())
    .eq('county', county.toUpperCase())
    .gte('year', currentYear - 2)
    .order('year', { ascending: false })
    .limit(1)
    .single()

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime()
    if (age < 30 * 24 * 60 * 60 * 1000) { // 30 days
      return NextResponse.json({
        data: {
          state: cached.state,
          county: cached.county,
          year: cached.year,
          croplandValuePerAcre: cached.cropland_value_per_acre,
          pastureValuePerAcre: cached.pastureland_value_per_acre,
          allLandValuePerAcre: cached.all_land_value_per_acre,
          cashRentCropland: cached.cash_rent_cropland,
          cashRentPasture: cached.cash_rent_pasture,
        },
        cached: true,
      })
    }
  }

  // Fetch fresh data
  const nassData = await fetchCountyLandValues(state, county)

  if (!nassData) {
    return NextResponse.json({ data: null, error: 'No USDA data available for this location' })
  }

  // Cache it
  await svc.from('usda_land_values').upsert({
    state: nassData.state,
    county: nassData.county,
    year: nassData.year,
    cropland_value_per_acre: nassData.croplandValuePerAcre,
    pastureland_value_per_acre: nassData.pastureValuePerAcre,
    all_land_value_per_acre: nassData.allLandValuePerAcre,
    cash_rent_cropland: nassData.cashRentCropland,
    cash_rent_pasture: nassData.cashRentPasture,
    fetched_at: new Date().toISOString(),
  }, { onConflict: 'state,county,year' })

  return NextResponse.json({ data: nassData, cached: false })
}
