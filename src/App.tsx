import { useCallback, useEffect, useState } from 'react'
import Chat from './components/Chat'
import Icon from './components/Icon'
import MemoryPanel from './components/MemoryPanel'
import PrivacyPanel from './components/PrivacyPanel'
import SettingsPanel from './components/SettingsPanel'
import Sidebar from './components/Sidebar'
import ThemeSwitch from './components/ThemeSwitch'
import { AppearanceProvider } from './lib/AppearanceContext'
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

const COLLAPSE_KEY = 'mindmate-sidebar-collapsed'

function loadCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

function AppShell() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [view, setView] = useState<View>('chat')
  const [memoryVersion, setMemoryVersion] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<boolean>(loadCollapsed)

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

  // On small screens, Esc closes the slide-in menu.
  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  // On a phone this opens or closes the slide-in menu. On a bigger screen it
  // hides or shows the sidebar and remembers the choice.
  function toggleSidebar() {
    if (window.matchMedia('(max-width: 800px)').matches) {
      setSidebarOpen((open) => !open)
      return
    }
    setCollapsed((value) => {
      const next = !value
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        // Storage can be blocked. The sidebar still toggles for this visit.
      }
      return next
    })
  }

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
    <main className={collapsed ? 'app collapsed' : 'app'}>
      <div className={sidebarOpen ? 'sidebar-wrap open' : 'sidebar-wrap'}>
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          search={search}
          loadError={loadError}
          onSearchChange={setSearch}
          onSelect={(id) => {
            setActiveId(id)
            setView('chat')
            setSidebarOpen(false)
          }}
          onNew={() => {
            setActiveId(null)
            setView('chat')
            setSidebarOpen(false)
          }}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      </div>
      {sidebarOpen && (
        <button
          type="button"
          className="backdrop"
          aria-label="Close conversations"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="main-col">
        <div className="tabs" role="navigation" aria-label="Sections">
          <button
            type="button"
            className="menu-btn"
            aria-label="Show or hide conversations"
            title="Show or hide conversations"
            onClick={toggleSidebar}
          >
            <Icon name="menu" size={18} />
          </button>
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
          <ThemeSwitch />
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

export default function App() {
  return (
    <AppearanceProvider>
      <AppShell />
    </AppearanceProvider>
  )
}
