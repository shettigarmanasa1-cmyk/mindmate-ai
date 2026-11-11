import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  DEFAULT_APPEARANCE,
  applyAppearance,
  clearAppearance,
  isHexColor,
  loadAppearance,
  saveAppearance,
} from './appearance'
import type { Appearance, ThemeMode } from './appearance'

interface AppearanceContextValue {
  appearance: Appearance
  setMode: (mode: ThemeMode) => void
  setAccent: (color: string) => void
  reset: () => void
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null)

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>(loadAppearance)

  // Apply the theme and accent color whenever they change.
  useEffect(() => {
    applyAppearance(appearance)
  }, [appearance])

  // In System mode, follow the operating system when it switches.
  useEffect(() => {
    if (appearance.mode !== 'system') return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyAppearance(appearance)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [appearance])

  function update(next: Appearance) {
    setAppearance(next)
    saveAppearance(next)
  }

  const value: AppearanceContextValue = {
    appearance,
    setMode: (mode) => update({ ...appearance, mode }),
    setAccent: (color) => {
      if (isHexColor(color)) update({ ...appearance, accent: color.toLowerCase() })
    },
    reset: () => {
      clearAppearance()
      setAppearance(DEFAULT_APPEARANCE)
    },
  }

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export function useAppearance() {
  const context = useContext(AppearanceContext)
  if (!context) throw new Error('useAppearance must be used inside AppearanceProvider')
  return context
}
