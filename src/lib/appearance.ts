export type ThemeMode = 'light' | 'dark' | 'system'

export interface Appearance {
  mode: ThemeMode
  accent: string
}

export const STORAGE_KEY = 'mindmate-appearance'

export const DEFAULT_APPEARANCE: Appearance = { mode: 'light', accent: '#7c3aed' }

export const PRESETS = [
  { name: 'Violet', color: '#7c3aed' },
  { name: 'Blue', color: '#2563eb' },
  { name: 'Teal', color: '#0d9488' },
  { name: 'Green', color: '#16a34a' },
  { name: 'Pink', color: '#db2777' },
  { name: 'Orange', color: '#ea580c' },
  { name: 'Red', color: '#dc2626' },
]

const HEX = /^#[0-9a-fA-F]{6}$/

export function isHexColor(value: string) {
  return HEX.test(value)
}

// Only the theme mode and accent color are saved here. Nothing private.
export function loadAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_APPEARANCE
    const data = JSON.parse(raw)
    const mode: ThemeMode =
      data.mode === 'dark' || data.mode === 'system' || data.mode === 'light'
        ? data.mode
        : DEFAULT_APPEARANCE.mode
    const accent =
      typeof data.accent === 'string' && isHexColor(data.accent)
        ? data.accent.toLowerCase()
        : DEFAULT_APPEARANCE.accent
    return { mode, accent }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

export function saveAppearance(appearance: Appearance) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance))
  } catch {
    // Storage can be blocked. The theme still works until the page is closed.
  }
}

export function clearAppearance() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do.
  }
}

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function channel(value: number) {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

// Picks black or white text, whichever is easier to read on the accent color.
export function readableTextColor(hex: string) {
  const r = channel(parseInt(hex.slice(1, 3), 16))
  const g = channel(parseInt(hex.slice(3, 5), 16))
  const b = channel(parseInt(hex.slice(5, 7), 16))
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance > 0.179 ? '#111827' : '#ffffff'
}

export function applyAppearance(appearance: Appearance) {
  const root = document.documentElement
  root.setAttribute('data-theme', resolveTheme(appearance.mode))
  root.style.setProperty('--accent', appearance.accent)
  root.style.setProperty('--accent-text', readableTextColor(appearance.accent))
}
