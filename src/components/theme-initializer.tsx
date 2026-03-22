'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'

/**
 * Color theme definitions — must match appearance-settings.tsx COLOR_THEMES.
 * Only the CSS variable values are needed here for initialization.
 */
const THEME_COLORS: Record<string, { light: Record<string, string>; dark: Record<string, string> }> = {
  slate: {
    light: { '--primary': '#334155', '--accent': '#F1F5F9', '--sidebar': '#0F172A', '--sidebar-primary': '#94A3B8' },
    dark: { '--primary': '#94A3B8', '--accent': '#1E293B', '--sidebar': '#020617', '--sidebar-primary': '#CBD5E1' },
  },
  indigo: {
    light: { '--primary': '#4F46E5', '--accent': '#EEF2FF', '--sidebar': '#1E1B4B', '--sidebar-primary': '#A5B4FC' },
    dark: { '--primary': '#818CF8', '--accent': '#1E1B4B', '--sidebar': '#0F0D2E', '--sidebar-primary': '#C7D2FE' },
  },
  emerald: {
    light: { '--primary': '#059669', '--accent': '#ECFDF5', '--sidebar': '#022C22', '--sidebar-primary': '#6EE7B7' },
    dark: { '--primary': '#34D399', '--accent': '#022C22', '--sidebar': '#011A14', '--sidebar-primary': '#6EE7B7' },
  },
  violet: {
    light: { '--primary': '#7C3AED', '--accent': '#F5F3FF', '--sidebar': '#2E1065', '--sidebar-primary': '#C4B5FD' },
    dark: { '--primary': '#A78BFA', '--accent': '#1C1033', '--sidebar': '#120B28', '--sidebar-primary': '#C4B5FD' },
  },
  rose: {
    light: { '--primary': '#E11D48', '--accent': '#FFF1F2', '--sidebar': '#4C0519', '--sidebar-primary': '#FDA4AF' },
    dark: { '--primary': '#FB7185', '--accent': '#2A0A14', '--sidebar': '#1A0510', '--sidebar-primary': '#FDA4AF' },
  },
  amber: {
    light: { '--primary': '#D97706', '--accent': '#FFFBEB', '--sidebar': '#451A03', '--sidebar-primary': '#FCD34D' },
    dark: { '--primary': '#FBBF24', '--accent': '#27170A', '--sidebar': '#1A0F05', '--sidebar-primary': '#FCD34D' },
  },
  teal: {
    light: { '--primary': '#0D9488', '--accent': '#F0FDFA', '--sidebar': '#042F2E', '--sidebar-primary': '#5EEAD4' },
    dark: { '--primary': '#2DD4BF', '--accent': '#042F2E', '--sidebar': '#021C1B', '--sidebar-primary': '#5EEAD4' },
  },
  noir: {
    light: { '--primary': '#171717', '--accent': '#F5F5F5', '--sidebar': '#0A0A0A', '--sidebar-primary': '#D4D4D4' },
    dark: { '--primary': '#E5E5E5', '--accent': '#171717', '--sidebar': '#0A0A0A', '--sidebar-primary': '#D4D4D4' },
  },
  ocean: {
    light: { '--primary': '#0369A1', '--accent': '#F0F9FF', '--sidebar': '#082F49', '--sidebar-primary': '#7DD3FC' },
    dark: { '--primary': '#38BDF8', '--accent': '#0C2D48', '--sidebar': '#051B2C', '--sidebar-primary': '#7DD3FC' },
  },
}

export function ThemeInitializer() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const saved = localStorage.getItem('rwa-color-theme')
    if (!saved || saved === 'default' || !THEME_COLORS[saved]) return

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
