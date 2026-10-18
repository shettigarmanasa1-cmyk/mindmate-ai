import { useCallback, useEffect, useState } from 'react'
import Chat from './components/Chat'
import MemoryPanel from './components/MemoryPanel'
import PrivacyPanel from './components/PrivacyPanel'
import SettingsPanel from './components/SettingsPanel'
import Sidebar from './components/Sidebar'
import {
  deleteConversation,
  listConversations,
  renameConversation,
  searchConversations,
} from './lib/api'
import type { Conversation } from './lib/api'
import './App.css'

type View = 'chat' | 'memories' | 'settings' | 'privacy'

const TABS: { id: View; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'memories', label: 'Memories' },
  { id: 'settings', label: 'Settings' },
  { id: 'privacy', label: 'Privacy' },
]

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [view, setView] = useState<View>('chat')
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

  function handleAllConversationsDeleted() {
    setActiveId(null)
    refresh()
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
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={view === tab.id ? 'tab active' : 'tab'}
              aria-current={view === tab.id ? 'page' : undefined}
              onClick={() => setView(tab.id)}
            >
              {tab.label}
            </button>
          ))}
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
        <div className="pane" hidden={view !== 'settings'}>
          <SettingsPanel />
        </div>
        <div className="pane" hidden={view !== 'privacy'}>
          <PrivacyPanel
            onConversationsDeleted={handleAllConversationsDeleted}
            onMemoryChange={bumpMemory}
          />
        </div>
      </div>
    </main>
  )
}