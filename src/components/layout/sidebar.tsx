'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Shield,
  Send,
  Users,
  Store,
  Sliders,
  Wallet,
  FileText,
  BarChart3,
  Coins,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { LogoIcon } from '@/components/assets/logo-icon'
import { cn } from '@/lib/utils'

const investorNav = [
  { href: '/dashboard', label: 'Marketplace', icon: Store },
  { href: '/dashboard/portfolio', label: 'Portfolio', icon: Wallet },
  { href: '/dashboard/royalties', label: 'Royalties', icon: Coins },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

const issuerNav = [
  { href: '/issuer', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/issuer/distributions', label: 'Distributions', icon: Coins },
  { href: '/issuer/investors', label: 'My Investors', icon: Users },
  { href: '/issuer/updates', label: 'Quarterly Updates', icon: FileText },
  { href: '/issuer/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/issuer/settings', label: 'Settings', icon: Settings },
]

const adminNav = [
  { href: '/admin', label: 'Overview', icon: ShieldCheck },
  { href: '/admin/investors', label: 'Investors', icon: Users },
  { href: '/admin/permissions', label: 'Permissions', icon: Shield },
  { href: '/admin/issue-tokens', label: 'Issue Tokens', icon: Send },
  { href: '/admin/distributions', label: 'Distributions', icon: Coins },
  { href: '/admin/marketplace', label: 'Marketplace', icon: Store },
  { href: '/admin/platform-settings', label: 'Platform', icon: Sliders },
]

const STORAGE_KEY = 'sidebar-collapsed'

export function Sidebar({ userRole }: { userRole: string }) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'true') setCollapsed(true)
    setMounted(true)
  }, [])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }

  const sections =
    userRole === 'admin'
      ? [
          { label: 'Invest', items: investorNav },
          { label: 'Administration', items: adminNav },
        ]
      : userRole === 'issuer'
        ? [{ label: 'Issuer Portal', items: issuerNav }]
        : [{ label: 'Navigation', items: investorNav }]

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border bg-sidebar transition-all duration-300 ease-in-out',
        collapsed ? 'w-[68px]' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex h-16 items-center border-b border-sidebar-border',
        collapsed ? 'justify-center px-0' : 'gap-3 px-6'
      )}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/15">
          <LogoIcon className="h-4 w-4 text-sidebar-primary" />
        </div>
        {!collapsed && (
          <span className="font-[family-name:var(--font-display)] text-[17px] font-semibold tracking-wide text-sidebar-primary whitespace-nowrap overflow-hidden">
            RWA Platform
          </span>
        )}
      </div>

      {/* Nav sections */}
      <nav className={cn('flex-1 overflow-y-auto pt-5 pb-3', collapsed ? 'px-2' : 'px-3')}>
        {sections.map((section, sectionIdx) => (
          <div key={section.label} className={sectionIdx > 0 ? 'mt-6' : ''}>
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.2em] text-sidebar-primary/60">
                {section.label}
              </p>
            )}
            {collapsed && sectionIdx > 0 && (
              <div className="mx-2 mb-3 border-t border-sidebar-border" />
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive =
                  item.href === '/dashboard' ||
                  item.href === '/issuer' ||
                  item.href === '/admin'
                    ? pathname === item.href
                    : pathname.startsWith(item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center rounded-lg text-sm font-medium transition-all duration-150',
                      collapsed
                        ? 'justify-center px-0 py-2.5'
                        : 'gap-3 px-3 py-2.5',
                      isActive
                        ? 'bg-sidebar-primary/15 text-sidebar-primary shadow-sm'
                        : 'text-sidebar-primary/50 hover:bg-sidebar-primary/10 hover:text-sidebar-primary'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && (
                      <span className="whitespace-nowrap overflow-hidden">{item.label}</span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={cn('border-t border-sidebar-border py-3 space-y-2', collapsed ? 'px-2' : 'px-4')}>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={collapsed ? (theme === 'dark' ? 'Light Mode' : 'Dark Mode') : undefined}
          className={cn(
            'flex w-full items-center rounded-lg text-sm font-medium text-sidebar-primary/50 hover:bg-sidebar-primary/10 hover:text-sidebar-primary transition-all duration-150',
            collapsed ? 'justify-center px-0 py-2' : 'gap-3 px-3 py-2'
          )}
        >
          {mounted && theme === 'dark' ? (
            <Sun className="h-4 w-4 shrink-0" />
          ) : (
            <Moon className="h-4 w-4 shrink-0" />
          )}
          {!collapsed && mounted && (theme === 'dark' ? 'Light Mode' : 'Dark Mode')}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapsed}
          className={cn(
            'flex w-full items-center rounded-lg text-sm font-medium text-sidebar-primary/50 hover:bg-sidebar-primary/10 hover:text-sidebar-primary transition-all duration-150',
            collapsed ? 'justify-center px-0 py-2' : 'gap-3 px-3 py-2'
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4 shrink-0" />
          ) : (
            <PanelLeftClose className="h-4 w-4 shrink-0" />
          )}
          {!collapsed && 'Collapse'}
        </button>

        {!collapsed && (
          <p className="px-3 text-[11px] text-sidebar-foreground/40">Powered by XRPL</p>
        )}
      </div>
    </aside>
  )
}
