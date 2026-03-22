import { createClient } from '@/lib/supabase/server'
import {
  sendTradeConfirmation,
  sendOrderFilled,
  sendDistributionReceived,
  sendAccountApproved,
  sendAccountRejected,
} from '@/lib/email'

/**
 * High-level notification helpers that check user preferences
 * before sending emails. Fire-and-forget — errors are logged, not thrown.
 */

async function getEmailForUser(userId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single()
  return data?.email ?? null
}

async function getEmailForInvestor(investorId: string): Promise<{ email: string | null; userId: string | null }> {
  const supabase = await createClient()
  const { data: investor } = await supabase
    .from('platform_investors')
    .select('user_id, email')
    .eq('id', investorId)
    .single()

  if (!investor) return { email: null, userId: null }

  // Prefer user table email, fall back to investor record email
  if (investor.user_id) {
    const email = await getEmailForUser(investor.user_id)
    if (email) return { email, userId: investor.user_id }
  }

  return { email: investor.email ?? null, userId: investor.user_id }
}

async function shouldNotify(userId: string, type: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notification_preferences')
    .select(type)
    .eq('user_id', userId)
    .single()

  // Default to true if no preferences set
  if (!data) return true
  return (data as unknown as Record<string, boolean>)[type] !== false
}

// ── Public notification helpers ──

export async function notifyTradeConfirmation(
  investorId: string,
  tradeData: {
    side: 'buy' | 'sell'
    assetName: string
    tokenSymbol: string
    tokenAmount: number
    pricePerToken: number
    totalPrice: number
    currency: string
  }
) {
  try {
    const { email, userId } = await getEmailForInvestor(investorId)
    if (!email || !userId) return

    const allowed = await shouldNotify(userId, 'trade_confirmations')
    if (!allowed) return

    await sendTradeConfirmation(email, tradeData)
  } catch (err) {
    console.error('[notify] Trade confirmation error:', err)
  }
}

export async function notifyOrderFilled(
  investorId: string,
  orderData: {
    side: 'buy' | 'sell'
    assetName: string
    tokenSymbol: string
    tokenAmount: number
    pricePerToken: number
    status: 'filled' | 'partial'
    filledAmount: number
  }
) {
  try {
    const { email, userId } = await getEmailForInvestor(investorId)
    if (!email || !userId) return

    const allowed = await shouldNotify(userId, 'order_updates')
    if (!allowed) return

    await sendOrderFilled(email, orderData)
  } catch (err) {
    console.error('[notify] Order filled error:', err)
  }
}

export async function notifyDistributionReceived(
  walletAddress: string,
  distData: {
    assetName: string
    tokenSymbol: string
    amount: number
    currency: string
    period: string | null
  }
) {
  try {
    const supabase = await createClient()
    const { data: investor } = await supabase
      .from('platform_investors')
      .select('user_id, email')
      .eq('wallet_address', walletAddress)
      .single()

    if (!investor) return

    const email = investor.user_id
      ? (await getEmailForUser(investor.user_id)) ?? investor.email
      : investor.email

    if (!email) return

    if (investor.user_id) {
      const allowed = await shouldNotify(investor.user_id, 'distribution_alerts')
      if (!allowed) return
    }

    await sendDistributionReceived(email, distData)
  } catch (err) {
    console.error('[notify] Distribution received error:', err)
  }
}

export async function notifyAccountStatus(userId: string, action: 'approve' | 'reject') {
  try {
    const email = await getEmailForUser(userId)
    if (!email) return

    if (action === 'approve') {
      await sendAccountApproved(email)
    } else {
      await sendAccountRejected(email)
    }
  } catch (err) {
    console.error('[notify] Account status error:', err)
  }
}
