import { CreateAssetForm } from '@/components/admin/create-asset-form'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/lib/button-variants'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'

export default async function NewAssetPage() {
  const supabase = await createClient()

  // Fetch all issuer users for owner assignment dropdown
  const { data: issuers } = await supabase
    .from('users')
    .select('id, email, full_name, role')
    .eq('role', 'issuer')
    .order('email')

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
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Create New Asset</h1>
        <p className="text-base text-muted-foreground">Register a new tokenized asset on the platform</p>
      </div>
      <CreateAssetForm
        issuers={(issuers ?? []) as Array<{ id: string; email: string; full_name: string | null; role: string }>}
      />
    </div>
  )
}
