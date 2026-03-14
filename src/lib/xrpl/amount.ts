/**
 * Builds the correct XRPL Amount field for different currencies.
 *
 * - XRP: string of drops (1 XRP = 1,000,000 drops)
 * - RLUSD: IOU issued by Ripple
 * - Other tokens (WOD, etc.): IOU issued by the asset's issuer wallet
 */

// RLUSD is represented as a 40-char hex currency code on XRPL
const RLUSD_HEX = '524C555344000000000000000000000000000000'
const RLUSD_ISSUER = 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De'

export type XrplAmountIOU = {
  currency: string
  value: string
  issuer: string
}

export type XrplAmount = string | XrplAmountIOU

export function buildPaymentAmount(
  currency: string,
  value: string,
  issuerAddress: string
): XrplAmount {
  if (currency === 'XRP') {
    // Convert XRP to drops
    const drops = Math.floor(parseFloat(value) * 1_000_000)
    return String(drops)
  }

  if (currency === 'RLUSD') {
    return {
      currency: RLUSD_HEX,
      value,
      issuer: RLUSD_ISSUER,
    }
  }

  // App-issued tokens (WOD, etc.)
  return {
    currency,
    value,
    issuer: issuerAddress,
  }
}

/**
 * Returns a human-readable label for the currency being sent.
 */
export function currencyLabel(currency: string): string {
  if (currency === 'XRP') return 'XRP'
  if (currency === 'RLUSD') return 'RLUSD'
  return currency
}
