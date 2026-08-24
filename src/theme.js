import { useState, useEffect, useCallback } from 'react'

// Two resolved palettes. Kept as plain JS objects (not only CSS vars) because the
// canvas layer - React Flow's Background dots, edge stroke, minimap - needs real
// color values in JS, not var(--x). The CSS-var mirror in index.css themes the
// chrome (panels, buttons); this object themes the canvas.
export const THEMES = {
  dark: {
    canvas: '#0e1013', dot: '#242a33', grid: '#1a1e25',
    accent: '#ff4438', accentSoft: 'rgba(255,68,56,0.16)',
    text: '#e7e9ec', muted: '#8b929c',
    panel: '#161a20', panelBorder: '#252b34',
    nodeBg: '#191d25', nodeBorder: '#2b323d',
    minimapBg: 'rgba(20,23,29,0.85)', minimapNode: '#3a424e',
  },
  light: {
    canvas: '#f3f0e8', dot: '#cdc6b6', grid: '#e7e2d5',
    accent: '#d92b1f', accentSoft: 'rgba(217,43,31,0.12)',
    text: '#1a1d21', muted: '#6f747c',
    panel: '#ffffff', panelBorder: '#e6e1d5',
    nodeBg: '#ffffff', nodeBorder: '#e2ddce',
    minimapBg: 'rgba(255,255,255,0.85)', minimapNode: '#cbc4b4',
  },
}

const KEY = 'forensic-theme'

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark'
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(KEY, theme)
  }, [theme])
  const toggle = useCallback(() => setTheme(t => (t === 'dark' ? 'light' : 'dark')), [])
  return { theme, toggle, t: THEMES[theme] }
}
