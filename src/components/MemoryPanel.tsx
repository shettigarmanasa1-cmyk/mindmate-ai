import { useCallback, useEffect, useState } from 'react'
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

  const [newText, setNewText] = useState('')
  const [newCategory, setNewCategory] = useState('general')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [draftCategory, setDraftCategory] = useState('general')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [confirmingClear, setConfirmingClear] = useState(false)

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

  async function run(action: () => Promise<unknown>, after?: () => void) {
    setError(null)
    try {
      await action()
      after?.()
      onChange()
    } catch (err) {
      setError(messageOf(err))
    }
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault()
    const text = newText.trim()
    if (!text) {
      setError('Enter a memory to save.')
      return
    }
    await run(() => createMemory(text, newCategory), () => setNewText(''))
  }

  function startEdit(memory: Memory) {
    setConfirmingId(null)
    setEditingId(memory.id)
    setDraft(memory.content)
    setDraftCategory(memory.category)
    setError(null)
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!editingId || !text) {
      setError('Enter some text for this memory.')
      return
    }
    await run(() => updateMemory(editingId, text, draftCategory), () => setEditingId(null))
  }

  function startDelete(id: string) {
    setEditingId(null)
    setConfirmingId(id)
    setError(null)
  }

  const shownError = error ?? loadError

  return (
    <section className="memory-panel" aria-label="Your memories">
      <div className="panel-head">
        <h2>Your memories</h2>
        {memories.length > 0 &&
          (confirmingClear ? (
            <span className="inline-confirm">
              Delete all {memories.length}?
              <button
                type="button"
                className="mini-btn danger"
                onClick={() => run(() => clearMemories(), () => setConfirmingClear(false))}
              >
                Delete all
              </button>
              <button type="button" className="mini-btn" onClick={() => setConfirmingClear(false)}>
                Keep
              </button>
            </span>
          ) : (
            <button type="button" className="mini-btn danger" onClick={() => setConfirmingClear(true)}>
              Clear all
            </button>
          ))}
      </div>

      <p className="hint">
        A memory is only saved after you approve it. Saved memories live in this app's local database.
        Relevant ones are sent to the AI provider along with your question.
      </p>

      {shownError && (
        <p className="error" role="alert">
          {shownError}
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

      <form className="mem-add" onSubmit={handleAdd}>
        <label htmlFor="new-memory" className="sr-only">
          New memory
        </label>
        <input
          id="new-memory"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Add a memory, like: User is learning SQL"
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
        <button type="submit">Add</button>
      </form>

      {memories.length === 0 ? (
        <div>
          <h3>No saved memories yet</h3>
          <p className="hint">Chat with MindMate and approve its suggestions, or add one above.</p>
        </div>
      ) : (
        <ul className="mem-list">
          {memories.map((memory) => (
            <li key={memory.id} className="mem-item">
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
                  <button type="submit" className="mini-btn">
                    Save
                  </button>
                  <button type="button" className="mini-btn" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </form>
              ) : confirmingId === memory.id ? (
                <div className="inline-confirm">
                  <span className="mem-text">Delete "{memory.content}"?</span>
                  <button
                    type="button"
                    className="mini-btn danger"
                    onClick={() => run(() => deleteMemory(memory.id), () => setConfirmingId(null))}
                  >
                    Delete
                  </button>
                  <button type="button" className="mini-btn" onClick={() => setConfirmingId(null)}>
                    Keep
                  </button>
                </div>
              ) : (
                <>
                  <span className="mem-text">{memory.content}</span>
                  <span className="badge">{memory.category}</span>
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => startEdit(memory)}
                    aria-label={'Edit ' + memory.content}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="mini-btn danger"
                    onClick={() => startDelete(memory.id)}
                    aria-label={'Delete ' + memory.content}
                  >
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}