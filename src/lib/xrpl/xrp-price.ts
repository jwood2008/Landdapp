/**
 * Fetches the current XRP/USD price from public APIs.
 * Used to convert USD-denominated prices to XRP amounts.
 *
 * Falls back through multiple sources for reliability.
 */

let cachedPrice: { usd: number; fetchedAt: number } | null = null
const CACHE_TTL_MS = 30_000 // 30 seconds

export async function getXrpUsdPrice(): Promise<number> {
  // Return cached price if fresh
  if (cachedPrice && Date.now() - cachedPrice.fetchedAt < CACHE_TTL_MS) {
    return cachedPrice.usd
  }

  // Race both APIs in parallel — use whichever responds first with a valid price
  const fetchCoinGecko = async (): Promise<number> => {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd',
      { signal: AbortSignal.timeout(3000) }
    )
    if (!res.ok) throw new Error('CoinGecko not ok')
    const data = await res.json()
    const price = data?.ripple?.usd
    if (typeof price !== 'number' || price <= 0) throw new Error('Invalid price')
    return price
  }

  const fetchCryptoCompare = async (): Promise<number> => {
    const res = await fetch(
      'https://min-api.cryptocompare.com/data/price?fsym=XRP&tsyms=USD',
      { signal: AbortSignal.timeout(3000) }
    )
    if (!res.ok) throw new Error('CryptoCompare not ok')
    const data = await res.json()
    const price = data?.USD
    if (typeof price !== 'number' || price <= 0) throw new Error('Invalid price')
    return price
  }

  try {
    // Race: first valid response wins
    const price = await Promise.any([fetchCoinGecko(), fetchCryptoCompare()])
    cachedPrice = { usd: price, fetchedAt: Date.now() }
    return price
  } catch {
    // All sources failed
  }

  // If we have a stale cached price, use it rather than failing
  if (cachedPrice) {
    console.warn('[xrp-price] Using stale cached price:', cachedPrice.usd)
    return cachedPrice.usd
  }

  throw new Error('Unable to fetch XRP/USD price from any source')
}

/**
 * Converts a USD amount to XRP.
 * Example: $10 at XRP=$2.50 → 4 XRP
 */
export function usdToXrp(usdAmount: number, xrpUsdPrice: number): number {
  if (xrpUsdPrice <= 0) throw new Error('Invalid XRP price')
  return usdAmount / xrpUsdPrice
}
