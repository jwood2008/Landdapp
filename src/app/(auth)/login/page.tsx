import { LoginForm } from '@/components/auth/login-form'
import { Shield, TrendingUp, Wallet } from 'lucide-react'
import { LogoIcon } from '@/components/assets/logo-icon'
import Link from 'next/link'

const highlights = [
  { icon: Shield, text: 'AI-verified appraisals on every valuation' },
  { icon: TrendingUp, text: 'Real-time portfolio tracking & yield projections' },
  { icon: Wallet, text: 'XRPL-native settlement in under 4 seconds' },
]

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-primary p-12 text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/10" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
            <LogoIcon className="h-5 w-5" />
          </div>
          <span className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide">RWA Platform</span>
        </div>

        <div className="relative z-10 space-y-8">
          <blockquote className="text-3xl font-light leading-relaxed max-w-md">
            &ldquo;Real-world assets, tokenized for the next generation of investors.&rdquo;
          </blockquote>

          <div className="space-y-3">
            {highlights.map((h) => {
              const Icon = h.icon
              return (
                <div key={h.text} className="flex items-center gap-3 text-sm opacity-80">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                    <Icon className="h-4 w-4" />
                  </div>
                  {h.text}
                </div>
              )
            })}
          </div>
        </div>

        <p className="relative z-10 text-sm opacity-40">
          &copy; {new Date().getFullYear()} RWA Platform
        </p>
      </div>

      {/* Right panel - form */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <LogoIcon className="h-4 w-4 text-primary" />
            </div>
            <span className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">RWA Platform</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Sign in to access your portfolio and manage your tokenized assets.
            </p>
          </div>

          <LoginForm />

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
