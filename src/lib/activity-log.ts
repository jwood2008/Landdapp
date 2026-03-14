import { createClient } from '@/lib/supabase/client'

type ActivityAction =
  | 'login'
  | 'wallet_connected'
  | 'wallet_removed'
  | 'valuation_updated'
  | 'distribution_created'
  | 'distribution_completed'
  | 'token_issued'
  | 'trustline_approved'
  | 'trustline_rejected'
  | 'require_auth_enabled'
  | 'document_uploaded'
  | 'document_validated'
  | 'asset_created'
  | 'announcement_posted'
  | 'settings_updated'

/**
 * Log a platform activity event to the activity_log table.
 * Fire-and-forget — errors are silently caught.
 */
export function logActivity(
  action: ActivityAction,
  details: Record<string, unknown> = {},
  assetId?: string
) {
  const supabase = createClient()

  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) return

    supabase
      .from('activity_log')
      .insert({
        user_id: user.id,
        asset_id: assetId ?? null,
        action,
        details,
      })
      .then(() => {})
  })
}
