'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { Check, Sun, Moon } from 'lucide-react'

interface ColorTheme {
  id: string
  name: string
  light: {
    primary: string
    accent: string
    sidebar: string
    sidebarPrimary: string
  }
  dark: {
    primary: string
    accent: string
    sidebar: string
    sidebarPrimary: string
  }
  preview: {
    bg: string
    primary: string
    accent: string
    sidebar: string
  }
}

const COLOR_THEMES: ColorTheme[] = [
  {
    id: 'forest',
    name: 'Forest',
    preview: { bg: '#f8faf8', primary: '#2d5a3d', accent: '#e8efe8', sidebar: '#1a3322' },
    light: {
      primary: 'oklch(0.38 0.12 155)',
      accent: 'oklch(0.92 0.025 155)',
      sidebar: 'oklch(0.22 0.05 160)',
      sidebarPrimary: 'oklch(0.80 0.14 80)',
    },
    dark: {
      primary: 'oklch(0.75 0.14 160)',
      accent: 'oklch(0.26 0.015 155)',
      sidebar: 'oklch(0.15 0.010 155)',
      sidebarPrimary: 'oklch(0.78 0.11 85)',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    preview: { bg: '#f7f8fc', primary: '#3b4fc4', accent: '#ebedf8', sidebar: '#1c2340' },
    light: {
      primary: 'oklch(0.45 0.18 265)',
      accent: 'oklch(0.93 0.02 265)',
      sidebar: 'oklch(0.22 0.05 265)',
      sidebarPrimary: 'oklch(0.75 0.15 80)',
    },
    dark: {
      primary: 'oklch(0.72 0.16 265)',
      accent: 'oklch(0.25 0.02 265)',
      sidebar: 'oklch(0.15 0.02 265)',
      sidebarPrimary: 'oklch(0.75 0.12 80)',
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    preview: { bg: '#f8f9fa', primary: '#475569', accent: '#e9ecef', sidebar: '#1e293b' },
    light: {
      primary: 'oklch(0.45 0.03 260)',
      accent: 'oklch(0.93 0.005 260)',
      sidebar: 'oklch(0.23 0.02 260)',
      sidebarPrimary: 'oklch(0.80 0.10 210)',
    },
    dark: {
      primary: 'oklch(0.70 0.03 260)',
      accent: 'oklch(0.25 0.01 260)',
      sidebar: 'oklch(0.16 0.01 260)',
      sidebarPrimary: 'oklch(0.75 0.08 210)',
    },
  },
  {
    id: 'ember',
    name: 'Ember',
    preview: { bg: '#faf8f7', primary: '#c2410c', accent: '#fef2e8', sidebar: '#3b1506' },
    light: {
      primary: 'oklch(0.52 0.18 40)',
      accent: 'oklch(0.94 0.02 55)',
      sidebar: 'oklch(0.22 0.06 35)',
      sidebarPrimary: 'oklch(0.82 0.14 80)',
    },
    dark: {
      primary: 'oklch(0.72 0.16 40)',
      accent: 'oklch(0.25 0.02 40)',
      sidebar: 'oklch(0.15 0.03 35)',
      sidebarPrimary: 'oklch(0.78 0.12 80)',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    preview: { bg: '#f7fafc', primary: '#0e7490', accent: '#e0f4f8', sidebar: '#083344' },
    light: {
      primary: 'oklch(0.52 0.12 210)',
      accent: 'oklch(0.94 0.02 210)',
      sidebar: 'oklch(0.24 0.04 210)',
      sidebarPrimary: 'oklch(0.80 0.12 170)',
    },
    dark: {
      primary: 'oklch(0.72 0.12 210)',
      accent: 'oklch(0.25 0.02 210)',
      sidebar: 'oklch(0.16 0.02 210)',
      sidebarPrimary: 'oklch(0.78 0.10 170)',
    },
  },
  {
    id: 'violet',
    name: 'Violet',
    preview: { bg: '#faf8ff', primary: '#7c3aed', accent: '#f0ebff', sidebar: '#2e1065' },
    light: {
      primary: 'oklch(0.50 0.20 290)',
      accent: 'oklch(0.94 0.03 290)',
      sidebar: 'oklch(0.22 0.07 290)',
      sidebarPrimary: 'oklch(0.80 0.14 60)',
    },
    dark: {
      primary: 'oklch(0.72 0.18 290)',
      accent: 'oklch(0.25 0.03 290)',
      sidebar: 'oklch(0.15 0.04 290)',
      sidebarPrimary: 'oklch(0.78 0.12 60)',
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    preview: { bg: '#fdf7f8', primary: '#be123c', accent: '#fde8ec', sidebar: '#3b0613' },
    light: {
      primary: 'oklch(0.50 0.18 15)',
      accent: 'oklch(0.95 0.02 15)',
      sidebar: 'oklch(0.22 0.06 15)',
      sidebarPrimary: 'oklch(0.82 0.12 55)',
    },
    dark: {
      primary: 'oklch(0.72 0.16 15)',
      accent: 'oklch(0.25 0.02 15)',
      sidebar: 'oklch(0.15 0.03 15)',
      sidebarPrimary: 'oklch(0.78 0.10 55)',
    },
  },
  {
    id: 'gold',
    name: 'Gold',
    preview: { bg: '#faf9f5', primary: '#a16207', accent: '#fef3c7', sidebar: '#422006' },
    light: {
      primary: 'oklch(0.55 0.14 80)',
      accent: 'oklch(0.95 0.03 85)',
      sidebar: 'oklch(0.24 0.05 70)',
      sidebarPrimary: 'oklch(0.80 0.14 80)',
    },
    dark: {
      primary: 'oklch(0.75 0.13 80)',
      accent: 'oklch(0.26 0.02 80)',
      sidebar: 'oklch(0.16 0.03 70)',
      sidebarPrimary: 'oklch(0.78 0.12 80)',
    },
  },
  {
    id: 'emerald',
    name: 'Emerald',
    preview: { bg: '#f7faf8', primary: '#059669', accent: '#d1fae5', sidebar: '#064e3b' },
    light: {
      primary: 'oklch(0.58 0.14 165)',
      accent: 'oklch(0.94 0.03 165)',
      sidebar: 'oklch(0.26 0.05 165)',
      sidebarPrimary: 'oklch(0.82 0.12 100)',
    },
    dark: {
      primary: 'oklch(0.75 0.14 165)',
      accent: 'oklch(0.26 0.02 165)',
      sidebar: 'oklch(0.17 0.03 165)',
      sidebarPrimary: 'oklch(0.78 0.10 100)',
    },
  },
  {
    id: 'noir',
    name: 'Noir',
    preview: { bg: '#fafafa', primary: '#171717', accent: '#f0f0f0', sidebar: '#0a0a0a' },
    light: {
      primary: 'oklch(0.20 0 0)',
      accent: 'oklch(0.95 0 0)',
      sidebar: 'oklch(0.12 0 0)',
      sidebarPrimary: 'oklch(0.95 0 0)',
    },
    dark: {
      primary: 'oklch(0.90 0 0)',
      accent: 'oklch(0.22 0 0)',
      sidebar: 'oklch(0.10 0 0)',
      sidebarPrimary: 'oklch(0.90 0 0)',
    },
  },
]

function applyThemeColors(theme: ColorTheme, mode: 'light' | 'dark') {
  const colors = mode === 'dark' ? theme.dark : theme.light
  const root = document.documentElement

  root.style.setProperty('--primary', colors.primary)
  root.style.setProperty('--accent', colors.accent)
  root.style.setProperty('--sidebar', colors.sidebar)
  root.style.setProperty('--sidebar-primary', colors.sidebarPrimary)

  // Derive related colors from primary
  if (mode === 'light') {
    root.style.setProperty('--ring', colors.primary)
    root.style.setProperty('--sidebar-accent', colors.sidebar.replace(/0\.22/, '0.28'))
  } else {
    root.style.setProperty('--ring', colors.primary)
    root.style.setProperty('--sidebar-accent', colors.sidebar.replace(/0\.15/, '0.22'))
  }
}

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  const [selectedTheme, setSelectedTheme] = useState<string>('forest')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('rwa-color-theme')
    if (saved) setSelectedTheme(saved)
  }, [])

  function handleThemeSelect(colorTheme: ColorTheme) {
    setSelectedTheme(colorTheme.id)
    localStorage.setItem('rwa-color-theme', colorTheme.id)
    applyThemeColors(colorTheme, (theme ?? 'light') as 'light' | 'dark')
  }

  function handleModeChange(mode: 'light' | 'dark') {
    setTheme(mode)
    const colorTheme = COLOR_THEMES.find(t => t.id === selectedTheme)
    if (colorTheme) {
      // Small delay for next-themes to apply the class
      setTimeout(() => applyThemeColors(colorTheme, mode), 50)
    }
  }

  if (!mounted) return null

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Mode</label>
        <div className="flex gap-2">
          <button
            onClick={() => handleModeChange('light')}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
              theme === 'light'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border hover:border-primary/30'
            }`}
          >
            <Sun className="h-4 w-4" />
            Light
          </button>
          <button
            onClick={() => handleModeChange('dark')}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
              theme === 'dark'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border hover:border-primary/30'
            }`}
          >
            <Moon className="h-4 w-4" />
            Dark
          </button>
        </div>
      </div>

      {/* Color themes */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Color Theme</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {COLOR_THEMES.map((ct) => {
            const isActive = selectedTheme === ct.id
            return (
              <button
                key={ct.id}
                onClick={() => handleThemeSelect(ct)}
                className={`group relative flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors ${
                  isActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                {/* Color preview swatch */}
                <div className="flex w-full gap-1 h-8 rounded overflow-hidden">
                  <div className="flex-1 rounded-l" style={{ backgroundColor: ct.preview.sidebar }} />
                  <div className="flex-1" style={{ backgroundColor: ct.preview.primary }} />
                  <div className="flex-1" style={{ backgroundColor: ct.preview.accent }} />
                  <div className="flex-1 rounded-r" style={{ backgroundColor: ct.preview.bg }} />
                </div>
                <span className="text-xs font-medium">{ct.name}</span>
                {isActive && (
                  <div className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-2.5 w-2.5" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
