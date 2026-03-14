import Link from 'next/link'
import { buttonVariants } from '@/lib/button-variants'
import { cn } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import { LogoIcon } from '@/components/assets/logo-icon'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-6">
        <LogoIcon className="h-7 w-7 text-primary" />
      </div>
      <h1 className="text-4xl font-bold tracking-tight mb-2">404</h1>
      <p className="text-lg text-muted-foreground mb-8">
        This page doesn&apos;t exist or has been moved.
      </p>
      <Link href="/" className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
        <ArrowLeft className="h-4 w-4" />
        Back to home
      </Link>
    </div>
  )
}
