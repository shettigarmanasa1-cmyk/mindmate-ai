import { useEffect, useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
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
  const [menuId, setMenuId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Close the three-dot menu when clicking elsewhere or pressing Esc.
  useEffect(() => {
    if (!menuId) return
    const onDown = (event: MouseEvent) => {
      const target = event.target as Element | null
      if (!target?.closest('[data-conv-menu]')) setMenuId(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuId(null)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuId])

  // Error messages disappear by themselves.
  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(null), 6000)
    return () => clearTimeout(timer)
  }, [error])

  function startEdit(conversation: Conversation) {
    setMenuId(null)
    setEditingId(conversation.id)
    setDraft(conversation.title)
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

  async function confirmDelete() {
    const target = pendingDelete
    setPendingDelete(null)
    if (!target) return
    try {
      await onDelete(target.id)
      setError(null)
    } catch (err) {
      setError(messageOf(err))
    }
  }

  const shownError = error ?? loadError

  return (
    <nav className="sidebar" aria-label="Conversations">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          M
        </span>
        <span className="brand-name">MindMate AI</span>
      </div>

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
                <span className="conv-more-wrap" data-conv-menu>
                  <button
                    type="button"
                    className="conv-more"
                    aria-label={'Actions for ' + c.title}
                    aria-haspopup="menu"
                    aria-expanded={menuId === c.id}
                    onClick={() => setMenuId(menuId === c.id ? null : c.id)}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <circle cx="5" cy="12" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="19" cy="12" r="2" />
                    </svg>
                  </button>
                  {menuId === c.id && (
                    <div className="conv-menu" role="menu">
                      <button type="button" role="menuitem" onClick={() => startEdit(c)}>
                        Rename
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="danger"
                        onClick={() => {
                          setMenuId(null)
                          setPendingDelete(c)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this chat?"
        message={pendingDelete ? '"' + pendingDelete.title + '" and its messages will be removed. This cannot be undone.' : ''}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </nav>
  )
}
