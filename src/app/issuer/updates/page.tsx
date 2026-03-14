import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { IssuerUpdatesManager } from '@/components/issuer/issuer-updates-manager'

export default async function IssuerUpdatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: assets } = await supabase
    .from('assets')
    .select('id, asset_name, token_symbol')
    .eq('owner_id', user.id)
    .eq('is_active', true)

  const { data: updates } = await supabase
    .from('issuer_updates')
    .select('*')
    .eq('issuer_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <IssuerUpdatesManager
      assets={(assets ?? []) as Array<{ id: string; asset_name: string; token_symbol: string }>}
      updates={(updates ?? []) as Array<{
        id: string; asset_id: string; title: string; content: string;
        quarter: string; ai_analysis: string | null; ai_rating: number | null;
        ai_sentiment: string | null; published: boolean; created_at: string
      }>}
      issuerId={user.id}
    />
  )
}
