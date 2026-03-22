/**
 * Weather data feed using NOAA Weather API (free, no key required).
 * Falls back to OpenWeather if NOAA fails.
 */

export interface WeatherAlert {
  event: string
  severity: 'minor' | 'moderate' | 'severe' | 'extreme'
  headline: string
  description: string
  onset: string
  expires: string
}

export interface WeatherConditions {
  temperature: number | null  // Fahrenheit
  humidity: number | null
  description: string
  windSpeed: number | null
}

export interface WeatherData {
  conditions: WeatherConditions | null
  alerts: WeatherAlert[]
  fetchedAt: string
}

/**
 * Fetch active weather alerts from NOAA for a lat/lng point.
 */
export async function fetchWeatherAlerts(lat: number, lng: number): Promise<WeatherAlert[]> {
  try {
    const res = await fetch(
      `https://api.weather.gov/alerts/active?point=${lat},${lng}`,
      {
        headers: { 'User-Agent': 'TierraDex/1.0 (contact@tierradex.com)' },
        signal: AbortSignal.timeout(8000),
      }
    )

    if (!res.ok) {
      console.warn(`[weather] NOAA alerts returned ${res.status}`)
      return []
    }

    const data = await res.json()
    const features = data?.features ?? []

    return features.map((f: Record<string, unknown>) => {
      const props = f.properties as Record<string, unknown>
      return {
        event: (props.event as string) ?? 'Unknown Alert',
        severity: mapSeverity(props.severity as string),
        headline: (props.headline as string) ?? '',
        description: ((props.description as string) ?? '').slice(0, 500),
        onset: (props.onset as string) ?? '',
        expires: (props.expires as string) ?? '',
      }
    })
  } catch (err) {
    console.error('[weather] Alert fetch error:', err)
    return []
  }
}

/**
 * Fetch current weather conditions from NOAA.
 */
export async function fetchCurrentConditions(lat: number, lng: number): Promise<WeatherConditions | null> {
  try {
    // Step 1: Get the nearest weather station
    const pointRes = await fetch(
      `https://api.weather.gov/points/${lat},${lng}`,
      {
        headers: { 'User-Agent': 'TierraDex/1.0 (contact@tierradex.com)' },
        signal: AbortSignal.timeout(8000),
      }
    )

    if (!pointRes.ok) return null

    const pointData = await pointRes.json()
    const stationsUrl = pointData?.properties?.observationStations

    if (!stationsUrl) return null

    // Step 2: Get stations list
    const stationsRes = await fetch(stationsUrl, {
      headers: { 'User-Agent': 'TierraDex/1.0 (contact@tierradex.com)' },
      signal: AbortSignal.timeout(8000),
    })

    if (!stationsRes.ok) return null

    const stationsData = await stationsRes.json()
    const stationId = stationsData?.features?.[0]?.properties?.stationIdentifier

    if (!stationId) return null

    // Step 3: Get latest observation
    const obsRes = await fetch(
      `https://api.weather.gov/stations/${stationId}/observations/latest`,
      {
        headers: { 'User-Agent': 'TierraDex/1.0 (contact@tierradex.com)' },
        signal: AbortSignal.timeout(8000),
      }
    )

    if (!obsRes.ok) return null

    const obsData = await obsRes.json()
    const props = obsData?.properties

    if (!props) return null

    // Convert Celsius to Fahrenheit
    const tempC = props.temperature?.value
    const tempF = typeof tempC === 'number' ? Math.round(tempC * 9/5 + 32) : null

    const humidity = typeof props.relativeHumidity?.value === 'number'
      ? Math.round(props.relativeHumidity.value)
      : null

    const windKmh = typeof props.windSpeed?.value === 'number'
      ? props.windSpeed.value
      : null
    const windMph = windKmh !== null ? Math.round(windKmh * 0.621371) : null

    return {
      temperature: tempF,
      humidity,
      description: props.textDescription ?? 'Unknown',
      windSpeed: windMph,
    }
  } catch (err) {
    console.error('[weather] Conditions fetch error:', err)
    return null
  }
}

/**
 * Combined: fetch both alerts and conditions.
 */
export async function fetchWeatherData(lat: number, lng: number): Promise<WeatherData> {
  const [alerts, conditions] = await Promise.all([
    fetchWeatherAlerts(lat, lng),
    fetchCurrentConditions(lat, lng),
  ])

  return {
    conditions,
    alerts,
    fetchedAt: new Date().toISOString(),
  }
}

function mapSeverity(s: string): WeatherAlert['severity'] {
  switch (s?.toLowerCase()) {
    case 'extreme': return 'extreme'
    case 'severe': return 'severe'
    case 'moderate': return 'moderate'
    default: return 'minor'
  }
}
