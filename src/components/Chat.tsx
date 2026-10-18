import { useEffect, useRef, useState } from 'react'
import { getConversation, sendChat } from '../lib/api'
import type { ChatMessage } from '../lib/api'

interface Props {
  conversationId: string | null
  onConversationChange: (id: string | null) => void
  onActivity: () => void
}

export default function Chat({ conversationId, onConversationChange, onActivity }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  // Remembers a conversation this component just created, so it is not reloaded.
  const ownId = useRef<string | null>(null)

  useEffect(() => {
    if (conversationId === null) {
      ownId.current = null
      setMessages([])
      setError(null)
      return
    }
    if (conversationId === ownId.current) return
    ownId.current = null

    let cancelled = false
    setError(null)
    setMessages([])
    getConversation(conversationId)
      .then((conversation) => {
        if (!cancelled) setMessages(conversation.messages)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this conversation.')
      })
    return () => {
      cancelled = true
    }
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend(event: React.FormEvent) {
    event.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    setError(null)
    setInput('')
    setLoading(true)

    const temp: ChatMessage = {
      id: 'temp-' + Date.now(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages((current) => [...current, temp])

    try {
      const result = await sendChat(text, conversationId)
      ownId.current = result.conversation_id
      onConversationChange(result.conversation_id)
      setMessages((current) => [
        ...current.filter((m) => m.id !== temp.id),
        result.user_message,
        result.assistant_message,
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
      onActivity()
    }
  }

  return (
    <section className="chat" aria-label="Chat">
      <header className="chat-header">
        <h1>MindMate AI</h1>
      </header>

      <div className="messages" aria-live="polite">
        {messages.length === 0 && !loading && !error && (
          <p className="empty">Say hello to start a conversation.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`message ${m.role}`}>
            <span className="who">{m.role === 'user' ? 'You' : 'MindMate'}</span>
            <p>{m.content}</p>
          </div>
        ))}
        {loading && <p className="loading">MindMate is thinking...</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form className="composer" onSubmit={handleSend}>
        <label htmlFor="message-input" className="sr-only">
          Your message
        </label>
        <input
          id="message-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          maxLength={4000}
          disabled={loading}
          autoComplete="off"
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </section>
  )
}