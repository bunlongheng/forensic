import { useState, useEffect, useCallback } from 'react'

// Two resolved palettes. Kept as plain JS objects (not only CSS vars) because the
// canvas layer - React Flow's Background dots, edge stroke, minimap - needs real
// color values in JS, not var(--x). The CSS-var mirror in index.css themes the
// chrome (panels, buttons); this object themes the canvas.
export const THEMES = {
  dark: {
    canvas: '#241a10', dot: '#3d2e1c', grid: '#2e2214',
    accent: '#ff4438', accentSoft: 'rgba(255,68,56,0.16)',
    text: '#e7e9ec', muted: '#b3a888',
    panel: '#161a20', panelBorder: '#252b34',
    nodeBg: '#191d25', nodeBorder: '#2b323d',
    minimapBg: 'rgba(30,22,13,0.85)', minimapNode: '#6b5233',
  },
  light: {
    canvas: '#e0cfa6', dot: '#cbb684', grid: '#d6c194',
    accent: '#d92b1f', accentSoft: 'rgba(217,43,31,0.12)',
    text: '#1a1d21', muted: '#5c4a30',
    panel: '#ffffff', panelBorder: '#e6e1d5',
    nodeBg: '#ffffff', nodeBorder: '#e2ddce',
    minimapBg: 'rgba(255,252,245,0.85)', minimapNode: '#8a6a3f',
  },
}

const KEY = 'forensic-theme'

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    const saved = localStorage.getItem(KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'light' // light by default
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(KEY, theme)
  }, [theme])
  const toggle = useCallback(() => setTheme(t => (t === 'dark' ? 'light' : 'dark')), [])
  return { theme, toggle, t: THEMES[theme] }
}
