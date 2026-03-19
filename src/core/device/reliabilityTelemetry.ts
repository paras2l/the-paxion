export type TelemetryDeviceClass = 'desktop' | 'mobile' | 'tablet' | 'smartglass'

export type ReliabilitySignal = {
  id: string
  type: 'remote-abuse' | 'retry-storm' | 'resume-recovery'
  detail: string
  timestamp: string
}

export type ReliabilityTelemetry = {
  totalRouteDecisions: number
  byDeviceClass: Record<TelemetryDeviceClass, number>
  delegatedQueued: number
  delegatedExecuting: number
  delegatedCompleted: number
  delegatedFailed: number
  failedActions: number
  resumedWorkflows: number
  anomalyRemoteAbuse: number
  anomalyRetryStorm: number
  recentSignals: ReliabilitySignal[]
  lastUpdatedAt: string
}

export type ReliabilityTelemetryEvent =
  | {
      type: 'route-decision'
      deviceClass: TelemetryDeviceClass
    }
  | {
      type: 'delegated-status'
      status: 'queued' | 'executing' | 'completed' | 'failed'
    }
  | {
      type: 'failed-action'
    }
  | {
      type: 'workflow-resumed'
      resumedCount: number
      detail: string
    }
  | {
      type: 'anomaly-remote-abuse'
      detail: string
    }
  | {
      type: 'anomaly-retry-storm'
      detail: string
    }

function nowIso(): string {
  return new Date().toISOString()
}

function makeSignalId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function trimSignals(signals: ReliabilitySignal[]): ReliabilitySignal[] {
  return signals.slice(-10)
}

export function createDefaultReliabilityTelemetry(): ReliabilityTelemetry {
  return {
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
    lastUpdatedAt: nowIso(),
  }
}

export function normalizeReliabilityTelemetry(raw: unknown): ReliabilityTelemetry {
  const defaults = createDefaultReliabilityTelemetry()
  if (!raw || typeof raw !== 'object') {
    return defaults
  }

  const input = raw as Record<string, unknown>
  const deviceCounts = (input.byDeviceClass && typeof input.byDeviceClass === 'object')
    ? (input.byDeviceClass as Record<string, unknown>)
    : {}

  const recentSignals = Array.isArray(input.recentSignals)
    ? (input.recentSignals as Array<Record<string, unknown>>)
        .map((signal) => {
          const normalizedType: ReliabilitySignal['type'] =
            signal.type === 'remote-abuse' || signal.type === 'retry-storm' || signal.type === 'resume-recovery'
              ? signal.type
              : 'resume-recovery'

          return {
            id: String(signal.id || makeSignalId('signal')),
            type: normalizedType,
            detail: String(signal.detail || ''),
            timestamp: String(signal.timestamp || nowIso()),
          }
        })
    : []

  return {
    totalRouteDecisions: Number(input.totalRouteDecisions || 0),
    byDeviceClass: {
      desktop: Number(deviceCounts.desktop || 0),
      mobile: Number(deviceCounts.mobile || 0),
      tablet: Number(deviceCounts.tablet || 0),
      smartglass: Number(deviceCounts.smartglass || 0),
    },
    delegatedQueued: Number(input.delegatedQueued || 0),
    delegatedExecuting: Number(input.delegatedExecuting || 0),
    delegatedCompleted: Number(input.delegatedCompleted || 0),
    delegatedFailed: Number(input.delegatedFailed || 0),
    failedActions: Number(input.failedActions || 0),
    resumedWorkflows: Number(input.resumedWorkflows || 0),
    anomalyRemoteAbuse: Number(input.anomalyRemoteAbuse || 0),
    anomalyRetryStorm: Number(input.anomalyRetryStorm || 0),
    recentSignals: trimSignals(recentSignals),
    lastUpdatedAt: String(input.lastUpdatedAt || nowIso()),
  }
}

export function applyReliabilityTelemetryEvent(
  snapshot: ReliabilityTelemetry,
  event: ReliabilityTelemetryEvent,
): ReliabilityTelemetry {
  const next: ReliabilityTelemetry = {
    ...snapshot,
    byDeviceClass: { ...snapshot.byDeviceClass },
    recentSignals: [...snapshot.recentSignals],
    lastUpdatedAt: nowIso(),
  }

  if (event.type === 'route-decision') {
    next.totalRouteDecisions += 1
    next.byDeviceClass[event.deviceClass] += 1
    return next
  }

  if (event.type === 'delegated-status') {
    if (event.status === 'queued') next.delegatedQueued += 1
    if (event.status === 'executing') next.delegatedExecuting += 1
    if (event.status === 'completed') next.delegatedCompleted += 1
    if (event.status === 'failed') next.delegatedFailed += 1
    return next
  }

  if (event.type === 'failed-action') {
    next.failedActions += 1
    return next
  }

  if (event.type === 'workflow-resumed') {
    next.resumedWorkflows += event.resumedCount
    next.recentSignals = trimSignals([
      ...next.recentSignals,
      {
        id: makeSignalId('resume'),
        type: 'resume-recovery',
        detail: event.detail,
        timestamp: nowIso(),
      },
    ])
    return next
  }

  if (event.type === 'anomaly-remote-abuse') {
    next.anomalyRemoteAbuse += 1
    next.recentSignals = trimSignals([
      ...next.recentSignals,
      {
        id: makeSignalId('abuse'),
        type: 'remote-abuse',
        detail: event.detail,
        timestamp: nowIso(),
      },
    ])
    return next
  }

  if (event.type === 'anomaly-retry-storm') {
    next.anomalyRetryStorm += 1
    next.recentSignals = trimSignals([
      ...next.recentSignals,
      {
        id: makeSignalId('retry'),
        type: 'retry-storm',
        detail: event.detail,
        timestamp: nowIso(),
      },
    ])
    return next
  }

  return next
}
