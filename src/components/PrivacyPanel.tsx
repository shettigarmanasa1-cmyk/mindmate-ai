import { useEffect, useState } from 'react'
import { clearMemories, deleteAllConversations, exportData, getDataInfo } from '../lib/api'
import type { DataInfo } from '../lib/api'

interface Props {
  onConversationsDeleted: () => void
  onMemoryChange: () => void
}

export default function PrivacyPanel({ onConversationsDeleted, onMemoryChange }: Props) {
  const [info, setInfo] = useState<DataInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<'chats' | 'memories' | null>(null)

  useEffect(() => {
    getDataInfo()
      .then(setInfo)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load this information.'))
  }, [])

  async function handleExport() {
    setError(null)
    setMessage(null)
    try {
      const data = await exportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'mindmate-export.json'
      link.click()
      URL.revokeObjectURL(url)
      setMessage('Export downloaded.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export your data.')
    }
  }

  async function handleDelete(kind: 'chats' | 'memories') {
    setError(null)
    setMessage(null)
    try {
      if (kind === 'chats') {
        const result = await deleteAllConversations()
        setMessage('Deleted ' + result.deleted + ' conversation(s).')
        onConversationsDeleted()
      } else {
        const result = await clearMemories()
        setMessage('Deleted ' + result.deleted + ' memory(ies).')
        onMemoryChange()
      }
      setConfirming(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  return (
    <section className="page-panel" aria-label="Privacy and data">
      <h2>Privacy and data</h2>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}

      {info && (
        <div className="privacy-info">
          <h3>Where your data is stored</h3>
          <p>{info.storage_location}</p>

          <h3>What is stored</h3>
          <ul>
            {info.stored.map((item) => (
              <li key={item.table}>{item.what}</li>
            ))}
          </ul>

          <h3>What is sent to the AI provider</h3>
          <ul>
            {info.sent_to_ai_provider.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h3>What is not stored in the database</h3>
          <ul>
            {info.not_stored_in_database.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <h3>Your controls</h3>
      <div className="control-row">
        <div>
          <strong>Export my data</strong>
          <p className="hint">
            Downloads one readable file with your conversations, memories and settings. It contains your
            full chat text, so keep it private.
          </p>
        </div>
        <button type="button" onClick={handleExport}>
          Export
        </button>
      </div>

      <div className="control-row">
        <div>
          <strong>Delete all conversations</strong>
          <p className="hint">Removes every chat and its messages. Saved memories are not affected.</p>
        </div>
        {confirming === 'chats' ? (
          <span className="inline-confirm">
            Are you sure?
            <button type="button" className="mini-btn danger" onClick={() => handleDelete('chats')}>
              Delete all
            </button>
            <button type="button" className="mini-btn" onClick={() => setConfirming(null)}>
              Keep
            </button>
          </span>
        ) : (
          <button type="button" className="danger-btn" onClick={() => setConfirming('chats')}>
            Delete
          </button>
        )}
      </div>

      <div className="control-row">
        <div>
          <strong>Clear all memories</strong>
          <p className="hint">Removes every saved memory. Your conversations are not affected.</p>
        </div>
        {confirming === 'memories' ? (
          <span className="inline-confirm">
            Are you sure?
            <button type="button" className="mini-btn danger" onClick={() => handleDelete('memories')}>
              Clear all
            </button>
            <button type="button" className="mini-btn" onClick={() => setConfirming(null)}>
              Keep
            </button>
          </span>
        ) : (
          <button type="button" className="danger-btn" onClick={() => setConfirming('memories')}>
            Clear
          </button>
        )}
      </div>
    </section>
  )
}