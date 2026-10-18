import { useState } from 'react'
import type { Conversation } from '../lib/api'

interface Props {
  conversations: Conversation[]
  activeId: string | null
  search: string
  loadError: string | null
  onSearchChange: (value: string) => void
  onSelect: (id: string) => void
  onNew: () => void
  onRename: (id: string, title: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function messageOf(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong.'
}

export default function Sidebar({
  conversations,
  activeId,
  search,
  loadError,
  onSearchChange,
  onSelect,
  onNew,
  onRename,
  onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function startEdit(conversation: Conversation) {
    setConfirmingId(null)
    setEditingId(conversation.id)
    setDraft(conversation.title)
    setError(null)
  }

  function startDelete(id: string) {
    setEditingId(null)
    setConfirmingId(id)
    setError(null)
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault()
    const title = draft.trim()
    if (!editingId || !title) {
      setError('Enter a title.')
      return
    }
    try {
      await onRename(editingId, title)
      setEditingId(null)
      setError(null)
    } catch (err) {
      setError(messageOf(err))
    }
  }

  async function confirmDelete(id: string) {
    try {
      await onDelete(id)
      setConfirmingId(null)
      setError(null)
    } catch (err) {
      setError(messageOf(err))
    }
  }

  const shownError = error ?? loadError

  return (
    <nav className="sidebar" aria-label="Conversations">
      <button type="button" className="new-btn" onClick={onNew}>
        New conversation
      </button>

      <label htmlFor="search-input" className="sr-only">
        Search conversations
      </label>
      <input
        id="search-input"
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search chats"
        maxLength={100}
        autoComplete="off"
      />

      {shownError && (
        <p className="error" role="alert">
          {shownError}
        </p>
      )}

      <ul className="conv-list">
        {conversations.length === 0 && (
          <li className="conv-empty">{search.trim() ? 'No chats match your search.' : 'No conversations yet.'}</li>
        )}
        {conversations.map((c) => (
          <li key={c.id} className={c.id === activeId ? 'conv active' : 'conv'}>
            {editingId === c.id ? (
              <form className="conv-edit" onSubmit={saveEdit}>
                <label htmlFor={'rename-' + c.id} className="sr-only">
                  Conversation title
                </label>
                <input
                  id={'rename-' + c.id}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  maxLength={100}
                  autoFocus
                />
                <button type="submit" className="mini-btn">
                  Save
                </button>
                <button type="button" className="mini-btn" onClick={() => setEditingId(null)}>
                  Cancel
                </button>
              </form>
            ) : confirmingId === c.id ? (
              <div className="conv-confirm">
                <span>Delete this chat?</span>
                <button type="button" className="mini-btn danger" onClick={() => confirmDelete(c.id)}>
                  Delete
                </button>
                <button type="button" className="mini-btn" onClick={() => setConfirmingId(null)}>
                  Keep
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="conv-title"
                  onClick={() => onSelect(c.id)}
                  aria-current={c.id === activeId ? 'true' : undefined}
                  title={c.title}
                >
                  {c.title}
                </button>
                <button
                  type="button"
                  className="mini-btn"
                  onClick={() => startEdit(c)}
                  aria-label={'Rename ' + c.title}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="mini-btn danger"
                  onClick={() => startDelete(c.id)}
                  aria-label={'Delete ' + c.title}
                >
                  Delete
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}