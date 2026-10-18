import { useState } from 'react'
import { approveProposal, rejectProposal } from '../lib/api'
import type { Proposal } from '../lib/api'

interface Props {
  proposal: Proposal
  onDecided: () => void
}

export default function SuggestionCard({ proposal, onDecided }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const replaces = proposal.replaces_memory_id !== null

  async function decide(action: 'approve' | 'reject') {
    setBusy(true)
    setError(null)
    try {
      if (action === 'approve') await approveProposal(proposal.id)
      else await rejectProposal(proposal.id)
      onDecided()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <div className="suggestion" role="group" aria-label="Memory suggestion">
      <p className="suggestion-title">{replaces ? 'Update a saved memory?' : 'Save this to memory?'}</p>
      {replaces && proposal.old_content && (
        <p className="suggestion-old">Currently saved: {proposal.old_content}</p>
      )}
      <p className="suggestion-text">{proposal.content}</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="suggestion-actions">
        <button type="button" className="primary-btn" disabled={busy} onClick={() => decide('approve')}>
          {replaces ? 'Replace' : 'Save'}
        </button>
        <button type="button" disabled={busy} onClick={() => decide('reject')}>
          {replaces ? 'Keep old' : "Don't save"}
        </button>
      </div>
    </div>
  )
}