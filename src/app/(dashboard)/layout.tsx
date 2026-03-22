import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { TopBar } from '@/components/layout/topbar'
import { BottomNav } from '@/components/layout/bottom-nav'
import { ChatWidget } from '@/components/chat/chat-widget'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'investor'
  const userData = { email: user.email!, fullName: profile?.full_name }

  // Check if user has active leases (tenant)
  const { count: leaseCount } = await supabase
    .from('asset_leases')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_user_id', user.id)
    .eq('status', 'active')

  const isTenant = (leaseCount ?? 0) > 0

  return (
    <div className="flex h-screen bg-background">
      <Sidebar userRole={role} isTenant={isTenant} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar user={userData} userRole={role} />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 pb-20 lg:pb-8">{children}</main>
      </div>
      <div className="lg:hidden">
        <BottomNav isTenant={isTenant} />
      </div>
      <ChatWidget />
    </div>
  )
}
