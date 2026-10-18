// All talking to the backend happens in this one file.

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface ProvidedMemory {
  id: string
  content: string
  matched_terms: string[]
  score: number
}

export interface Proposal {
  id: string
  content: string
  category: string
  status: string
  replaces_memory_id: string | null
  old_content: string | null
}

export interface ChatResponse {
  conversation_id: string
  title: string
  user_message: ChatMessage
  assistant_message: ChatMessage
  memories_provided: ProvidedMemory[]
  proposed_memories: Proposal[]
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// Turns any failure into a short message that is safe to show the user.
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0)
  }

  if (!response.ok) {
    let message = 'Something went wrong. Please try again.'
    try {
      const data = await response.json()
      if (typeof data.detail === 'string') message = data.detail
      else if (response.status === 422) message = 'That input is not valid.'
    } catch {
      // keep the default message
    }
    throw new ApiError(message, response.status)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export function sendChat(message: string, conversationId: string | null) {
  return request<ChatResponse>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message, conversation_id: conversationId }),
  })
}


export interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface ConversationDetail extends Conversation {
  messages: ChatMessage[]
}

export function listConversations() {
  return request<Conversation[]>('/api/conversations')
}

export function searchConversations(query: string) {
  return request<Conversation[]>('/api/conversations/search?q=' + encodeURIComponent(query))
}

export function getConversation(id: string) {
  return request<ConversationDetail>('/api/conversations/' + encodeURIComponent(id))
}

export function renameConversation(id: string, title: string) {
  return request<Conversation>('/api/conversations/' + encodeURIComponent(id), {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  })
}

export function deleteConversation(id: string) {
  return request<void>('/api/conversations/' + encodeURIComponent(id), {
    method: 'DELETE',
  })
}

export interface Memory {
  id: string
  content: string
  category: string
  keywords: string
  created_at: string
  updated_at: string
}

export function listMemories() {
  return request<Memory[]>('/api/memories')
}

export function createMemory(content: string, category: string) {
  return request<Memory>('/api/memories', {
    method: 'POST',
    body: JSON.stringify({ content, category }),
  })
}

export function updateMemory(id: string, content: string, category: string) {
  return request<Memory>('/api/memories/' + encodeURIComponent(id), {
    method: 'PATCH',
    body: JSON.stringify({ content, category }),
  })
}

export function deleteMemory(id: string) {
  return request<void>('/api/memories/' + encodeURIComponent(id), {
    method: 'DELETE',
  })
}

export function clearMemories() {
  return request<{ deleted: number }>('/api/memories?confirm=true', {
    method: 'DELETE',
  })
}

export function listProposals() {
  return request<Proposal[]>('/api/memories/proposals')
}

export function approveProposal(id: string) {
  return request<{ replaced: boolean }>(
    '/api/memories/proposals/' + encodeURIComponent(id) + '/approve',
    { method: 'POST' },
  )
}

export function rejectProposal(id: string) {
  return request<Proposal>('/api/memories/proposals/' + encodeURIComponent(id) + '/reject', {
    method: 'POST',
  })
}
export interface AppSettings {
  memory_enabled: boolean
  response_style: 'friendly' | 'professional' | 'casual'
  answer_length: 'short' | 'balanced' | 'detailed'
  beginner_friendly: boolean
}

export function getSettings() {
  return request<AppSettings>('/api/settings')
}

export function updateSettings(changes: Partial<AppSettings>) {
  return request<AppSettings>('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(changes),
  })
}

export interface DataInfo {
  storage_location: string
  stored: { what: string; table: string }[]
  sent_to_ai_provider: string[]
  not_stored_in_database: string[]
  your_controls: string[]
}

export function getDataInfo() {
  return request<DataInfo>('/api/data-info')
}

export function exportData() {
  return request<unknown>('/api/export')
}

export function deleteAllConversations() {
  return request<{ deleted: number }>('/api/conversations?confirm=true', {
    method: 'DELETE',
  })
}
