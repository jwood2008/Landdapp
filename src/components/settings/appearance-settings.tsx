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
  // ── Default brand (navy/blue from globals.css) ──
  {
    id: 'default',
    name: 'Navy',
    preview: { bg: '#FFFFFF', primary: '#0A3161', accent: '#EFF6FF', sidebar: '#0C1D36' },
    light: {
      primary: '#0A3161',
      accent: '#EFF6FF',
      sidebar: '#0C1D36',
      sidebarPrimary: '#93C5FD',
    },
    dark: {
      primary: '#60A5FA',
      accent: '#1E293B',
      sidebar: '#0B1526',
      sidebarPrimary: '#93C5FD',
    },
  },
  // ── Professional themes ──
  {
    id: 'slate',
    name: 'Slate',
    preview: { bg: '#FAFAFA', primary: '#334155', accent: '#F1F5F9', sidebar: '#0F172A' },
    light: {
      primary: '#334155',
      accent: '#F1F5F9',
      sidebar: '#0F172A',
      sidebarPrimary: '#94A3B8',
    },
    dark: {
      primary: '#94A3B8',
      accent: '#1E293B',
      sidebar: '#020617',
      sidebarPrimary: '#CBD5E1',
    },
  },
  {
    id: 'indigo',
    name: 'Indigo',
    preview: { bg: '#F5F7FF', primary: '#4F46E5', accent: '#E0E7FF', sidebar: '#1E1B4B' },
    light: {
      primary: '#4F46E5',
      accent: '#EEF2FF',
      sidebar: '#1E1B4B',
      sidebarPrimary: '#A5B4FC',
    },
    dark: {
      primary: '#818CF8',
      accent: '#1E1B4B',
      sidebar: '#0F0D2E',
      sidebarPrimary: '#C7D2FE',
    },
  },
  {
    id: 'emerald',
    name: 'Emerald',
    preview: { bg: '#F0FDF4', primary: '#059669', accent: '#D1FAE5', sidebar: '#022C22' },
    light: {
      primary: '#059669',
      accent: '#ECFDF5',
      sidebar: '#022C22',
      sidebarPrimary: '#6EE7B7',
    },
    dark: {
      primary: '#34D399',
      accent: '#022C22',
      sidebar: '#011A14',
      sidebarPrimary: '#6EE7B7',
    },
  },
  {
    id: 'violet',
    name: 'Violet',
    preview: { bg: '#FAF5FF', primary: '#7C3AED', accent: '#EDE9FE', sidebar: '#2E1065' },
    light: {
      primary: '#7C3AED',
      accent: '#F5F3FF',
      sidebar: '#2E1065',
      sidebarPrimary: '#C4B5FD',
    },
    dark: {
      primary: '#A78BFA',
      accent: '#1C1033',
      sidebar: '#120B28',
      sidebarPrimary: '#C4B5FD',
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    preview: { bg: '#FFF1F2', primary: '#E11D48', accent: '#FFE4E6', sidebar: '#4C0519' },
    light: {
      primary: '#E11D48',
      accent: '#FFF1F2',
      sidebar: '#4C0519',
      sidebarPrimary: '#FDA4AF',
    },
    dark: {
      primary: '#FB7185',
      accent: '#2A0A14',
      sidebar: '#1A0510',
      sidebarPrimary: '#FDA4AF',
    },
  },
  {
    id: 'amber',
    name: 'Amber',
    preview: { bg: '#FFFBEB', primary: '#D97706', accent: '#FEF3C7', sidebar: '#451A03' },
    light: {
      primary: '#D97706',
      accent: '#FFFBEB',
      sidebar: '#451A03',
      sidebarPrimary: '#FCD34D',
    },
    dark: {
      primary: '#FBBF24',
      accent: '#27170A',
      sidebar: '#1A0F05',
      sidebarPrimary: '#FCD34D',
    },
  },
  {
    id: 'teal',
    name: 'Teal',
    preview: { bg: '#F0FDFA', primary: '#0D9488', accent: '#CCFBF1', sidebar: '#042F2E' },
    light: {
      primary: '#0D9488',
      accent: '#F0FDFA',
      sidebar: '#042F2E',
      sidebarPrimary: '#5EEAD4',
    },
    dark: {
      primary: '#2DD4BF',
      accent: '#042F2E',
      sidebar: '#021C1B',
      sidebarPrimary: '#5EEAD4',
    },
  },
  {
    id: 'noir',
    name: 'Noir',
    preview: { bg: '#FAFAFA', primary: '#171717', accent: '#F5F5F5', sidebar: '#0A0A0A' },
    light: {
      primary: '#171717',
      accent: '#F5F5F5',
      sidebar: '#0A0A0A',
      sidebarPrimary: '#D4D4D4',
    },
    dark: {
      primary: '#E5E5E5',
      accent: '#171717',
      sidebar: '#0A0A0A',
      sidebarPrimary: '#D4D4D4',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    preview: { bg: '#F0F9FF', primary: '#0369A1', accent: '#E0F2FE', sidebar: '#082F49' },
    light: {
      primary: '#0369A1',
      accent: '#F0F9FF',
      sidebar: '#082F49',
      sidebarPrimary: '#7DD3FC',
    },
    dark: {
      primary: '#38BDF8',
      accent: '#0C2D48',
      sidebar: '#051B2C',
      sidebarPrimary: '#7DD3FC',
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
  const [selectedTheme, setSelectedTheme] = useState<string>('default')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('rwa-color-theme')
    if (saved) setSelectedTheme(saved)
  }, [])

  function handleThemeSelect(colorTheme: ColorTheme) {
    setSelectedTheme(colorTheme.id)
    localStorage.setItem('rwa-color-theme', colorTheme.id)

    if (colorTheme.id === 'default') {
      // Reset to CSS defaults by removing inline overrides
      const root = document.documentElement
      const props = ['--primary', '--accent', '--sidebar', '--sidebar-primary', '--ring', '--sidebar-accent']
      props.forEach(p => root.style.removeProperty(p))
      return
    }

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
