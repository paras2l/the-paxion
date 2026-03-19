import type { ReactNode } from 'react'

export interface WorkspaceMission {
  id: string
  title: string
  description: string
  status: 'planning' | 'ready' | 'executing' | 'completed' | 'failed'
  steps: number
  createdAt: string
  updatedAt: string
}

interface WorkspaceProps {
  missions: WorkspaceMission[]
  learnedSkills: string[]
  onCreateMission?: () => void
  onMissionSelect?: (missionId: string) => void
  children?: ReactNode
}

export function Workspace(props: WorkspaceProps) {
  const { missions = [], learnedSkills = [], onCreateMission, onMissionSelect } = props

  const activeMissions = missions.filter((m) => m.status === 'planning' || m.status === 'ready')
  const completedMissions = missions.filter((m) => m.status === 'completed')

  return (
    <div className="nova-surface">
      <div className="nova-stack">
        <div className="nova-card">
          <h3>Workspace & Mission Control</h3>
          <p className="muted">
            Define multi-step workflows, automate complex tasks, and track execution 
            across channels with deterministic orchestration and rollback capability.
          </p>
        </div>

        <div className="nova-card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <p className="muted">Active Missions</p>
              <strong style={{ fontSize: '1.5em', color: 'var(--accent-cyan)' }}>
                {activeMissions.length}
              </strong>
            </div>
            <div>
              <p className="muted">Completed</p>
              <strong style={{ fontSize: '1.5em', color: 'var(--accent-cyan)' }}>
                {completedMissions.length}
              </strong>
            </div>
          </div>

          <button
            className="run-button"
            onClick={onCreateMission}
            style={{ marginTop: '16px', width: '100%' }}
          >
            Create New Mission
          </button>
        </div>

        {activeMissions.length > 0 && (
          <div className="nova-card">
            <h3>Active Missions</h3>
            <div className="nova-mission-list">
              {activeMissions.map((mission) => (
                <article
                  key={mission.id}
                  className="nova-mission-item"
                  onClick={() => onMissionSelect?.(mission.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="nova-mission-head">
                    <strong>{mission.title}</strong>
                    <span className={`nova-status-badge nova-status-${mission.status}`}>
                      {mission.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="muted">{mission.description}</p>
                  <p className="muted">
                    Steps: <strong>{mission.steps}</strong> | Updated: 
                    {mission.updatedAt}
                  </p>
                </article>
              ))}
            </div>
          </div>
        )}

        {completedMissions.length > 0 && (
          <div className="nova-card">
            <h3>Completed Missions</h3>
            <div className="nova-mission-list">
              {completedMissions.slice(0, 6).map((mission) => (
                <article
                  key={mission.id}
                  className="nova-mission-item nova-mission-completed"
                >
                  <div className="nova-mission-head">
                    <strong>{mission.title}</strong>
                    <span className="nova-status-badge nova-status-completed">
                      ✓ COMPLETED
                    </span>
                  </div>
                  <p className="muted">{mission.description}</p>
                  <p className="muted">
                    Completed: {mission.updatedAt} | Steps: {mission.steps}
                  </p>
                </article>
              ))}
            </div>
          </div>
        )}

        <div className="nova-card">
          <h3>Capability Growth</h3>
          <p className="muted">
            Unlocked skills: <strong>{learnedSkills.length}</strong>
          </p>
          {learnedSkills.length > 0 && (
            <div className="nova-skill-grid">
              {learnedSkills.slice(0, 8).map((skill) => (
                <span key={skill} className="nova-skill-tag">
                  {skill}
                </span>
              ))}
              {learnedSkills.length > 8 && (
                <span className="nova-skill-tag">
                  +{learnedSkills.length - 8} more
                </span>
              )}
            </div>
          )}
        </div>

        <div className="nova-card">
          <h3>Mission Automation Features</h3>
          <ul className="muted">
            <li>
              <strong>Deterministic Steps:</strong> Define repeatable workflow steps 
              with fallback selectors
            </li>
            <li>
              <strong>Approval Checkpoints:</strong> Multi-step missions can require 
              approval between phases
            </li>
            <li>
              <strong>Evidence Capture:</strong> Automatic screenshot & state snapshot 
              at each step
            </li>
            <li>
              <strong>Rollback Transactions:</strong> Revert to previous state if 
              verification fails
            </li>
            <li>
              <strong>Multi-Channel Broadcast:</strong> Execute mission across multiple 
              channels (chat, email, forms)
            </li>
            <li>
              <strong>Skill & Learning Integration:</strong> Mission steps recorded 
              and playable as learned skills
            </li>
          </ul>
        </div>

        <div className="nova-card">
          <h3>Workspace Organization</h3>
          <p className="muted">
            Missions are organized by:
          </p>
          <ul className="muted">
            <li><strong>Project:</strong> Group related workflows together</li>
            <li><strong>Channel:</strong> Broadcast missions across specific channels</li>
            <li><strong>Priority:</strong> Urgent tasks run first in execution queue</li>
            <li><strong>Recurrence:</strong> Daily/weekly/monthly repeating missions</li>
            <li><strong>Tagging:</strong> Flexible tags for custom organization</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
