import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY || 'placeholder')

const FROM_EMAIL = process.env.EMAIL_FROM ?? 'TierraDex <notifications@updates.rwaplatform.com>'
const PLATFORM_NAME = 'TierraDex'

// ── Email template wrapper ──

function layout(title: string, body: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 520px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .logo { font-size: 18px; font-weight: 700; color: #18181b; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 600; color: #18181b; margin: 0 0 8px; }
    p { font-size: 14px; line-height: 1.6; color: #52525b; margin: 0 0 16px; }
    .highlight { background: #f4f4f5; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .highlight-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
    .highlight-label { color: #71717a; }
    .highlight-value { color: #18181b; font-weight: 600; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge-green { background: #dcfce7; color: #166534; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-amber { background: #fef3c7; color: #92400e; }
    .btn { display: inline-block; padding: 10px 24px; background: #18181b; color: #fff !important; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 600; margin-top: 8px; }
    .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #a1a1aa; }
    .mono { font-family: 'SF Mono', Monaco, monospace; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">${PLATFORM_NAME}</div>
      ${body}
    </div>
    <div class="footer">
      <p>You're receiving this because you have an account on ${PLATFORM_NAME}.<br/>
      Manage your notification preferences in Settings.</p>
    </div>
  </div>
</body>
</html>`
}

// ── Email types ──

export type EmailType =
  | 'trade_confirmation'
  | 'order_filled'
  | 'distribution_received'
  | 'account_approved'
  | 'account_rejected'
  | 'tenant_assigned'
  | 'rent_payment_confirmation'
  | 'rent_due_reminder'

// ── Email builders ──

interface TradeConfirmationData {
  side: 'buy' | 'sell'
  assetName: string
  tokenSymbol: string
  tokenAmount: number
  pricePerToken: number
  totalPrice: number
  currency: string
}

interface OrderFilledData {
  side: 'buy' | 'sell'
  assetName: string
  tokenSymbol: string
  tokenAmount: number
  pricePerToken: number
  status: 'filled' | 'partial'
  filledAmount: number
}

interface DistributionReceivedData {
  assetName: string
  tokenSymbol: string
  amount: number
  currency: string
  period: string | null
}

// ── Send functions ──

export async function sendTradeConfirmation(to: string, data: TradeConfirmationData) {
  const isBuy = data.side === 'buy'
  const subject = `${isBuy ? 'Purchase' : 'Sale'} Confirmed — ${data.tokenAmount} ${data.tokenSymbol}`
  const total = `$${data.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const html = layout(subject, `
    <h1>${isBuy ? 'Purchase' : 'Sale'} Confirmed</h1>
    <p>Your ${data.side} order for <strong>${data.assetName}</strong> has been executed.</p>
    <div class="highlight">
      <div class="highlight-row">
        <span class="highlight-label">Asset</span>
        <span class="highlight-value">${data.assetName} (${data.tokenSymbol})</span>
      </div>
      <div class="highlight-row">
        <span class="highlight-label">Type</span>
        <span class="highlight-value"><span class="badge ${isBuy ? 'badge-blue' : 'badge-amber'}">${data.side}</span></span>
      </div>
      <div class="highlight-row">
        <span class="highlight-label">Tokens</span>
        <span class="highlight-value">${data.tokenAmount.toLocaleString()}</span>
      </div>
      <div class="highlight-row">
        <span class="highlight-label">Price per Token</span>
        <span class="highlight-value">$${data.pricePerToken.toFixed(2)} ${data.currency}</span>
      </div>
      <div class="highlight-row" style="border-top: 1px solid #e4e4e7; margin-top: 8px; padding-top: 8px;">
        <span class="highlight-label">Total</span>
        <span class="highlight-value" style="font-size: 15px;">${total}</span>
      </div>
    </div>
    <p>View your updated portfolio and transaction history in your dashboard.</p>
    <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/dashboard/transactions" class="btn">View Transactions</a>
  `)

  return sendEmail(to, subject, html, 'trade_confirmation')
}

export async function sendOrderFilled(to: string, data: OrderFilledData) {
  const subject = `Order ${data.status === 'filled' ? 'Filled' : 'Partially Filled'} — ${data.tokenSymbol}`

  const html = layout(subject, `
    <h1>Order ${data.status === 'filled' ? 'Filled' : 'Partially Filled'}</h1>
    <p>Your ${data.side} order for <strong>${data.assetName}</strong> has been ${data.status === 'filled' ? 'fully filled' : 'partially filled'}.</p>
    <div class="highlight">
      <div class="highlight-row">
        <span class="highlight-label">Asset</span>
        <span class="highlight-value">${data.assetName} (${data.tokenSymbol})</span>
      </div>
      <div class="highlight-row">
        <span class="highlight-label">Ordered</span>
        <span class="highlight-value">${data.tokenAmount.toLocaleString()} tokens</span>
      </div>
      <div class="highlight-row">
        <span class="highlight-label">Filled</span>
        <span class="highlight-value">${data.filledAmount.toLocaleString()} tokens</span>
      </div>
      <div class="highlight-row">
        <span class="highlight-label">Status</span>
        <span class="highlight-value"><span class="badge badge-green">${data.status}</span></span>
      </div>
    </div>
    <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/dashboard/transactions" class="btn">View Transactions</a>
  `)

  return sendEmail(to, subject, html, 'order_filled')
}

export async function sendDistributionReceived(to: string, data: DistributionReceivedData) {
  const amount = `$${data.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const subject = `Distribution Received — ${amount} from ${data.tokenSymbol}`

  const html = layout(subject, `
    <h1>Distribution Received</h1>
    <p>You've received a distribution payment from <strong>${data.assetName}</strong>.</p>
    <div class="highlight">
      <div class="highlight-row">
        <span class="highlight-label">Asset</span>
        <span class="highlight-value">${data.assetName} (${data.tokenSymbol})</span>
      </div>
      ${data.period ? `<div class="highlight-row">
        <span class="highlight-label">Period</span>
        <span class="highlight-value">${data.period}</span>
      </div>` : ''}
      <div class="highlight-row" style="border-top: 1px solid #e4e4e7; margin-top: 8px; padding-top: 8px;">
        <span class="highlight-label">Amount</span>
        <span class="highlight-value" style="font-size: 15px; color: #166534;">${amount} ${data.currency}</span>
      </div>
    </div>
    <p>This payment has been deposited to your wallet.</p>
    <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/dashboard/royalties" class="btn">View Royalties</a>
  `)

  return sendEmail(to, subject, html, 'distribution_received')
}

export async function sendAccountApproved(to: string) {
  const subject = `Account Approved — Welcome to ${PLATFORM_NAME}`

  const html = layout(subject, `
    <h1>Your Account is Approved! 🎉</h1>
    <p>Great news — your account has been verified and approved. You now have full access to the platform.</p>
    <div class="highlight">
      <div class="highlight-row">
        <span class="highlight-label">Status</span>
        <span class="highlight-value"><span class="badge badge-green">Approved</span></span>
      </div>
    </div>
    <p>You can now browse the marketplace, purchase tokenized assets, and start building your portfolio.</p>
    <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/dashboard" class="btn">Go to Dashboard</a>
  `)

  return sendEmail(to, subject, html, 'account_approved')
}

export async function sendAccountRejected(to: string) {
  const subject = `Account Update — ${PLATFORM_NAME}`

  const html = layout(subject, `
    <h1>Account Verification Update</h1>
    <p>Unfortunately, we were unable to verify your account at this time. This may be due to incomplete or invalid documentation.</p>
    <p>If you believe this is an error, please contact our support team for assistance.</p>
  `)

  return sendEmail(to, subject, html, 'account_rejected')
}

// ── Tenant emails ──

interface TenantAssignedData {
  propertyName: string
  monthlyRent: number
  dueDay: number
  leaseStartDate: string
}

export async function sendTenantAssigned(to: string, data: TenantAssignedData) {
  const rent = `$${data.monthlyRent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const start = new Date(data.leaseStartDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const ordinal = data.dueDay === 1 ? '1st' : data.dueDay === 2 ? '2nd' : data.dueDay === 3 ? '3rd' : `${data.dueDay}th`
  const subject = `Lease Setup — ${data.propertyName}`

  const html = layout(subject, `
    <h1>You've Been Added as a Tenant</h1>
    <p>Your property manager has set up your lease for <strong>${data.propertyName}</strong>. You can now view your lease details and make rent payments directly from your dashboard.</p>
    <div class="highlight">
      <div class="highlight-row">
        <span class="highlight-label">Property</span>
        <span class="highlight-value">${data.propertyName}</span>
      </div>
      <div class="highlight-row">
        <span class="highlight-label">Monthly Rent</span>
        <span class="highlight-value">${rent}</span>
      </div>
      <div class="highlight-row">
        <span class="highlight-label">Due Date</span>
        <span class="highlight-value">${ordinal} of each month</span>
      </div>
      <div class="highlight-row">
        <span class="highlight-label">Lease Start</span>
        <span class="highlight-value">${start}</span>
      </div>
    </div>
    <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/dashboard/rent" class="btn">View Rent Payments</a>
  `)

  return sendEmail(to, subject, html, 'tenant_assigned')
}

interface RentPaymentConfirmationData {
  propertyName: string
  amount: number
  dueDate: string
  confirmationId: string
}

export async function sendRentPaymentConfirmation(to: string, data: RentPaymentConfirmationData) {
  const amount = `$${data.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const due = new Date(data.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const subject = `Payment Received — ${data.propertyName}`

  const html = layout(subject, `
    <h1>Payment Received</h1>
    <p>Your rent payment for <strong>${data.propertyName}</strong> has been received and confirmed.</p>
    <div class="highlight">
      <div class="highlight-row">
        <span class="highlight-label">Amount</span>
        <span class="highlight-value">${amount}</span>
      </div>
      <div class="highlight-row">
        <span class="highlight-label">Property</span>
        <span class="highlight-value">${data.propertyName}</span>
      </div>
      <div class="highlight-row">
        <span class="highlight-label">Due Date</span>
        <span class="highlight-value">${due}</span>
      </div>
      <div class="highlight-row">
        <span class="highlight-label">Confirmation</span>
        <span class="highlight-value"><span class="badge badge-green">#${data.confirmationId}</span></span>
      </div>
      <div class="highlight-row">
        <span class="highlight-label">Status</span>
        <span class="highlight-value"><span class="badge badge-green">CONFIRMED</span></span>
      </div>
    </div>
    <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/dashboard/rent" class="btn">View Payment History</a>
  `)

  return sendEmail(to, subject, html, 'rent_payment_confirmation')
}

interface RentDueReminderData {
  propertyName: string
  amount: number
  dueDate: string
  daysUntilDue: number
}

export async function sendRentDueReminder(to: string, data: RentDueReminderData) {
  const amount = `$${data.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const due = new Date(data.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const subject = `Rent Due ${data.daysUntilDue === 0 ? 'Today' : `in ${data.daysUntilDue} Day${data.daysUntilDue !== 1 ? 's' : ''}`} — ${data.propertyName}`

  const html = layout(subject, `
    <h1>Rent Payment Reminder</h1>
    <p>Your rent payment for <strong>${data.propertyName}</strong> is ${data.daysUntilDue === 0 ? 'due today' : `due in ${data.daysUntilDue} day${data.daysUntilDue !== 1 ? 's' : ''}`}.</p>
    <div class="highlight">
      <div class="highlight-row">
        <span class="highlight-label">Amount Due</span>
        <span class="highlight-value">${amount}</span>
      </div>
      <div class="highlight-row">
        <span class="highlight-label">Due Date</span>
        <span class="highlight-value">${due}</span>
      </div>
      <div class="highlight-row">
        <span class="highlight-label">Property</span>
        <span class="highlight-value">${data.propertyName}</span>
      </div>
    </div>
    <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/dashboard/rent" class="btn">Pay Now</a>
  `)

  return sendEmail(to, subject, html, 'rent_due_reminder')
}

// ── Core send helper ──

async function sendEmail(to: string, subject: string, html: string, type: EmailType) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error(`[email] Cannot send ${type} — RESEND_API_KEY is not configured`)
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    })

    if (error) {
      console.error(`[email] Failed to send ${type}:`, error)
      return null
    }

    console.log(`[email] Sent ${type} to ${to} (id: ${data?.id})`)
    return data
  } catch (err) {
    console.error(`[email] Error sending ${type}:`, err)
    return null
  }
}
