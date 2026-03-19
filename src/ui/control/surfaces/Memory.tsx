import type { ReactNode } from 'react'

export interface SessionMemory {
  id: string
  channelId: string
  title: string
  compactSummary: string
  createdAt: string
  facts: number
  relevanceScore: number
}

interface MemoryProps {
  sessions: SessionMemory[]
  totalDocuments: number
  totalWords: number
  onSessionSelect?: (sessionId: string) => void
  children?: ReactNode
}

export function Memory(props: MemoryProps) {
  const { sessions = [], totalDocuments = 0, totalWords = 0, onSessionSelect } = props

  const recentSessions = sessions.slice(0, 12)

  return (
    <div className="nova-surface">
      <div className="nova-stack">
        <div className="nova-card">
          <h3>Session & Memory Management</h3>
          <p className="muted">
            Paxion maintains per-channel and per-workspace memory with embedding-based 
            retrieval indexing. Compact summaries preserve context while reducing token 
            overhead.
          </p>
        </div>

        <div className="nova-card">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div>
              <p className="muted">Library Documents</p>
              <strong style={{ fontSize: '1.5em', color: 'var(--accent-cyan)' }}>
                {totalDocuments}
              </strong>
            </div>
            <div>
              <p className="muted">Total Words Indexed</p>
              <strong style={{ fontSize: '1.5em', color: 'var(--accent-cyan)' }}>
                {(totalWords / 1000).toFixed(1)}K
              </strong>
            </div>
            <div>
              <p className="muted">Active Sessions</p>
              <strong style={{ fontSize: '1.5em', color: 'var(--accent-cyan)' }}>
                {sessions.length}
              </strong>
            </div>
          </div>
        </div>

        {recentSessions.length > 0 && (
          <div className="nova-card">
            <h3>Recent Sessions</h3>
            <div className="nova-memory-list">
              {recentSessions.map((session) => (
                <article
                  key={session.id}
                  className="nova-memory-item"
                  onClick={() => onSessionSelect?.(session.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="nova-item-head">
                    <strong>{session.title}</strong>
                    <span className="nova-relevance-score">
                      {session.relevanceScore}%
                    </span>
                  </div>
                  <p className="muted">{session.compactSummary}</p>
                  <p className="muted">
                    Channel: <strong>{session.channelId}</strong> | Facts: 
                    <strong> {session.facts}</strong>
                  </p>
                  <p className="muted">Created: {session.createdAt}</p>
                </article>
              ))}
            </div>
          </div>
        )}

        <div className="nova-card">
          <h3>Memory Architecture</h3>
          <ul className="muted">
            <li>
              <strong>Session Isolation:</strong> Per-channel and per-workspace memory 
              prevents cross-context leakage
            </li>
            <li>
              <strong>Compact Summaries:</strong> Embedding-powered summarization reduces 
              context token overhead
            </li>
            <li>
              <strong>Retrieval Index:</strong> Semantic search over document chunks and 
              compact facts for fast contextualization
            </li>
            <li>
              <strong>Learning Timeline:</strong> Audit trail of ingested documents and 
              learned skills over time
            </li>
            <li>
              <strong>Encrypted At Rest:</strong> All session data encrypted using OS 
              secure storage
            </li>
          </ul>
        </div>

        <div className="nova-card">
          <h3>Memory Operations</h3>
          <p className="muted">
            Use the Library tab to ingest new documents. Memory surfaces update 
            automatically with new sessions and retrieved facts.
          </p>
          <ul className="muted">
            <li>Ingest documents from files, URLs, or YouTube transcripts</li>
            <li>Query retrieval index for relevant context before execution</li>
            <li>Auto-summarize chat history into compact memory snapshots</li>
            <li>Migrate memory across devices via cloud relay with policy validation</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
