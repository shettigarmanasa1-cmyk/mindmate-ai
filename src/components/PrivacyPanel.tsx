
import { useEffect, useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import Icon from './Icon'
import {
  clearMemories,
  deleteAllConversations,
  exportData,
  getDataInfo,
} from '../lib/api'
import type { DataInfo } from '../lib/api'

interface Props {
  onConversationsDeleted: () => void
  onMemoryChange: () => void
}

export default function PrivacyPanel({
  onConversationsDeleted,
  onMemoryChange,
}: Props) {
  const [info, setInfo] = useState<DataInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<'chats' | 'memories' | null>(
    null
  )

  useEffect(() => {
    getDataInfo()
      .then(setInfo)
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : 'Could not load this information.'
        )
      )
  }, [])

  // Automatically hide success messages.
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 5000)
    return () => clearTimeout(timer)
  }, [message])

  // Automatically hide errors after a few seconds.
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
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = 'mindmate-export.json'
      link.click()

      URL.revokeObjectURL(url)

      setMessage(
        'Export downloaded. It contains your full chat text, so keep it private.'
      )
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not export your data.'
      )
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
        <p className="hint">
          Understand what MindMate stores, what information is shared with the
          AI provider, and how you can manage or delete your data.
        </p>
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

      {!info && !error && <p className="hint">Loading privacy information...</p>}

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

            <p>The following information is stored by MindMate:</p>

            <ul>
              {info.stored.map((item) => (
                <li key={item.table}>{item.what}</li>
              ))}
            </ul>

            <p className="hint">
              Your conversations, memories, and settings are stored locally by
              the backend in its SQLite database.
            </p>
          </div>

          <div className="card">
            <div className="card-head">
              <span className="icon-badge">
                <Icon name="send" />
              </span>
              <h3>What is sent to the AI provider</h3>
            </div>

            <p>
              MindMate sends information to your configured AI provider when
              you send a message and request a reply.
            </p>

            <ul>
              <li>
                Your latest message and recent messages from the current
                conversation.
              </li>
              <li>
                Relevant saved memories, only when memory is enabled.
              </li>
              <li>
                Your selected response instructions when you choose
                non-default personalization settings.
              </li>
            </ul>

            <p className="hint">
              When memory is turned off, saved memories are not included in AI
              requests, and no new memory suggestions are created. Your chat
              messages are still sent to the AI provider. Turning memory off
              does not delete existing memories or conversations.
            </p>

            <p className="hint">
              The configured AI provider receives the information sent by
              MindMate and handles it under its own terms. MindMate does not
              control how the provider processes or retains that information.
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
              The API key is kept in the backend/.env configuration file and
              is not included in the database or data export.
            </p>

            <p className="hint">
              MindMate is currently a local application with no user sign-in.
              It has not undergone a security review. Do not expose it to the
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
              Downloads a JSON file containing your conversations, messages,
              saved memories, memory suggestions, and settings. It does not
              include your API key. Keep the downloaded file private.
            </p>
          </div>

          <button
            type="button"
            className="with-icon"
            onClick={handleExport}
          >
            <Icon name="download" size={16} />
            Export
          </button>
        </div>

        <div className="control-row">
          <div>
            <strong>Delete all conversations</strong>
            <p className="hint">
              Removes all conversations and their messages. Your saved
              memories and settings are not affected.
            </p>
          </div>

          <button
            type="button"
            className="danger-btn with-icon"
            onClick={() => setConfirming('chats')}
          >
            <Icon name="trash" size={16} />
            Delete
          </button>
        </div>

        <div className="control-row">
          <div>
            <strong>Clear all memories</strong>
            <p className="hint">
              Removes all saved memories and memory suggestions. Your
              conversations and settings are not affected.
            </p>
          </div>

          <button
            type="button"
            className="danger-btn with-icon"
            onClick={() => setConfirming('memories')}
          >
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
        message="Every saved memory and memory suggestion will be removed. This cannot be undone. Your conversations are not affected."
        confirmLabel="Clear all"
        danger
        onConfirm={() => handleDelete('memories')}
        onCancel={() => setConfirming(null)}
      />
    </section>
  )
}
