import type { ReactNode } from 'react'

export interface SwarmAgent {
  id: string
  name: string
  status: 'running' | 'paused' | 'error'
  lastExecution: string
  errorLog?: string
}

interface SwarmsProps {
  agents: SwarmAgent[]
  onPause?: (id: string) => void
  onResume?: (id: string) => void
  onViewLog?: (id: string) => void
  children?: ReactNode
}

export function Swarms(props: SwarmsProps) {
  const { agents = [], onPause, onResume, onViewLog } = props

  return (
    <div className="nova-surface">
      <div className="nova-stack">
        <div className="nova-card">
          <h3>Multi-Agent Swarm Dashboard</h3>
          <p className="muted">
            View and control all background agents, loops, and swarms. Status, logs, and controls are shown below.
          </p>
        </div>
        <div className="nova-card">
          <table className="nova-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Last Execution</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">No background agents running.</td>
                </tr>
              )}
              {agents.map((agent) => (
                <tr key={agent.id}>
                  <td>{agent.name}</td>
                  <td>
                    <span className={`nova-status-badge status-${agent.status}`}>{agent.status.toUpperCase()}</span>
                  </td>
                  <td>{agent.lastExecution}</td>
                  <td>
                    {agent.status === 'running' && onPause && (
                      <button onClick={() => onPause(agent.id)}>Pause</button>
                    )}
                    {agent.status === 'paused' && onResume && (
                      <button onClick={() => onResume(agent.id)}>Resume</button>
                    )}
                    <button onClick={() => onViewLog && onViewLog(agent.id)}>View Log</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
