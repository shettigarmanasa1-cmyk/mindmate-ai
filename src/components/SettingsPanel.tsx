import { useEffect, useState } from 'react'
import { getSettings, updateSettings } from '../lib/api'
import type { AppSettings } from '../lib/api'

export default function SettingsPanel() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load settings.'))
  }, [])

  async function change(changes: Partial<AppSettings>) {
    setError(null)
    setStatus(null)
    try {
      setSettings(await updateSettings(changes))
      setStatus('Saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that setting.')
    }
  }

  return (
    <section className="page-panel" aria-label="Settings">
      <h2>Settings</h2>
      <p className="hint">
        These are choices you make yourself. They are separate from memories, which you approve one by one.
      </p>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

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
    </section>
  )
}
