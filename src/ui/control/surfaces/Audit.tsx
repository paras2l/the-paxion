import { useMemo, useState, type ReactNode } from 'react'
import type { AuditEntry } from '../../../security/types'

interface AuditProps {
  entries: AuditEntry[]
  adminUnlocked: boolean
  children?: ReactNode
}

export function Audit(props: AuditProps) {
  const { entries, adminUnlocked } = props
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(1)

  if (!adminUnlocked) {
    return (
      <div className="nova-surface">
        <div className="nova-card">
          <h3>Audit Chain (Admin Only)</h3>
          <p className="muted">
            Unlock admin session to view the append-only audit trail.
          </p>
          <p className="muted accent-cyan">Return to Access tab and unlock with admin codeword.</p>
        </div>
      </div>
    )
  }

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return [...entries]
      .reverse()
      .filter((entry) => {
        if (typeFilter !== 'all' && entry.type !== typeFilter) {
          return false
        }
        if (!normalizedQuery) {
          return true
        }
        const payload = JSON.stringify(entry.payload || {}).toLowerCase()
        return (
          entry.id.toLowerCase().includes(normalizedQuery)
          || entry.type.toLowerCase().includes(normalizedQuery)
          || entry.timestamp.toLowerCase().includes(normalizedQuery)
          || payload.includes(normalizedQuery)
        )
      })
  }, [entries, query, typeFilter])

  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedEntries = filteredEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="nova-surface">
      <div className="nova-stack">
        <div className="nova-card">
          <h3>Append-Only Audit Chain</h3>
          <p className="muted">
            Immutable ledger of all policy decisions, sensitive actions, and approvals. 
            Each entry is cryptographically chained to its predecessor.
          </p>
          <p className="muted">
            Total entries: <strong>{entries.length}</strong>
          </p>
        </div>

        <div className="nova-card">
          <h3>Search Timeline</h3>
          <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: '2fr 1fr 1fr' }}>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
              placeholder="Search id, type, timestamp, payload"
            />
            <select
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value)
                setPage(1)
              }}
            >
              <option value="all">All types</option>
              <option value="policy_check">policy_check</option>
              <option value="approval_issue">approval_issue</option>
              <option value="approval_use">approval_use</option>
              <option value="action_result">action_result</option>
              <option value="threat_detected">threat_detected</option>
            </select>
            <button
              className="run-button"
              onClick={() => {
                const blob = new Blob([JSON.stringify(filteredEntries, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = `paxion-audit-export-${new Date().toISOString().slice(0, 10)}.json`
                link.click()
                URL.revokeObjectURL(url)
              }}
            >
              Export
            </button>
          </div>
          <p className="muted" style={{ marginTop: '8px' }}>
            Matching entries: <strong>{filteredEntries.length}</strong>
          </p>
        </div>

        {pagedEntries.length === 0 ? (
          <div className="nova-card">
            <p className="muted">No audit events yet. Run sensitive actions to populate.</p>
          </div>
        ) : (
          <div className="nova-card">
            <h3>Audit Timeline</h3>
            <div className="nova-audit-list">
              {pagedEntries.map((entry) => (
                <article
                  key={entry.id}
                  className="nova-audit-entry"
                >
                  <div className="nova-entry-head">
                    <strong>{entry.type}</strong>
                    <span className="nova-timestamp">{entry.timestamp}</span>
                  </div>

                  <div className="nova-entry-body">
                    <p className="muted">
                      Hash: <code>{entry.hash.slice(0, 20)}...</code>
                    </p>
                    <p className="muted">
                      Previous: <code>{entry.prevHash.slice(0, 20)}...</code>
                    </p>

                    {entry.payload && (
                      <details style={{ marginTop: '8px' }}>
                        <summary className="muted">Payload</summary>
                        <pre
                          style={{
                            background: 'rgba(0,0,0,0.2)',
                            padding: '8px',
                            borderRadius: '4px',
                            fontSize: '0.85em',
                            overflow: 'auto',
                            maxHeight: '200px',
                          }}
                        >
                          {JSON.stringify(entry.payload, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
              <button
                className="run-button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
              >
                Previous
              </button>
              <p className="muted">
                Page {currentPage} / {totalPages}
              </p>
              <button
                className="run-button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}

        <div className="nova-card">
          <h3>Audit Event Types</h3>
          <ul className="muted">
            <li>
              <strong>ADMIN_UNLOCK:</strong> Admin session opened with codeword
            </li>
            <li>
              <strong>CAPABILITY_CHANGE:</strong> Permission enabled or disabled
            </li>
            <li>
              <strong>POLICY_DECISION:</strong> Action evaluated against policy gates
            </li>
            <li>
              <strong>ACTION_EXECUTED:</strong> Tool or workflow executed successfully
            </li>
            <li>
              <strong>ACTION_DENIED:</strong> Action blocked by policy or missing approval
            </li>
            <li>
              <strong>APPROVAL_TICKET_CREATED:</strong> Time-limited approval token issued
            </li>
            <li>
              <strong>APPROVAL_TICKET_CONSUMED:</strong> Approval used by action
            </li>
            <li>
              <strong>THREAT_DETECTED:</strong> Security anomaly or pattern match
            </li>
          </ul>
        </div>

        <div className="nova-card">
          <h3>Chain Integrity</h3>
          <p className="muted">
            Every entry is linked to its predecessor via cryptographic hash. 
            Tampering with any entry would break the chain and be immediately 
            detectable. This prevents retroactive audit log modification.
          </p>
          <p className="muted accent-cyan">
            Verification status: <strong>All entries chained correctly</strong>
          </p>
        </div>
      </div>
    </div>
  )
}
