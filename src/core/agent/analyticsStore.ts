export type AnalyticsEvent = {
  id: string
  type: 'command' | 'queued' | 'blocked-permission' | 'blocked-integration'
  timestamp: string
  detail: string
}

export type AnalyticsSummary = {
  totalCommands: number
  queuedActions: number
  blockedPermission: number
  blockedIntegration: number
}

function nowIso(): string {
  return new Date().toISOString()
}

export function createAnalyticsEvent(type: AnalyticsEvent['type'], detail: string): AnalyticsEvent {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    timestamp: nowIso(),
    detail,
  }
}

export function summarizeAnalytics(events: AnalyticsEvent[]): AnalyticsSummary {
  return {
    totalCommands: events.filter((event) => event.type === 'command').length,
    queuedActions: events.filter((event) => event.type === 'queued').length,
    blockedPermission: events.filter((event) => event.type === 'blocked-permission').length,
    blockedIntegration: events.filter((event) => event.type === 'blocked-integration').length,
  }
}
