import type { ReactNode } from 'react'

export interface ChannelStatus {
  id: string
  name: string
  status: 'connected' | 'pending' | 'disabled'
  lastActiveAt?: string
  description: string
}

interface ChannelsProps {
  channels: ChannelStatus[]
  onChannelToggle?: (channelId: string, enabled: boolean) => void
  children?: ReactNode
}

export function Channels(props: ChannelsProps) {
  const { channels, onChannelToggle } = props

  const handleToggle = (channel: ChannelStatus) => {
    const isEnabled = channel.status !== 'disabled'
    onChannelToggle?.(channel.id, !isEnabled)
  }

  return (
    <div className="nova-surface">
      <div className="nova-stack">
        <div className="nova-card">
          <h3>Connected Channels</h3>
          <p className="muted">
            Manage inbound/outbound messaging across platforms. All channels operate under 
            local policy authority with message encryption at rest.
          </p>
        </div>

        <div className="nova-grid-cards">
          {channels.map((channel) => (
            <article
              key={channel.id}
              className={`nova-channel-card nova-channel-${channel.status}`}
            >
              <div className="nova-channel-head">
                <strong>{channel.name}</strong>
                <span
                  className={`nova-status-dot nova-status-${channel.status}`}
                  aria-label={`${channel.name} is ${channel.status}`}
                />
              </div>

              <p className="muted">{channel.description}</p>

              {channel.lastActiveAt && (
                <p className="muted">Last active: {channel.lastActiveAt}</p>
              )}

              <button
                className="run-button"
                onClick={() => handleToggle(channel)}
                style={{ marginTop: '12px' }}
              >
                {channel.status === 'disabled' ? 'Enable' : 'Disable'}
              </button>
            </article>
          ))}
        </div>

        <div className="nova-card">
          <h3>Channel Protocols</h3>
          <p className="muted">
            <strong>Telegram:</strong> Bot API with Paxion-controlled webhook. Requires token configuration 
            in Settings.
          </p>
          <p className="muted">
            <strong>Discord:</strong> Webhook integration for server-side ingress. Commands routed through 
            ControlShell.
          </p>
          <p className="muted">
            <strong>WhatsApp:</strong> Twilio integration with end-to-end encryption. SIM-based identity 
            verification.
          </p>
          <p className="muted">
            <strong>WebChat:</strong> Browser-based WebSocket connection. Stored locally, no external relay 
            required.
          </p>
        </div>
      </div>
    </div>
  )
}
