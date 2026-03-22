import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { fetchWeatherData } from '@/lib/oracle/weather'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if ('error' in auth && auth.error) return auth.error
  const { supabase } = auth

  const url = new URL(req.url)
  const assetId = url.searchParams.get('assetId')
  const lat = url.searchParams.get('lat')
  const lng = url.searchParams.get('lng')

  let latitude: number
  let longitude: number

  if (assetId) {
    // Look up coordinates from asset
    const { data: asset } = await supabase
      .from('assets')
      .select('latitude, longitude')
      .eq('id', assetId)
      .single()

    if (!asset?.latitude || !asset?.longitude) {
      return NextResponse.json({ error: 'Asset does not have coordinates set' }, { status: 400 })
    }
    latitude = Number(asset.latitude)
    longitude = Number(asset.longitude)
  } else if (lat && lng) {
    latitude = parseFloat(lat)
    longitude = parseFloat(lng)
    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
    }
  } else {
    return NextResponse.json({ error: 'assetId or lat/lng required' }, { status: 400 })
  }

  // Check cache (1 hour TTL)
  if (assetId) {
    const svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: cached } = await svc
      .from('weather_alerts_cache')
      .select('*')
      .eq('asset_id', assetId)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single()

    if (cached) {
      const age = Date.now() - new Date(cached.fetched_at).getTime()
      if (age < 60 * 60 * 1000) { // 1 hour
        return NextResponse.json({
          alerts: cached.alerts,
          conditions: cached.conditions,
          fetchedAt: cached.fetched_at,
          cached: true,
        })
      }
    }
  }

  // Fetch fresh data
  const weatherData = await fetchWeatherData(latitude, longitude)

  // Cache if we have an assetId
  if (assetId) {
    const svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Delete old cache entries for this asset
    await svc.from('weather_alerts_cache').delete().eq('asset_id', assetId)

    await svc.from('weather_alerts_cache').insert({
      asset_id: assetId,
      alerts: weatherData.alerts,
      conditions: weatherData.conditions,
      fetched_at: weatherData.fetchedAt,
    })
  }

  return NextResponse.json({
    ...weatherData,
    cached: false,
  })
}
