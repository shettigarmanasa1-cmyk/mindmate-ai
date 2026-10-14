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
