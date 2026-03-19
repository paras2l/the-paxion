import type { ReactNode } from 'react'

export interface ExecutionQueueItem {
  id: string
  actionId: string
  status: 'pending' | 'approved' | 'denied' | 'executing' | 'completed' | 'failed'
  requestedAt: string
  approvedAt?: string
  completedAt?: string
  detail?: string
}

interface ToolsProps {
  queueItems: ExecutionQueueItem[]
  onApprove?: (itemId: string) => void
  onDeny?: (itemId: string) => void
  children?: ReactNode
}

export function Tools(props: ToolsProps) {
  const { queueItems = [], onApprove, onDeny } = props

  const pendingApprovals = queueItems.filter((item) => item.status === 'pending')
  const recentCompleted = queueItems
    .filter((item) => item.status === 'completed' || item.status === 'failed')
    .slice(0, 8)

  return (
    <div className="nova-surface">
      <div className="nova-stack">
        <div className="nova-card">
          <h3>Tool Execution Queue</h3>
          <p className="muted">
            Sensitive actions are queued for explicit approval. All executions are recorded 
            in the immutable audit chain.
          </p>
        </div>

        {pendingApprovals.length > 0 && (
          <div className="nova-card">
            <h3>Approvals Pending</h3>
            <div className="nova-grid-cards">
              {pendingApprovals.map((item) => (
                <article key={item.id} className="nova-approval-card">
                  <div className="nova-card-head">
                    <strong>{item.actionId}</strong>
                    <span className="nova-status-badge">PENDING</span>
                  </div>
                  <p className="muted">Requested: {item.requestedAt}</p>
                  {item.detail && <p className="muted">{item.detail}</p>}
                  <div
                    className="nova-approval-actions"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      marginTop: '12px',
                    }}
                  >
                    <button
                      className="run-button"
                      onClick={() => onApprove?.(item.id)}
                      style={{ background: 'var(--accent-green)' }}
                    >
                      Approve
                    </button>
                    <button
                      className="run-button"
                      onClick={() => onDeny?.(item.id)}
                      style={{ background: 'var(--accent-red)' }}
                    >
                      Deny
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {recentCompleted.length > 0 && (
          <div className="nova-card">
            <h3>Recent Executions</h3>
            <div className="nova-execution-list">
              {recentCompleted.map((item) => (
                <article
                  key={item.id}
                  className={`nova-execution-item nova-execution-${item.status}`}
                >
                  <div className="nova-item-head">
                    <strong>{item.actionId}</strong>
                    <span
                      className={`nova-status-badge nova-status-${item.status}`}
                    >
                      {item.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="muted">
                    Completed: {item.completedAt || item.approvedAt || 'pending'}
                  </p>
                  {item.detail && <p className="muted">{item.detail}</p>}
                </article>
              ))}
            </div>
          </div>
        )}

        <div className="nova-card">
          <h3>Policy-Gated Execution</h3>
          <p className="muted">
            All tool execution flows through immutable policy gates:
          </p>
          <ul className="muted">
            <li>
              <strong>Sensitive Actions:</strong> Require admin codeword verification 
              ("paro the chief")
            </li>
            <li>
              <strong>Privileged Gates:</strong> Master-gated actions require 
              "paro the master" codeword
            </li>
            <li>
              <strong>Approval Tickets:</strong> Complex workflows can require multi-step 
              approval chains
            </li>
            <li>
              <strong>Audit Trail:</strong> All decisions recorded in append-only 
              immutable ledger
            </li>
          </ul>
        </div>

        <div className="nova-card">
          <h3>Queue Statistics</h3>
          <p className="muted">
            Total queue items: <strong>{queueItems.length}</strong>
          </p>
          <p className="muted">
            Pending approvals: <strong>{pendingApprovals.length}</strong>
          </p>
          <p className="muted">
            Recently completed: <strong>{recentCompleted.length}</strong>
          </p>
        </div>
      </div>
    </div>
  )
}
