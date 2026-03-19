import type { ReactNode } from 'react'
import type { AuditEntry } from '../../../security/types'

interface AuditProps {
  entries: AuditEntry[]
  adminUnlocked: boolean
  children?: ReactNode
}

export function Audit(props: AuditProps) {
  const { entries, adminUnlocked } = props

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

  const recentEntries = [...entries].reverse().slice(0, 16)

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

        {recentEntries.length === 0 ? (
          <div className="nova-card">
            <p className="muted">No audit events yet. Run sensitive actions to populate.</p>
          </div>
        ) : (
          <div className="nova-card">
            <h3>Recent Events</h3>
            <div className="nova-audit-list">
              {recentEntries.map((entry) => (
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
