import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Verify the request is from an authenticated admin user.
 * Returns the user if valid, or a 401/403 NextResponse if not.
 */
export async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  }

  return { user, supabase }
}

/**
 * Verify the request is from an authenticated issuer.
 * Returns the user if valid, or a 401/403 NextResponse if not.
 */
export async function requireIssuer() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'issuer' && profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Issuer access required' }, { status: 403 }) }
  }

  return { user, supabase }
}

/**
 * Verify the request is from any authenticated user.
 * Returns the user if valid, or a 401 NextResponse if not.
 */
export async function requireAuth() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  }

  return { user, supabase }
}
