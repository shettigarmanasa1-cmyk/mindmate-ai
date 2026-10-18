import { useCallback, useEffect, useState } from 'react'
import Chat from './components/Chat'
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
        onSelect={setActiveId}
        onNew={() => setActiveId(null)}
        onRename={handleRename}
        onDelete={handleDelete}
      />
      <Chat conversationId={activeId} onConversationChange={setActiveId} onActivity={refresh} />
    </main>
  )
}