import { useEffect, useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import Icon from './Icon'
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

  // auto-hide: messages disappear by themselves after a few seconds.
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 5000)
    return () => clearTimeout(timer)
  }, [message])

  useEffect(() => {
    if (!error || !info) return
    const timer = setTimeout(() => setError(null), 6000)
    return () => clearTimeout(timer)
  }, [error, info])
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
      setMessage('Export downloaded. It contains your full chat text, so keep it private.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export your data.')
    }
  }

  async function handleDelete(kind: 'chats' | 'memories') {
    setConfirming(null)
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  return (
    <section className="page-panel" aria-label="Privacy and data">
      <div>
        <h2>Privacy and data</h2>
        <p className="hint">See what MindMate keeps, what leaves this app, and how to remove it.</p>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && !error && (
        <p className="success" role="status">
          {message}
        </p>
      )}

      {!info && !error && <p className="hint">Loading...</p>}

      {info && (
        <>
          <div className="card">
            <div className="card-head">
              <span className="icon-badge">
                <Icon name="database" />
              </span>
              <h3>What is stored</h3>
            </div>
            <p className="hint">{info.storage_location}</p>
            <ul>
              {info.stored.map((item) => (
                <li key={item.table}>{item.what}</li>
              ))}
            </ul>
          </div>

          <div className="card">
            <div className="card-head">
              <span className="icon-badge">
                <Icon name="send" />
              </span>
              <h3>What is sent to the AI provider</h3>
            </div>
            <ul>
              {info.sent_to_ai_provider.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="hint">
              The provider you configured receives this text and handles it under its own terms. This app does
              not control what the provider does with it.
            </p>
          </div>

          <div className="card">
            <div className="card-head">
              <span className="icon-badge">
                <Icon name="lock" />
              </span>
              <h3>What is not stored in the database</h3>
            </div>
            <ul>
              {info.not_stored_in_database.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="hint">
              This is a local app with no sign-in, and it has not had a security review. Do not expose it to the
              public internet as it is.
            </p>
          </div>
        </>
      )}

      <div className="card">
        <div className="card-head">
          <span className="icon-badge">
            <Icon name="shield" />
          </span>
          <h3>Your controls</h3>
        </div>

        <div className="control-row">
          <div>
            <strong>Export my data</strong>
            <p className="hint">
              Downloads one readable file with your conversations, memories and settings. It never includes
              your API key.
            </p>
          </div>
          <button type="button" className="with-icon" onClick={handleExport}>
            <Icon name="download" size={16} />
            Export
          </button>
        </div>

        <div className="control-row">
          <div>
            <strong>Delete all conversations</strong>
            <p className="hint">Removes every chat and its messages. Saved memories are not affected.</p>
          </div>
          <button type="button" className="danger-btn with-icon" onClick={() => setConfirming('chats')}>
            <Icon name="trash" size={16} />
            Delete
          </button>
        </div>

        <div className="control-row">
          <div>
            <strong>Clear all memories</strong>
            <p className="hint">Removes every saved memory. Your conversations are not affected.</p>
          </div>
          <button type="button" className="danger-btn with-icon" onClick={() => setConfirming('memories')}>
            <Icon name="trash" size={16} />
            Clear
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirming === 'chats'}
        title="Delete all conversations?"
        message="Every chat and its messages will be removed. This cannot be undone. Saved memories are not affected."
        confirmLabel="Delete all"
        danger
        onConfirm={() => handleDelete('chats')}
        onCancel={() => setConfirming(null)}
      />

      <ConfirmDialog
        open={confirming === 'memories'}
        title="Clear all memories?"
        message="Every saved memory will be removed. This cannot be undone. Your conversations are not affected."
        confirmLabel="Clear all"
        danger
        onConfirm={() => handleDelete('memories')}
        onCancel={() => setConfirming(null)}
      />
    </section>
  )
}

