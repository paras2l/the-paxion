import type { ReactNode } from 'react'

interface OverviewProps {
  adminUnlocked: boolean
  adminExpiresAt: number | null
  threatLevel?: 'low' | 'medium' | 'high'
  threatScore?: number
  connectedChannels: number
  totalChannels: number
  readyProviders: number
  totalProviders: number
  learnedSkills?: string[]
  children?: ReactNode
}

export function Overview(props: OverviewProps) {
  const {
    adminUnlocked,
    adminExpiresAt,
    threatLevel = 'low',
    threatScore = 0,
    connectedChannels,
    totalChannels,
    readyProviders,
    totalProviders,
    learnedSkills = [],
  } = props

  return (
    <div className="nova-surface">
      <div className="nova-stack">
        <div className="nova-card">
          <h3>Operational Summary</h3>
          <p className="muted">
            Status: <strong>{adminUnlocked ? 'Admin Unlocked' : 'Admin Locked'}</strong>
            {adminUnlocked && adminExpiresAt && (
              <span className="muted">
                {' '}
                (expires {new Date(adminExpiresAt).toLocaleTimeString()})
              </span>
            )}
          </p>
          <p className="muted">
            Channels: <strong>{connectedChannels}/{totalChannels}</strong> connected
          </p>
          <p className="muted">
            Providers: <strong>{readyProviders}/{totalProviders}</strong> ready
          </p>
        </div>

        <div className="nova-card">
          <h3>Threat Posture</h3>
          <p className="muted">
            Risk Level: <strong>{threatLevel.toUpperCase()}</strong>
          </p>
          <p className="muted">
            Score: <strong>{threatScore}</strong>/100
          </p>
          <p className="muted">
            All systems operating within policy constraints. No anomalies detected.
          </p>
        </div>

        <div className="nova-card">
          <h3>Capability Growth</h3>
          <p className="muted">
            Skills Unlocked: <strong>{learnedSkills.length}</strong>
          </p>
          {learnedSkills.length > 0 && (
            <p className="muted">
              {learnedSkills.slice(0, 5).join(', ')}
              {learnedSkills.length > 5 ? ` +${learnedSkills.length - 5} more` : ''}
            </p>
          )}
          <p className="muted">
            Grow capabilities by ingesting documents, connecting channels, and executing tools.
          </p>
        </div>

        <div className="nova-card">
          <h3>Next Steps</h3>
          <ul className="muted">
            <li>Connect channels (Telegram, Discord, WhatsApp, WebChat)</li>
            <li>Configure model providers (OpenAI, Anthropic, Google, etc.)</li>
            <li>Ingest knowledge documents to expand capability</li>
            <li>Execute tools within policy-gated approval flow</li>
            <li>Monitor audit chain for all sensitive actions</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
