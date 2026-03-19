import type { ReactNode } from 'react'

export interface DeviceNode {
  id: string
  name: string
  type: 'local' | 'relay' | 'bridge'
  status: 'connected' | 'disconnected' | 'syncing'
  lastSeen: string
}

export interface RelaySummary {
  mode: string
  endpoint: string
  deviceId: string
  pollingEnabled: boolean
  tokenConfigured: boolean
  message: string
  lastSyncAt: string | null
  pendingRequests: Array<Record<string, unknown>>
}

export interface BridgeSummary {
  enabled: boolean
  host: string
  port: string
  message: string
  pendingRequests: Array<Record<string, unknown>>
}

interface NodesProps {
  nodes: DeviceNode[]
  relay: RelaySummary
  bridge: BridgeSummary
  onPairNew?: () => void
  onRotateSecret?: (nodeId: string) => void
  onRefreshRelay?: () => void
  onSyncRelay?: () => void
  onSubmitRelayHeartbeat?: () => void
  onCompleteRelayRequest?: (requestId: string) => void
  onRefreshBridge?: () => void
  onToggleBridge?: (enabled: boolean) => void
  desktopAdapterEnabled?: boolean
  cloudRelayEnabled?: boolean
  onToggleDesktopAdapter?: (enabled: boolean) => void
  onToggleCloudRelay?: (enabled: boolean) => void
  m4RoutingPreview?: Array<{
    kind: 'channel' | 'call'
    primaryMode: string
    fallbackChain: string[]
  }>
  smartglass?: {
    enabled: boolean
    voiceModeActive: boolean
    confirmationRequired: boolean
  }
  onToggleSmartglass?: (enabled: boolean) => void
  m6Language?: {
    selectedLanguage: string
    sttLanguage: string
    responseLanguage: string
    ttsLanguage: string
    fallbackChain: string[]
    runtimeNote: string
  }
  m6LanguageOptions?: Array<{ code: string; label: string }>
  onSelectM6Language?: (code: string) => void
  m7Reliability?: {
    telemetry: {
      totalRouteDecisions: number
      byDeviceClass: Record<'desktop' | 'mobile' | 'tablet' | 'smartglass', number>
      delegatedQueued: number
      delegatedExecuting: number
      delegatedCompleted: number
      delegatedFailed: number
      failedActions: number
      resumedWorkflows: number
      anomalyRemoteAbuse: number
      anomalyRetryStorm: number
      recentSignals: Array<{
        id: string
        type: 'remote-abuse' | 'retry-storm' | 'resume-recovery'
        detail: string
        timestamp: string
      }>
      lastUpdatedAt: string
    }
  }
  children?: ReactNode
}

