import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LeaseCard } from '@/components/tenant/lease-card'
import { Home } from 'lucide-react'

export default async function LeasesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: leases } = await supabase
    .from('asset_leases')
    .select('*, assets(asset_name, location)')
    .eq('tenant_user_id', user.id)
    .order('created_at', { ascending: false })

  const leaseData = (leases ?? []).map((l) => {
    const asset = (l as Record<string, unknown>).assets as { asset_name: string; location: string | null } | null
    return {
      ...l,
      monthly_rent: Number(l.monthly_rent),
      security_deposit: Number(l.security_deposit ?? 0),
      escalation_rate: Number(l.escalation_rate ?? 0),
      asset: {
        asset_name: asset?.asset_name ?? 'Unknown Property',
        location: asset?.location ?? null,
      },
    }
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Leases</h1>
        <p className="text-base text-muted-foreground mt-1">
          View your current and past lease agreements
        </p>
      </div>

      {leaseData.length === 0 ? (
        <div className="py-24 text-center">
          <Home className="mx-auto h-16 w-16 text-muted-foreground/20 mb-4" />
          <h2 className="text-lg font-semibold mb-1">No Leases</h2>
          <p className="text-sm text-muted-foreground">
            You don&apos;t have any lease agreements yet. Your property manager will add you when your lease is set up.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {leaseData.map((lease) => (
            <LeaseCard key={lease.id} lease={lease} />
          ))}
        </div>
      )}
    </div>
  )
}
