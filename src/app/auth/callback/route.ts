import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCustodialWallet } from '@/lib/xrpl/wallet-manager'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Get user profile to determine redirect
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()

        // Auto-create custodial wallet for investors (fire and forget)
        if (profile?.role === 'investor') {
          createCustodialWallet(user.id).catch((err) =>
            console.error('[auth/callback] Auto-wallet creation failed:', err)
          )
        }

        if (profile?.role === 'issuer') {
          return NextResponse.redirect(`${origin}/issuer`)
        }
        if (profile?.role === 'admin') {
          return NextResponse.redirect(`${origin}/admin`)
        }
      }
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
