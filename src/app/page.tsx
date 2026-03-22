import Link from 'next/link'
import { buttonVariants } from '@/lib/button-variants'
import { cn } from '@/lib/utils'
import {
  Shield,
  TrendingUp,
  Wallet,
  ArrowRight,
  CheckCircle,
  Lock,
  BarChart3,
  Globe,
  Zap,
} from 'lucide-react'
import { LogoIcon } from '@/components/assets/logo-icon'

const features = [
  {
    icon: Shield,
    title: 'LLC-Backed Ownership',
    description:
      'Each token represents fractional membership in a legally structured LLC that directly owns the asset.',
    detail: 'Full legal compliance with SEC guidance',
  },
  {
    icon: TrendingUp,
    title: 'AI-Verified Valuations',
    description:
      'Asset values are updated through appraisals verified by AI — detecting fraud, validating signatures, and scoring integrity.',
    detail: 'Automated compliance & fraud detection',
  },
  {
    icon: Wallet,
    title: 'XRPL Settlement',
    description:
      'Ownership is tracked on the XRP Ledger with permissioned trust lines. Distributions settle directly to your wallet.',
    detail: '3-5 second settlement, near-zero fees',
  },
]

const stats = [
  { value: '$0', label: 'Total Value Locked', note: 'Growing' },
  { value: '<4s', label: 'Settlement Time', note: 'XRPL speed' },
  { value: '100%', label: 'AI Verification', note: 'Every appraisal' },
]

const assetClasses = [
  { name: 'Agricultural Land', icon: Globe },
  { name: 'Real Estate', icon: LogoIcon },
  { name: 'Private Credit', icon: BarChart3 },
  { name: 'Infrastructure', icon: Zap },
  { name: 'Aircraft', icon: Globe },
  { name: 'Energy Assets', icon: Zap },
]

const trustSignals = [
  'Permissioned token access — only approved investors',
  'Every valuation change requires verified appraisal document',
  'AI integrity scoring with fraud detection on every upload',
  'Full audit trail — every change logged and timestamped',
  'XRPL-native trust lines with RequireAuth compliance',
]

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-6 md:px-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <LogoIcon className="h-4.5 w-4.5 text-primary" />
          </div>
          <span className="font-[family-name:var(--font-display)] font-semibold tracking-wide text-lg">TierraDex</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            Sign in
          </Link>
          <Link href="/register" className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}>
            Get started
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex flex-col items-center px-6 pt-20 pb-24 md:pt-28 md:pb-32 text-center overflow-hidden">
        {/* Subtle gradient bg */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.03] via-transparent to-transparent" />

        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground">
          <Zap className="h-3 w-3 text-primary" />
          Powered by XRPL &middot; AI-verified appraisals
        </div>

        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
          Fractional ownership of{' '}
          <span className="text-primary">real-world assets</span>, on-chain.
        </h1>

        <p className="mt-6 max-w-xl text-lg text-muted-foreground leading-relaxed">
          Invest in tokenized land, real estate, and alternative assets.
          Track your portfolio, receive distributions, and manage ownership —
          all through a single investor portal.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/register"
            className={cn(buttonVariants({ size: 'lg' }), 'gap-2 px-8 text-base')}
          >
            Create account
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className={cn(buttonVariants({ size: 'lg', variant: 'outline' }), 'px-8 text-base')}
          >
            Sign in
          </Link>
        </div>

        {/* Social proof stats */}
        <div className="mt-16 grid grid-cols-3 gap-8 md:gap-16">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl md:text-4xl font-bold tracking-tight">{stat.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-muted/20 px-6 md:px-10 py-20 md:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
              How it works
            </p>
            <h2 className="text-3xl font-bold tracking-tight">
              Institutional-grade infrastructure, simplified
            </h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
              From legal structuring to on-chain settlement, every step is designed
              for compliance, transparency, and trust.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {features.map((feature, i) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.title}
                  className="relative rounded-xl border border-border bg-card p-8 space-y-4 transition-colors hover:border-primary/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                  <p className="text-sm text-primary font-medium flex items-center gap-1.5">
                    <CheckCircle className="h-3 w-3" />
                    {feature.detail}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Trust & Security */}
      <section className="px-6 md:px-10 py-20 md:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
                Trust & Security
              </p>
              <h2 className="text-3xl font-bold tracking-tight">
                Built for compliance from day one
              </h2>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Every valuation change requires an AI-verified appraisal document.
                Permissioned trust lines ensure only approved investors can hold tokens.
              </p>
            </div>
            <div className="space-y-3">
              {trustSignals.map((signal) => (
                <div
                  key={signal}
                  className="flex items-start gap-3 rounded-lg border border-border bg-card p-5"
                >
                  <Lock className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <p className="text-sm">{signal}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Asset classes */}
      <section className="border-y border-border bg-muted/20 px-6 md:px-10 py-20 md:py-24">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">
            Asset Classes
          </p>
          <h2 className="text-3xl font-bold tracking-tight">
            Built for any real-world asset
          </h2>
          <p className="mt-3 mb-12 text-muted-foreground max-w-md mx-auto">
            Starting with land — designed to scale to any asset class.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {assetClasses.map((cls) => {
              const Icon = cls.icon
              return (
                <div
                  key={cls.name}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-6 text-left transition-colors hover:border-primary/20"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <Icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{cls.name}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-6 md:px-10 py-24 md:py-32 text-center overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.03] via-primary/[0.02] to-transparent" />
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Ready to tokenize your first asset?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Create your account and connect your XRPL wallet to get started.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className={cn(buttonVariants({ size: 'lg' }), 'gap-2 px-8 text-base')}
            >
              Create free account
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className={cn(buttonVariants({ size: 'lg', variant: 'outline' }), 'px-8 text-base')}
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 md:px-10 py-10">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <LogoIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} TierraDex
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Powered by XRPL &middot; AI-verified valuations
          </p>
        </div>
      </footer>
    </div>
  )
}
