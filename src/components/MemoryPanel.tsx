import { useCallback, useEffect, useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import SuggestionCard from './SuggestionCard'
import {
  clearMemories,
  createMemory,
  deleteMemory,
  listMemories,
  listProposals,
  updateMemory,
} from '../lib/api'
import type { Memory, Proposal } from '../lib/api'

const CATEGORIES = ['preference', 'goal', 'project', 'skill', 'general']

interface Props {
  version: number
  onChange: () => void
}

function messageOf(err: unknown) {
  return err instanceof Error ? err.message : 'Something went wrong.'
}

export default function MemoryPanel({ version, onChange }: Props) {
  const [memories, setMemories] = useState<Memory[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [newText, setNewText] = useState('')
  const [newCategory, setNewCategory] = useState('general')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [draftCategory, setDraftCategory] = useState('general')

  const [pendingDelete, setPendingDelete] = useState<Memory | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const load = useCallback(async () => {
    try {
      const [savedMemories, pending] = await Promise.all([listMemories(), listProposals()])
      setMemories(savedMemories)
      setProposals(pending)
      setLoadError(null)
    } catch (err) {
      setLoadError(messageOf(err))
    }
  }, [])

  // Reload on first show, and whenever something changes memories (version goes up).
  useEffect(() => {
    load()
  }, [load, version])

  // auto-hide: messages disappear by themselves after a few seconds.
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(null), 6000)
    return () => clearTimeout(timer)
  }, [error])
  async function run(action: () => Promise<unknown>, done: string, after?: () => void) {
    setError(null)
    setNotice(null)
    try {
      await action()
      after?.()
      setNotice(done)
      onChange()
    } catch (err) {
      setError(messageOf(err))
    }
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    const text = newText.trim()
    if (!text) {
      setNotice(null)
      setError('Enter a memory to save.')
      return
    }
    await run(() => createMemory(text, newCategory), 'Memory added.', () => setNewText(''))
  }

  function startEdit(memory: Memory) {
    setEditingId(memory.id)
    setDraft(memory.content)
    setDraftCategory(memory.category)
    setError(null)
    setNotice(null)
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!editingId || !text) {
      setNotice(null)
      setError('Enter some text for this memory.')
      return
    }
    await run(() => updateMemory(editingId, text, draftCategory), 'Memory updated.', () => setEditingId(null))
  }

  async function confirmDeleteOne() {
    const target = pendingDelete
    setPendingDelete(null)
    if (target) await run(() => deleteMemory(target.id), 'Memory deleted.')
  }

  async function confirmClearAll() {
    setConfirmClear(false)
    await run(() => clearMemories(), 'All memories cleared.')
  }

  const shownError = error ?? loadError

  return (
    <section className="memory-panel" aria-label="Your memories">
      <div className="panel-head">
        <div>
          <h2>Your memories</h2>
          <p className="hint">
            A memory is saved only after you approve it. Saved memories live in this app's local database.
            Relevant ones are sent to the AI provider along with your question.
          </p>
        </div>
        {memories.length > 0 && (
          <button type="button" className="danger-btn" onClick={() => setConfirmClear(true)}>
            Clear all
          </button>
        )}
      </div>

      {shownError && (
        <p className="error" role="alert">
          {shownError}
        </p>
      )}
      {notice && !shownError && (
        <p className="success" role="status">
          {notice}
        </p>
      )}

      {proposals.length > 0 && (
        <div className="suggestions">
          <h3>Suggestions waiting for you</h3>
          {proposals.map((proposal) => (
            <SuggestionCard key={proposal.id} proposal={proposal} onDecided={onChange} />
          ))}
        </div>
      )}

      <form className="card mem-form" onSubmit={handleAdd}>
        <h3>Add a memory</h3>
        <div className="mem-add">
          <label htmlFor="new-memory" className="sr-only">
            New memory
          </label>
          <input
            id="new-memory"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="For example: User is learning SQL"
            maxLength={300}
            autoComplete="off"
          />
          <label htmlFor="new-category" className="sr-only">
            Category
          </label>
          <select id="new-category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <button type="submit" className="primary-btn">
            Add
          </button>
        </div>
      </form>

      {memories.length === 0 ? (
        <div className="card empty-card">
          <h3>No saved memories yet</h3>
          <p className="hint">Chat with MindMate and approve its suggestions, or add one above.</p>
        </div>
      ) : (
        <ul className="mem-list">
          {memories.map((memory) => (
            <li key={memory.id} className="mem-card">
              {editingId === memory.id ? (
                <form className="mem-edit" onSubmit={saveEdit}>
                  <label htmlFor={'edit-' + memory.id} className="sr-only">
                    Memory text
                  </label>
                  <input
                    id={'edit-' + memory.id}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={300}
                    autoFocus
                  />
                  <label htmlFor={'edit-cat-' + memory.id} className="sr-only">
                    Category
                  </label>
                  <select
                    id={'edit-cat-' + memory.id}
                    value={draftCategory}
                    onChange={(e) => setDraftCategory(e.target.value)}
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="primary-btn">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <span className="mem-text">{memory.content}</span>
                  <span className="badge">{memory.category}</span>
                  <div className="mem-actions">
                    <button type="button" onClick={() => startEdit(memory)} aria-label={'Edit ' + memory.content}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="danger-btn"
                      onClick={() => setPendingDelete(memory)}
                      aria-label={'Delete ' + memory.content}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this memory?"
        message={pendingDelete ? '"' + pendingDelete.content + '" will be removed. This cannot be undone.' : ''}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDeleteOne}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={confirmClear}
        title="Clear all memories?"
        message={'All ' + memories.length + ' saved memories will be removed. Your conversations are not affected.'}
        confirmLabel="Clear all"
        danger
        onConfirm={confirmClearAll}
        onCancel={() => setConfirmClear(false)}
      />
    </section>
  )
}

