import { useEffect, useState } from 'react'
import { getSettings, updateSettings } from '../lib/api'
import type { AppSettings } from '../lib/api'
import { PRESETS } from '../lib/appearance'
import type { ThemeMode } from '../lib/appearance'
import { useAppearance } from '../lib/AppearanceContext'

const MODES: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
]

export default function SettingsPanel() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const { appearance, setMode, setAccent, reset } = useAppearance()

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load settings.'))
  }, [])

  // auto-hide: the "Saved" note disappears by itself.
  useEffect(() => {
    if (status !== 'Saved') return
    const timer = setTimeout(() => setStatus(null), 2500)
    return () => clearTimeout(timer)
  }, [status])
  async function change(changes: Partial<AppSettings>) {
    setError(null)
    setStatus('Saving...')
    try {
      setSettings(await updateSettings(changes))
      setStatus('Saved')
    } catch (err) {
      setStatus(null)
      setError(err instanceof Error ? err.message : 'Could not save that setting.')
    }
  }

  const preset = PRESETS.find((p) => p.color === appearance.accent)
  const accentName = preset ? preset.name : 'Custom (' + appearance.accent + ')'

  return (
    <section className="page-panel" aria-label="Settings">
      <h2>Settings</h2>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="settings-section">
        <h3>Personalization</h3>
        <p className="hint">
          These are choices you make yourself. They are separate from memories, which you approve one by one.
        </p>

        {settings && (
          <div className="settings-form">
            <label className="check-row">
              <input
                type="checkbox"
                checked={settings.memory_enabled}
                onChange={(e) => change({ memory_enabled: e.target.checked })}
              />
              <span>
                Use memory for personalization
                <span className="hint block">
                  When off, saved memories are not sent to the AI and no new suggestions are made.
                </span>
              </span>
            </label>

            <label className="field">
              <span>Response style</span>
              <select
                value={settings.response_style}
                onChange={(e) => change({ response_style: e.target.value as AppSettings['response_style'] })}
              >
                <option value="friendly">Friendly</option>
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
              </select>
            </label>

            <label className="field">
              <span>Answer length</span>
              <select
                value={settings.answer_length}
                onChange={(e) => change({ answer_length: e.target.value as AppSettings['answer_length'] })}
              >
                <option value="short">Short</option>
                <option value="balanced">Balanced</option>
                <option value="detailed">Detailed</option>
              </select>
            </label>

            <label className="check-row">
              <input
                type="checkbox"
                checked={settings.beginner_friendly}
                onChange={(e) => change({ beginner_friendly: e.target.checked })}
              />
              <span>Beginner-friendly explanations</span>
            </label>

            <p className="status" role="status">
              {status}
            </p>
          </div>
        )}

        {!settings && !error && <p className="hint">Loading settings...</p>}
      </div>

      <div className="settings-section">
        <h3>Appearance</h3>
        <p className="hint">Changes apply right away and are remembered in this browser.</p>

        <div className="field">
          <span>Theme</span>
          <div className="segmented" role="group" aria-label="Theme">
            {MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                aria-pressed={appearance.mode === mode.id}
                onClick={() => setMode(mode.id)}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <span className="hint">System follows your device's light or dark setting.</span>
        </div>

        <div className="field">
          <span>Accent color</span>
          <div className="swatches">
            {PRESETS.map((p) => (
              <button
                key={p.color}
                type="button"
                className="swatch"
                style={{ background: p.color }}
                aria-label={p.name}
                title={p.name}
                aria-pressed={appearance.accent === p.color}
                onClick={() => setAccent(p.color)}
              />
            ))}
          </div>
          <label className="custom-color">
            <input
              type="color"
              value={appearance.accent}
              onChange={(e) => setAccent(e.target.value)}
              aria-label="Custom accent color"
            />
            <span>Pick any color</span>
          </label>
          <span className="hint">Selected: {accentName}</span>
        </div>

        <div className="field">
          <span>Preview</span>
          <div className="preview" aria-label="Appearance preview">
            <div className="bubble-user">How do I add a route in FastAPI?</div>
            <div className="bubble-ai">
              Use a router decorator. See{' '}
              <a href="#preview" onClick={(e) => e.preventDefault()}>
                the docs
              </a>{' '}
              for more.
            </div>
            <div className="preview-row">
              <button type="button" className="primary-btn">
                Primary button
              </button>
              <button type="button">Secondary</button>
              <label className="check-row">
                <input type="checkbox" defaultChecked />
                <span>Checkbox</span>
              </label>
            </div>
          </div>
        </div>

        <div>
          <button type="button" onClick={reset}>
            Reset to defaults
          </button>
        </div>
      </div>
    </section>
  )
}

