/**
 * AI Validation Layer — compares detected payments against lease contracts.
 *
 * For each unvalidated operator_payment:
 * 1. Fetches the asset's active contract (annual_amount, frequency, escalation)
 * 2. Calculates expected payment amount for this period
 * 3. Compares actual vs expected and assigns a confidence score
 * 4. If confidence >= threshold → auto_approved, else → requires_review
 * 5. Stores the validation record
 */
import { SupabaseClient } from '@supabase/supabase-js'

interface OperatorPayment {
  id: string
  asset_id: string
  tx_hash: string
  sender_address: string
  amount: number
  currency: string
  tx_date: string
}

interface AssetContract {
  id: string
  annual_amount: number
  payment_frequency: string
  currency: string
  escalation_rate: number | null
  escalation_type: string | null
  lease_start_date: string | null
}

interface ValidationResult {
  operator_payment_id: string
  asset_id: string
  expected_amount: number
  actual_amount: number
  expected_currency: string
  expected_sender: string | null
  actual_sender: string
  confidence_score: number
  ai_reasoning: string
  auto_approved: boolean
  requires_review: boolean
}

/**
 * Calculate the expected payment amount for the current period.
 */
function calculateExpectedAmount(contract: AssetContract): number {
  const annual = contract.annual_amount
  let periodsPerYear = 1

  switch (contract.payment_frequency) {
    case 'monthly': periodsPerYear = 12; break
    case 'quarterly': periodsPerYear = 4; break
    case 'semi_annual': periodsPerYear = 2; break
    case 'annual': periodsPerYear = 1; break
  }

  let periodAmount = annual / periodsPerYear

  // Apply escalation
  if (contract.escalation_rate && contract.escalation_type === 'annual_percent' && contract.lease_start_date) {
    const startYear = new Date(contract.lease_start_date).getFullYear()
    const currentYear = new Date().getFullYear()
    const yearsElapsed = currentYear - startYear
    if (yearsElapsed > 0) {
      periodAmount = periodAmount * Math.pow(1 + contract.escalation_rate / 100, yearsElapsed)
    }
  }

  return Math.round(periodAmount * 100) / 100
}

/**
 * Score the payment against contract expectations.
 * Returns 0-100 confidence score and reasoning.
 */
function scorePayment(
  payment: OperatorPayment,
  contract: AssetContract,
  operatorWallets: string[]
): { score: number; reasoning: string } {
  const expectedAmount = calculateExpectedAmount(contract)
  const reasons: string[] = []
  let score = 100

  // 1. Amount match (most important — up to 50 points deducted)
  const amountDiff = Math.abs(payment.amount - expectedAmount)
  const amountPctDiff = expectedAmount > 0 ? (amountDiff / expectedAmount) * 100 : 100

  if (amountPctDiff === 0) {
    reasons.push(`Amount matches exactly: $${payment.amount} = expected $${expectedAmount}`)
  } else if (amountPctDiff <= 1) {
    score -= 2
    reasons.push(`Amount within 1% of expected: $${payment.amount} vs $${expectedAmount} (${amountPctDiff.toFixed(1)}% diff)`)
  } else if (amountPctDiff <= 5) {
    score -= 10
    reasons.push(`Amount within 5% of expected: $${payment.amount} vs $${expectedAmount} (${amountPctDiff.toFixed(1)}% diff)`)
  } else if (amountPctDiff <= 15) {
    score -= 25
    reasons.push(`Amount deviates ${amountPctDiff.toFixed(1)}% from expected: $${payment.amount} vs $${expectedAmount}`)
  } else {
    score -= 50
    reasons.push(`Significant amount deviation: $${payment.amount} vs expected $${expectedAmount} (${amountPctDiff.toFixed(1)}% diff)`)
  }

  // 2. Currency match (20 points)
  const expectedCurrency = contract.currency ?? 'USD'
  if (payment.currency.toUpperCase() === expectedCurrency.toUpperCase() ||
      (expectedCurrency === 'USD' && payment.currency === 'RLUSD')) {
    reasons.push(`Currency matches: ${payment.currency}`)
  } else {
    score -= 20
    reasons.push(`Currency mismatch: received ${payment.currency}, expected ${expectedCurrency}`)
  }

  // 3. Sender verification (20 points)
  const senderMatch = operatorWallets.some(
    (w) => w.toLowerCase() === payment.sender_address.toLowerCase()
  )
  if (senderMatch) {
    reasons.push(`Sender ${payment.sender_address.slice(0, 8)}... is a registered operator wallet`)
  } else {
    score -= 20
    reasons.push(`Sender ${payment.sender_address.slice(0, 8)}... is NOT a registered operator wallet`)
  }

  // 4. Timing check (10 points) — is the payment near an expected payment date?
  const paymentDate = new Date(payment.tx_date)
  const dayOfMonth = paymentDate.getDate()
  const monthOfYear = paymentDate.getMonth()

  // Most lease payments happen in the first 5 days of a period
  if (contract.payment_frequency === 'monthly' && dayOfMonth <= 5) {
    reasons.push('Payment timing consistent with monthly schedule (early in month)')
  } else if (contract.payment_frequency === 'quarterly' && monthOfYear % 3 === 0 && dayOfMonth <= 10) {
    reasons.push('Payment timing consistent with quarterly schedule')
  } else {
    score -= 5
    reasons.push(`Payment on day ${dayOfMonth} of month — timing is acceptable but not on typical schedule`)
  }

  return { score: Math.max(0, score), reasoning: reasons.join('. ') + '.' }
}

