import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/lib/button-variants'
import { cn } from '@/lib/utils'
import { AdminDistributionForm } from '@/components/admin/admin-distribution-form'
import type { AssetRow } from '@/types/database'

export default async function NewDistributionPage() {
  const supabase = await createClient()

  const { data: assets } = await supabase
    .from('assets')
    .select('*')
    .eq('is_active', true)
    .order('asset_name')

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-ml-2 gap-1.5 text-muted-foreground')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to admin
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">New Royalty Distribution</h1>
        <p className="text-base text-muted-foreground">Record a royalty payout for a tokenized land asset</p>
      </div>

      <AdminDistributionForm assets={(assets ?? []) as AssetRow[]} />
    </div>
  )
}
