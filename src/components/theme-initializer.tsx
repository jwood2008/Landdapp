'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

/**
 * Color theme definitions — must match appearance-settings.tsx COLOR_THEMES.
 * Only the CSS variable values are needed here for initialization.
 */
const THEME_COLORS: Record<string, { light: Record<string, string>; dark: Record<string, string> }> = {
  forest: {
    light: { '--primary': 'oklch(0.38 0.12 155)', '--accent': 'oklch(0.92 0.025 155)', '--sidebar': 'oklch(0.22 0.05 160)', '--sidebar-primary': 'oklch(0.80 0.14 80)' },
    dark: { '--primary': 'oklch(0.75 0.14 160)', '--accent': 'oklch(0.26 0.015 155)', '--sidebar': 'oklch(0.15 0.010 155)', '--sidebar-primary': 'oklch(0.78 0.11 85)' },
  },
  midnight: {
    light: { '--primary': 'oklch(0.45 0.18 265)', '--accent': 'oklch(0.93 0.02 265)', '--sidebar': 'oklch(0.22 0.05 265)', '--sidebar-primary': 'oklch(0.75 0.15 80)' },
    dark: { '--primary': 'oklch(0.72 0.16 265)', '--accent': 'oklch(0.25 0.02 265)', '--sidebar': 'oklch(0.15 0.02 265)', '--sidebar-primary': 'oklch(0.75 0.12 80)' },
  },
  slate: {
    light: { '--primary': 'oklch(0.45 0.03 260)', '--accent': 'oklch(0.93 0.005 260)', '--sidebar': 'oklch(0.23 0.02 260)', '--sidebar-primary': 'oklch(0.80 0.10 210)' },
    dark: { '--primary': 'oklch(0.70 0.03 260)', '--accent': 'oklch(0.25 0.01 260)', '--sidebar': 'oklch(0.16 0.01 260)', '--sidebar-primary': 'oklch(0.75 0.08 210)' },
  },
  ember: {
    light: { '--primary': 'oklch(0.52 0.18 40)', '--accent': 'oklch(0.94 0.02 55)', '--sidebar': 'oklch(0.22 0.06 35)', '--sidebar-primary': 'oklch(0.82 0.14 80)' },
    dark: { '--primary': 'oklch(0.72 0.16 40)', '--accent': 'oklch(0.25 0.02 40)', '--sidebar': 'oklch(0.15 0.03 35)', '--sidebar-primary': 'oklch(0.78 0.12 80)' },
  },
  ocean: {
    light: { '--primary': 'oklch(0.52 0.12 210)', '--accent': 'oklch(0.94 0.02 210)', '--sidebar': 'oklch(0.24 0.04 210)', '--sidebar-primary': 'oklch(0.80 0.12 170)' },
    dark: { '--primary': 'oklch(0.72 0.12 210)', '--accent': 'oklch(0.25 0.02 210)', '--sidebar': 'oklch(0.16 0.02 210)', '--sidebar-primary': 'oklch(0.78 0.10 170)' },
  },
  violet: {
    light: { '--primary': 'oklch(0.50 0.20 290)', '--accent': 'oklch(0.94 0.03 290)', '--sidebar': 'oklch(0.22 0.07 290)', '--sidebar-primary': 'oklch(0.80 0.14 60)' },
    dark: { '--primary': 'oklch(0.72 0.18 290)', '--accent': 'oklch(0.25 0.03 290)', '--sidebar': 'oklch(0.15 0.04 290)', '--sidebar-primary': 'oklch(0.78 0.12 60)' },
  },
  rose: {
    light: { '--primary': 'oklch(0.50 0.18 15)', '--accent': 'oklch(0.95 0.02 15)', '--sidebar': 'oklch(0.22 0.06 15)', '--sidebar-primary': 'oklch(0.82 0.12 55)' },
    dark: { '--primary': 'oklch(0.72 0.16 15)', '--accent': 'oklch(0.25 0.02 15)', '--sidebar': 'oklch(0.15 0.03 15)', '--sidebar-primary': 'oklch(0.78 0.10 55)' },
  },
  gold: {
    light: { '--primary': 'oklch(0.55 0.14 80)', '--accent': 'oklch(0.95 0.03 85)', '--sidebar': 'oklch(0.24 0.05 70)', '--sidebar-primary': 'oklch(0.80 0.14 80)' },
    dark: { '--primary': 'oklch(0.75 0.13 80)', '--accent': 'oklch(0.26 0.02 80)', '--sidebar': 'oklch(0.16 0.03 70)', '--sidebar-primary': 'oklch(0.78 0.12 80)' },
  },
  emerald: {
    light: { '--primary': 'oklch(0.58 0.14 165)', '--accent': 'oklch(0.94 0.03 165)', '--sidebar': 'oklch(0.26 0.05 165)', '--sidebar-primary': 'oklch(0.82 0.12 100)' },
    dark: { '--primary': 'oklch(0.75 0.14 165)', '--accent': 'oklch(0.26 0.02 165)', '--sidebar': 'oklch(0.17 0.03 165)', '--sidebar-primary': 'oklch(0.78 0.10 100)' },
  },
  noir: {
    light: { '--primary': 'oklch(0.20 0 0)', '--accent': 'oklch(0.95 0 0)', '--sidebar': 'oklch(0.12 0 0)', '--sidebar-primary': 'oklch(0.95 0 0)' },
    dark: { '--primary': 'oklch(0.90 0 0)', '--accent': 'oklch(0.22 0 0)', '--sidebar': 'oklch(0.10 0 0)', '--sidebar-primary': 'oklch(0.90 0 0)' },
  },
}

export function ThemeInitializer() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const saved = localStorage.getItem('rwa-color-theme')
    if (!saved || saved === 'forest' || !THEME_COLORS[saved]) return

    const mode = resolvedTheme === 'dark' ? 'dark' : 'light'
    const colors = THEME_COLORS[saved][mode]
    const root = document.documentElement

    for (const [prop, value] of Object.entries(colors)) {
      root.style.setProperty(prop, value)
    }
    root.style.setProperty('--ring', colors['--primary'])
  }, [resolvedTheme])

  return null
}
