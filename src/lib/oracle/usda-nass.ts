/**
 * USDA NASS QuickStats API — county-level farmland values and cash rents.
 * Free API key required: https://quickstats.nass.usda.gov/api
 */

const NASS_BASE_URL = 'https://quickstats.nass.usda.gov/api/api_GET/'
const API_KEY = process.env.USDA_NASS_API_KEY

export interface NassLandValue {
  state: string
  county: string
  year: number
  croplandValuePerAcre: number | null
  pastureValuePerAcre: number | null
  allLandValuePerAcre: number | null
  cashRentCropland: number | null
  cashRentPasture: number | null
}

interface NassApiRow {
  state_name: string
  county_name: string
  year: string
  short_desc: string
  Value: string
}

/**
 * Fetch county-level land values from USDA NASS.
 * Returns the most recent available data (usually 1-2 years old).
 */
export async function fetchCountyLandValues(
  state: string,
  county: string
): Promise<NassLandValue | null> {
  if (!API_KEY) {
    console.warn('[usda-nass] USDA_NASS_API_KEY not configured')
    return null
  }

  const currentYear = new Date().getFullYear()
  // NASS data is typically 1-2 years behind
  const years = [currentYear - 1, currentYear - 2, currentYear]

  const params = new URLSearchParams({
    key: API_KEY,
    source_desc: 'SURVEY',
    sector_desc: 'ECONOMICS',
    group_desc: 'LAND',
    state_name: state.toUpperCase(),
    county_name: county.toUpperCase(),
    year: years.join(','),
    format: 'JSON',
  })

  try {
    const res = await fetch(`${NASS_BASE_URL}?${params}`, {
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      console.error(`[usda-nass] API returned ${res.status}`)
      return null
    }

    const data = await res.json()
    const rows = (data?.data ?? []) as NassApiRow[]

    if (rows.length === 0) return null

    // Parse values from API response
    const result: NassLandValue = {
      state: state.toUpperCase(),
      county: county.toUpperCase(),
      year: 0,
      croplandValuePerAcre: null,
      pastureValuePerAcre: null,
      allLandValuePerAcre: null,
      cashRentCropland: null,
      cashRentPasture: null,
    }

    for (const row of rows) {
      const val = parseFloat(row.Value?.replace(/,/g, ''))
      if (isNaN(val)) continue

      const yr = parseInt(row.year)
      if (yr > result.year) result.year = yr

      const desc = row.short_desc.toUpperCase()

      if (desc.includes('CROPLAND') && desc.includes('VALUE')) {
        result.croplandValuePerAcre = val
      } else if (desc.includes('PASTURELAND') && desc.includes('VALUE')) {
        result.pastureValuePerAcre = val
      } else if (desc.includes('AG LAND') && desc.includes('VALUE')) {
        result.allLandValuePerAcre = val
      } else if (desc.includes('CROPLAND') && desc.includes('RENT')) {
        result.cashRentCropland = val
      } else if (desc.includes('PASTURELAND') && desc.includes('RENT')) {
        result.cashRentPasture = val
      }
    }

    if (result.year === 0) return null

    return result
  } catch (err) {
    console.error('[usda-nass] Fetch error:', err)
    return null
  }
}

/**
 * Compare an asset's stated value per acre against USDA county data.
 */
export function compareLandValue(
  statedPerAcre: number,
  nassPerAcre: number
): { deviationPercent: number; status: 'below' | 'at_market' | 'above' | 'significantly_above' } {
  const deviation = ((statedPerAcre - nassPerAcre) / nassPerAcre) * 100

  let status: 'below' | 'at_market' | 'above' | 'significantly_above'
  if (deviation < -5) status = 'below'
  else if (deviation <= 15) status = 'at_market'
  else if (deviation <= 30) status = 'above'
  else status = 'significantly_above'

  return { deviationPercent: Math.round(deviation * 10) / 10, status }
}
