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
