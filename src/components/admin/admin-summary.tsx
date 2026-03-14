import { Card, CardContent } from '@/components/ui/card'
import { Building2, Users, DollarSign, Activity } from 'lucide-react'

interface AdminSummaryProps {
  assetCount: number
  investorCount: number
  verifiedInvestorCount: number
  distributions: { distributable_amount: number; status: string }[]
}

export function AdminSummary({ assetCount, investorCount, verifiedInvestorCount, distributions }: AdminSummaryProps) {
  const totalDistributed = distributions
    .filter((d) => d.status === 'completed')
    .reduce((sum, d) => sum + d.distributable_amount, 0)

  const pendingCount = distributions.filter((d) => d.status === 'pending').length

  const stats = [
    {
      label: 'Total Assets',
      value: assetCount.toString(),
      sub: 'tokenized in permission domain',
      icon: Building2,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Platform Investors',
      value: investorCount.toString(),
      sub: `${verifiedInvestorCount} KYC verified`,
      icon: Users,
      color: 'text-teal-500',
      bg: 'bg-teal-500/10',
    },
    {
      label: 'Total Royalties Paid',
      value: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(totalDistributed),
      sub: 'all-time completed',
      icon: DollarSign,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
    {
      label: 'Pending Royalties',
      value: pendingCount.toString(),
      sub: 'awaiting execution',
      icon: Activity,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.bg}`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold tabular-nums tracking-tight mt-0.5">
                    {stat.value}
                  </p>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">{stat.sub}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
