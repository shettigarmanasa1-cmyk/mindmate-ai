import { useEffect, useRef, useState } from 'react'
import Markdown from './Markdown'
import SuggestionCard from './SuggestionCard'
import { getConversation, sendChat } from '../lib/api'
import type { ChatMessage, Proposal, ProvidedMemory } from '../lib/api'

const SUGGESTIONS = [
  'Explain Python decorators in simple words',
  'Help me plan a small FastAPI project',
  'Give me tips for an AI engineer interview',
  'Explain SQL joins with an example',
]

// Copies the whole reply as written (Markdown symbols included).
function CopyReplyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // The browser may block clipboard access. Nothing else to do.
    }
  }

  return (
    <button type="button" className="reply-copy" onClick={copy} aria-label="Copy the whole reply">
      {copied ? 'Copied' : 'Copy reply'}
    </button>
  )
}

interface Props {
  conversationId: string | null
  onConversationChange: (id: string | null) => void
  onActivity: () => void
  onMemoryChange: () => void
}

export default function Chat({ conversationId, onConversationChange, onActivity, onMemoryChange }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [provided, setProvided] = useState<Record<string, ProvidedMemory[] | undefined>>({})
  const [suggestions, setSuggestions] = useState<Proposal[]>([])
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
      setSuggestions([])
      setError(null)
      return
    }
    if (conversationId === ownId.current) return
    ownId.current = null

    let cancelled = false
    setError(null)
    setMessages([])
    setSuggestions([])
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
  }, [messages, suggestions, loading])

  async function send(raw: string) {
    const text = raw.trim()
    if (!text || loading) return

    setError(null)
    setInput('')
    setSuggestions([])
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
      setProvided((current) => ({
        ...current,
        [result.assistant_message.id]: result.memories_provided,
      }))
      setSuggestions(result.proposed_memories)
      if (result.proposed_memories.length > 0) onMemoryChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
      onActivity()
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    send(input)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send(input)
    }
  }

  return (
    <section className="chat" aria-label="Chat">
      <h1 className="sr-only">MindMate AI chat</h1>

      <div className="messages" aria-live="polite">
        {messages.length === 0 && !loading && !error && (
          <div className="empty-state">
            <span className="brand-mark large" aria-hidden="true">
              M
            </span>
            <h2>How can I help today?</h2>
            <p>
              Ask anything. MindMate can remember useful things about you, but only after you approve them.
            </p>
            <div className="prompt-grid">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} type="button" className="prompt-card" onClick={() => send(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          const used = provided[m.id] ?? []
          return (
            <div key={m.id} className={`message ${m.role}`}>
              <span className="who">
                {m.role === 'assistant' && (
                  <span className="avatar" aria-hidden="true">
                    M
                  </span>
                )}
                {m.role === 'user' ? 'You' : 'MindMate'}
              </span>
              {m.role === 'assistant' ? <Markdown text={m.content} /> : <p>{m.content}</p>}
              {used.length > 0 && (
                <details className="provided">
                  <summary>
                    {used.length === 1
                      ? '1 memory provided to the AI'
                      : used.length + ' memories provided to the AI'}
                  </summary>
                  <ul>
                    {used.map((memory) => (
                      <li key={memory.id}>
                        {memory.content}{' '}
                        <span className="terms">(matched: {memory.matched_terms.join(', ')})</span>
                      </li>
                    ))}
                  </ul>
                  <p className="provided-note">
                    Provided means sent with your question. The AI may not have used it.
                  </p>
                </details>
              )}
              {m.role === 'assistant' && (
                <div className="reply-actions">
                  <CopyReplyButton text={m.content} />
                </div>
              )}
            </div>
          )
        })}

        {suggestions.map((proposal) => (
          <SuggestionCard
            key={proposal.id}
            proposal={proposal}
            onDecided={() => {
              setSuggestions((current) => current.filter((s) => s.id !== proposal.id))
              onMemoryChange()
            }}
          />
        ))}

        {loading && (
          <div className="typing" role="status" aria-label="MindMate is thinking">
            <span />
            <span />
            <span />
          </div>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <label htmlFor="message-input" className="sr-only">
          Your message
        </label>
        <textarea
          id="message-input"
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message MindMate..."
          maxLength={4000}
          readOnly={loading}
          autoComplete="off"
        />
        <button type="submit" className="send-btn" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
      <p className="composer-hint">Enter to send, Shift+Enter for a new line</p>
    </section>
  )
}