/**
 * Validate all unvalidated operator payments.
 * Returns the number of payments validated and auto-approved.
 */
export async function validatePayments(
  supabase: SupabaseClient
): Promise<{ validated: number; autoApproved: number; flagged: number }> {
  // Fetch unvalidated (detected) payments
  const { data: payments, error: payErr } = await supabase
    .from('operator_payments')
    .select('id, asset_id, tx_hash, sender_address, amount, currency, tx_date')
    .eq('status', 'detected')
    .limit(50)

  if (payErr) throw new Error(`Failed to fetch payments: ${payErr.message}`)
  if (!payments || payments.length === 0) return { validated: 0, autoApproved: 0, flagged: 0 }

  // Group by asset to batch-load contracts and configs
  const assetIds = [...new Set(payments.map((p) => p.asset_id))]

  const { data: assets } = await supabase
    .from('assets')
    .select('id, oracle_config')
    .in('id', assetIds)

  const assetConfigMap = new Map(
    (assets ?? []).map((a) => [a.id, a.oracle_config as { operator_wallets: string[]; confidence_threshold: number }])
  )

  const { data: contracts } = await supabase
    .from('asset_contracts')
    .select('id, asset_id, annual_amount, payment_frequency, currency, escalation_rate, escalation_type, lease_start_date')
    .in('asset_id', assetIds)
    .eq('is_active', true)

  const contractMap = new Map(
    (contracts ?? []).map((c) => [c.asset_id, c as unknown as AssetContract])
  )

  let validated = 0
  let autoApproved = 0
  let flagged = 0

  for (const payment of payments) {
    const config = assetConfigMap.get(payment.asset_id)
    const contract = contractMap.get(payment.asset_id)

    if (!contract) {
      // No active contract — flag it
      await supabase
        .from('operator_payments')
        .update({ status: 'flagged', flagged_reason: 'No active contract found for this asset' })
        .eq('id', payment.id)
      flagged++
      continue
    }

    const operatorWallets = config?.operator_wallets ?? []
    const threshold = config?.confidence_threshold ?? 90
    const expectedAmount = calculateExpectedAmount(contract)
    const { score, reasoning } = scorePayment(payment, contract, operatorWallets)

    const isAutoApproved = score >= threshold

    const validation: ValidationResult = {
      operator_payment_id: payment.id,
      asset_id: payment.asset_id,
      expected_amount: expectedAmount,
      actual_amount: payment.amount,
      expected_currency: contract.currency ?? 'USD',
      expected_sender: operatorWallets[0] ?? null,
      actual_sender: payment.sender_address,
      confidence_score: score,
      ai_reasoning: reasoning,
      auto_approved: isAutoApproved,
      requires_review: !isAutoApproved,
    }

    // Insert validation record
    await supabase.from('oracle_validations').insert(validation)

    // Update payment status and match info
    await supabase
      .from('operator_payments')
      .update({
        status: isAutoApproved ? 'validated' : 'flagged',
        matched: true,
        matched_contract_id: contract.id,
        match_confidence: score,
        match_notes: reasoning,
        flagged_reason: isAutoApproved ? null : `Confidence ${score}% below threshold ${threshold}%`,
      })
      .eq('id', payment.id)

    validated++
    if (isAutoApproved) autoApproved++
    else flagged++
  }

  return { validated, autoApproved, flagged }
}
