import { useAppearance } from '../lib/AppearanceContext'
import type { ThemeMode } from '../lib/appearance'

const OPTIONS: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
]

export default function ThemeSwitch() {
  const { appearance, setMode } = useAppearance()
  return (
    <div className="theme-switch" role="group" aria-label="Theme">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={appearance.mode === option.id}
          onClick={() => setMode(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
