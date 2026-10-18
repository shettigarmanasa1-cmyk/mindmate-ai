import { useCallback, useEffect, useState } from 'react'
import Chat from './components/Chat'
import MemoryPanel from './components/MemoryPanel'
import Sidebar from './components/Sidebar'
import {
  deleteConversation,
  listConversations,
  renameConversation,
  searchConversations,
} from './lib/api'
import type { Conversation } from './lib/api'
import './App.css'

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [view, setView] = useState<'chat' | 'memories'>('chat')
  const [memoryVersion, setMemoryVersion] = useState(0)

  const bumpMemory = useCallback(() => setMemoryVersion((v) => v + 1), [])

  const refresh = useCallback(async () => {
    try {
      const query = search.trim()
      setConversations(query ? await searchConversations(query) : await listConversations())
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load conversations.')
    }
  }, [search])

  // Reload the list when the search text changes (after a short pause while typing).
  useEffect(() => {
    const timer = setTimeout(refresh, 250)
    return () => clearTimeout(timer)
  }, [refresh])

  async function handleRename(id: string, title: string) {
    await renameConversation(id, title)
    await refresh()
  }

  async function handleDelete(id: string) {
    await deleteConversation(id)
    if (id === activeId) setActiveId(null)
    await refresh()
  }

  return (
    <main className="app">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        search={search}
        loadError={loadError}
        onSearchChange={setSearch}
        onSelect={(id) => {
          setActiveId(id)
          setView('chat')
        }}
        onNew={() => {
          setActiveId(null)
          setView('chat')
        }}
        onRename={handleRename}
        onDelete={handleDelete}
      />
      <div className="main-col">
        <div className="tabs" role="navigation" aria-label="Sections">
          <button
            type="button"
            className={view === 'chat' ? 'tab active' : 'tab'}
            aria-current={view === 'chat' ? 'page' : undefined}
            onClick={() => setView('chat')}
          >
            Chat
          </button>
          <button
            type="button"
            className={view === 'memories' ? 'tab active' : 'tab'}
            aria-current={view === 'memories' ? 'page' : undefined}
            onClick={() => setView('memories')}
          >
            Memories
          </button>
        </div>
        <div className="pane" hidden={view !== 'chat'}>
          <Chat
            conversationId={activeId}
            onConversationChange={setActiveId}
            onActivity={refresh}
            onMemoryChange={bumpMemory}
          />
        </div>
        <div className="pane" hidden={view !== 'memories'}>
          <MemoryPanel version={memoryVersion} onChange={bumpMemory} />
        </div>
      </div>
    </main>
  )
}