export function Nodes(props: NodesProps) {
  const {
    nodes = [],
    relay,
    bridge,
    onPairNew,
    onRotateSecret,
    onRefreshRelay,
    onSyncRelay,
    onSubmitRelayHeartbeat,
    onCompleteRelayRequest,
    onRefreshBridge,
    onToggleBridge,
    desktopAdapterEnabled = false,
    cloudRelayEnabled = false,
    onToggleDesktopAdapter,
    onToggleCloudRelay,
    m4RoutingPreview = [],
    smartglass = {
      enabled: false,
      voiceModeActive: false,
      confirmationRequired: false,
    },
    onToggleSmartglass,
    m6Language = {
      selectedLanguage: 'en-US',
      sttLanguage: 'en-US',
      responseLanguage: 'English',
      ttsLanguage: 'en-US',
      fallbackChain: ['en-US'],
      runtimeNote: '',
    },
    m6LanguageOptions = [],
    onSelectM6Language,
    m7Reliability = {
      telemetry: {
        totalRouteDecisions: 0,
        byDeviceClass: {
          desktop: 0,
          mobile: 0,
          tablet: 0,
          smartglass: 0,
        },
        delegatedQueued: 0,
        delegatedExecuting: 0,
        delegatedCompleted: 0,
        delegatedFailed: 0,
        failedActions: 0,
        resumedWorkflows: 0,
        anomalyRemoteAbuse: 0,
        anomalyRetryStorm: 0,
        recentSignals: [],
        lastUpdatedAt: new Date().toISOString(),
      },
    },
  } = props

  const localNodes = nodes.filter((n) => n.type === 'local')
  const relayNodes = nodes.filter((n) => n.type === 'relay')
  const bridgeNodes = nodes.filter((n) => n.type === 'bridge')

  return (
    <div className="nova-surface">
      <div className="nova-stack">
        <div className="nova-card">
          <h3>Device Ecosystem</h3>
          <p className="muted">
            Manage secure pairing between Paxion instances. Local policy authority 
            is maintained on primary device; relays forward ingress but cannot 
            approve policies.
          </p>
        </div>

        {localNodes.length > 0 && (
          <div className="nova-card">
            <h3>Local Devices</h3>
            <div className="nova-grid-cards">
              {localNodes.map((node) => (
                <article
                  key={node.id}
                  className={`nova-node-card nova-node-${node.status}`}
                >
                  <div className="nova-node-head">
                    <strong>{node.name}</strong>
                    <span
                      className={`nova-status-dot nova-status-${node.status}`}
                    />
                  </div>
                  <p className="muted">Type: Local Authority</p>
                  <p className="muted">Last seen: {node.lastSeen}</p>
                  <button
                    className="run-button"
                    onClick={() => onRotateSecret?.(node.id)}
                  >
                    Rotate Secret
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}

        {relayNodes.length > 0 && (
          <div className="nova-card">
            <h3>Cloud Relay Nodes</h3>
            <p className="muted">
              Remote ingress points that forward traffic back to local authority. 
              Cannot make policy decisions independently.
            </p>
            <div className="nova-grid-cards">
              {relayNodes.map((node) => (
                <article
                  key={node.id}
                  className={`nova-node-card nova-node-${node.status}`}
                >
                  <div className="nova-node-head">
                    <strong>{node.name}</strong>
                    <span className={`nova-status-dot nova-status-${node.status}`} />
                  </div>
                  <p className="muted">Type: Cloud Relay</p>
                  <p className="muted">Last seen: {node.lastSeen}</p>
                  <button
                    className="run-button"
                    onClick={() => onRotateSecret?.(node.id)}
                  >
                    Rotate Secret
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}

        {bridgeNodes.length > 0 && (
          <div className="nova-card">
            <h3>Mobile Bridge Nodes</h3>
            <p className="muted">
              Phone or tablet devices connected via secure bridge. All commands 
              enter approval queue before execution.
            </p>
            <div className="nova-grid-cards">
              {bridgeNodes.map((node) => (
                <article
                  key={node.id}
                  className={`nova-node-card nova-node-${node.status}`}
                >
                  <div className="nova-node-head">
                    <strong>{node.name}</strong>
                    <span className={`nova-status-dot nova-status-${node.status}`} />
                  </div>
                  <p className="muted">Type: Mobile Bridge</p>
                  <p className="muted">Last seen: {node.lastSeen}</p>
                  <button
                    className="run-button"
                    onClick={() => onRotateSecret?.(node.id)}
                  >
                    Rotate Secret
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}

        <div className="nova-card">
          <h3>Secure Pairing</h3>
          <p className="muted">
            Add a new device to the ecosystem. All communications encrypted with 
            OS-level secure storage for credentials.
          </p>
          <button className="run-button" onClick={onPairNew}>
            Pair New Device
          </button>
        </div>

        <div className="nova-card">
          <h3>Experimental Flags</h3>
          <p className="muted">
            Keep risky modules disabled by default. Enable only during supervised tests.
          </p>
          <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: '1fr 1fr' }}>
            <button
              className="run-button"
              onClick={() => onToggleDesktopAdapter?.(!desktopAdapterEnabled)}
            >
              Desktop Adapter: {desktopAdapterEnabled ? 'Enabled' : 'Disabled'}
            </button>
            <button
              className="run-button"
              onClick={() => onToggleCloudRelay?.(!cloudRelayEnabled)}
            >
              Cloud Relay: {cloudRelayEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>

        <div className="nova-card">
          <h3>M4 Unified Call and Channel Routing</h3>
          <p className="muted">
            Messaging and call intents now share one routing layer with deterministic fallback modes.
          </p>
          {m4RoutingPreview.length === 0 ? (
            <p className="muted">No intent routing preview available yet.</p>
          ) : (
            <div className="nova-grid-cards">
              {m4RoutingPreview.map((route) => (
                <article className="nova-node-card" key={route.kind}>
                  <div className="nova-node-head">
                    <strong>{route.kind === 'call' ? 'Voice Call' : 'Channel Message'}</strong>
                  </div>
                  <p className="muted">Primary: {route.primaryMode}</p>
                  <p className="muted">Fallback: {route.fallbackChain.join(' -> ')}</p>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="nova-card">
          <h3>M5 Smart-glass Voice Mode</h3>
          <p className="muted">
            Voice-first runtime with concise confirmation prompts for approval-gated actions.
          </p>
          <p className="muted">Mode: <strong>{smartglass.enabled ? 'enabled' : 'disabled'}</strong></p>
          <p className="muted">Voice runtime: <strong>{smartglass.voiceModeActive ? 'active' : 'idle'}</strong></p>
          <p className="muted">
            Confirmation gate: <strong>{smartglass.confirmationRequired ? 'required' : 'not required'}</strong>
          </p>
          <button className="run-button" onClick={() => onToggleSmartglass?.(!smartglass.enabled)}>
            {smartglass.enabled ? 'Disable Smart-glass Mode' : 'Enable Smart-glass Mode'}
          </button>
        </div>

        <div className="nova-card">
          <h3>M6 Multilingual Voice Stack</h3>
          <p className="muted">
            Session language memory controls STT input language, model response language hint, and TTS output language with fallback rules.
          </p>
          <div className="control-group" style={{ marginTop: '10px' }}>
            <label>Session language</label>
            <select
              value={m6Language.selectedLanguage}
              onChange={(event) => onSelectM6Language?.(event.target.value)}
            >
              {m6LanguageOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <p className="muted">STT route: <strong>{m6Language.sttLanguage}</strong></p>
          <p className="muted">Response language: <strong>{m6Language.responseLanguage}</strong></p>
          <p className="muted">TTS preferred: <strong>{m6Language.ttsLanguage}</strong></p>
          <p className="muted">Fallback chain: <strong>{m6Language.fallbackChain.join(' -> ')}</strong></p>
          {m6Language.runtimeNote && <p className="muted">Runtime: {m6Language.runtimeNote}</p>}
        </div>

        <div className="nova-card">
          <h3>M7 Reliability and Observability</h3>
          <p className="muted">
            Per-device telemetry, anomaly signaling, and delegated workflow crash-recovery metrics.
          </p>
          <p className="muted">Last update: <strong>{new Date(m7Reliability.telemetry.lastUpdatedAt).toLocaleString()}</strong></p>
          <div className="nova-grid-cards">
            <article className="nova-node-card">
              <strong>Route decisions</strong>
              <p className="muted">Total: {m7Reliability.telemetry.totalRouteDecisions}</p>
              <p className="muted">
                desktop={m7Reliability.telemetry.byDeviceClass.desktop} | mobile={m7Reliability.telemetry.byDeviceClass.mobile} | tablet={m7Reliability.telemetry.byDeviceClass.tablet} | smartglass={m7Reliability.telemetry.byDeviceClass.smartglass}
              </p>
            </article>
            <article className="nova-node-card">
              <strong>Delegated lifecycle</strong>
              <p className="muted">queued={m7Reliability.telemetry.delegatedQueued}</p>
              <p className="muted">executing={m7Reliability.telemetry.delegatedExecuting}</p>
              <p className="muted">completed={m7Reliability.telemetry.delegatedCompleted}</p>
              <p className="muted">failed={m7Reliability.telemetry.delegatedFailed}</p>
            </article>
            <article className="nova-node-card">
              <strong>Anomaly counters</strong>
              <p className="muted">remote abuse={m7Reliability.telemetry.anomalyRemoteAbuse}</p>
              <p className="muted">retry storm={m7Reliability.telemetry.anomalyRetryStorm}</p>
              <p className="muted">failed actions={m7Reliability.telemetry.failedActions}</p>
              <p className="muted">resumed workflows={m7Reliability.telemetry.resumedWorkflows}</p>
            </article>
          </div>
          {m7Reliability.telemetry.recentSignals.length > 0 && (
            <div className="nova-grid-cards" style={{ marginTop: '10px' }}>
              {m7Reliability.telemetry.recentSignals.slice(-4).map((signal) => (
                <article className="nova-node-card" key={signal.id}>
                  <strong>{signal.type}</strong>
                  <p className="muted">{signal.detail}</p>
                  <p className="muted">{new Date(signal.timestamp).toLocaleTimeString()}</p>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="nova-card">
          <h3>Hybrid Relay Control</h3>
          {!cloudRelayEnabled && (
            <p className="muted accent-cyan">
              Cloud relay is feature-flag disabled. Enable it above to allow sync/submit/complete.
            </p>
          )}
          <p className="muted">
            Mode: <strong>{relay.mode}</strong>
          </p>
          <p className="muted">
            Endpoint: <strong>{relay.endpoint || 'not configured'}</strong>
          </p>
          <p className="muted">
            Device ID: <strong>{relay.deviceId}</strong>
          </p>
          <p className="muted">
            Polling: <strong>{relay.pollingEnabled ? 'enabled' : 'disabled'}</strong>
          </p>
          <p className="muted">
            Token configured: <strong>{relay.tokenConfigured ? 'yes' : 'no'}</strong>
          </p>
          {relay.lastSyncAt && <p className="muted">Last sync: {relay.lastSyncAt}</p>}
          {relay.message && <p className="muted">{relay.message}</p>}
          <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <button className="run-button" onClick={onRefreshRelay}>
              Refresh Relay
            </button>
            <button className="run-button" onClick={onSyncRelay} disabled={!cloudRelayEnabled}>
              Sync Queue
            </button>
            <button className="run-button" onClick={onSubmitRelayHeartbeat} disabled={!cloudRelayEnabled}>
              Send Heartbeat
            </button>
          </div>
          <p className="muted" style={{ marginTop: '12px' }}>
            Pending cloud requests: <strong>{relay.pendingRequests.length}</strong>
          </p>
          {relay.pendingRequests.length > 0 && (
            <div className="nova-grid-cards">
              {relay.pendingRequests.slice(0, 8).map((request, index) => {
                const id = String(request.id || request.requestId || `relay-${index}`)
                const actionId = String(
                  (request.request as Record<string, unknown> | undefined)?.actionId ||
                    request.actionId ||
                    'unknown-action',
                )
                return (
                  <article className="nova-node-card" key={id}>
                    <div className="nova-node-head">
                      <strong>{actionId}</strong>
                    </div>
                    <p className="muted">Request ID: {id}</p>
                    <button
                      className="run-button"
                      onClick={() => onCompleteRelayRequest?.(id)}
                      disabled={!cloudRelayEnabled}
                    >
                      Mark Completed
                    </button>
                  </article>
                )
              })}
            </div>
          )}
        </div>

        <div className="nova-card">
          <h3>Mobile Bridge</h3>
          <p className="muted">
            Status: <strong>{bridge.enabled ? 'running' : 'stopped'}</strong>
          </p>
          <p className="muted">
            Host: <strong>{bridge.host}</strong>
          </p>
          <p className="muted">
            Port: <strong>{bridge.port}</strong>
          </p>
          {bridge.message && <p className="muted">{bridge.message}</p>}
          <p className="muted">
            Pending bridge requests: <strong>{bridge.pendingRequests.length}</strong>
          </p>
          <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <button className="run-button" onClick={onRefreshBridge}>
              Refresh Bridge
            </button>
            <button className="run-button" onClick={() => onToggleBridge?.(!bridge.enabled)}>
              {bridge.enabled ? 'Stop Bridge' : 'Start Bridge'}
            </button>
          </div>
        </div>

        <div className="nova-card">
          <h3>Secret Rotation</h3>
          <p className="muted">
            Rotate device secrets regularly to maintain security:
          </p>
          <ul className="muted">
            <li>
              <strong>Local Devices:</strong> Share new secret via QR code or manual 
              entry
            </li>
            <li>
              <strong>Relay Nodes:</strong> Deploy new token to relay host 
              (no downtime required)
            </li>
            <li>
              <strong>Mobile Bridges:</strong> Renew one-time token and rescan QR code
            </li>
          </ul>
        </div>

        <div className="nova-card">
          <h3>Network Topology</h3>
          <p className="muted">
            All devices report back to the primary local authority. Policy decisions 
            are always made on the device where Paxion desktop is running.
          </p>
          <p className="muted">
            <strong>Architecture:</strong> Local Authority ← Relay ← Mobile Bridges
          </p>
        </div>
      </div>
    </div>
  )
}
