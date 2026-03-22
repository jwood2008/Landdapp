import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { TopBar } from '@/components/layout/topbar'
import { BottomNav } from '@/components/layout/bottom-nav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
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

  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <div className="flex h-screen bg-background">
      <Sidebar userRole="admin" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar user={{ email: user.email!, fullName: profile?.full_name }} userRole="admin" />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 pb-20 lg:pb-8">{children}</main>
      </div>
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
