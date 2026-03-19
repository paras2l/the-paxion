import type { ActionRequest } from '../../security/types'
import type { DeviceClass, ExecutionMode } from './actionRouter'

export type DelegationStatus =
  | 'pending-approval'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'failed'

export type DelegatedActionItem = {
  id: string
  correlationId: string
  idempotencyKey: string
  request: ActionRequest
  sourceDeviceClass: DeviceClass
  mode: ExecutionMode
  routeReason: string
  requiresApproval: boolean
  status: DelegationStatus
  replayCount: number
  lastAttemptAt: string
  createdAt: string
  updatedAt: string
  note?: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizePart(value: string | undefined): string {
  return String(value || '').trim().toLowerCase()
}

export function makeDelegatedIdempotencyKey(request: ActionRequest): string {
  return [
    normalizePart(request.actionId),
    normalizePart(request.targetPath),
    normalizePart(request.detail),
    normalizePart(request.category),
  ].join('::')
}

export function findQueuedByIdempotency(
  items: DelegatedActionItem[],
  key: string,
): DelegatedActionItem | null {
  return (
    items.find(
      (item) =>
        String(item.idempotencyKey || '') === key
        && item.status !== 'completed'
        && item.status !== 'failed',
    ) || null
  )
}

function compareReplayOrder(a: DelegatedActionItem, b: DelegatedActionItem): number {
  const timeDiff = String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
  if (timeDiff !== 0) {
    return timeDiff
  }
  return String(a.id || '').localeCompare(String(b.id || ''))
}

export function selectReplayCandidates(
  items: DelegatedActionItem[],
  options?: {
    safeOnly?: boolean
    sourceDeviceClass?: DeviceClass
    statuses?: DelegationStatus[]
    limit?: number
  },
): DelegatedActionItem[] {
  const allowedStatuses = new Set(options?.statuses || ['approved', 'failed'])
  const safeOnly = options?.safeOnly ?? false
  const sourceClass = options?.sourceDeviceClass
  const limit = Math.max(1, Number(options?.limit || 12))

  return items
    .filter((item) => allowedStatuses.has(item.status))
    .filter((item) => (sourceClass ? item.sourceDeviceClass === sourceClass : true))
    .filter((item) => {
      if (!safeOnly) {
        return true
      }
      return item.request.category !== 'filesystem' && item.request.category !== 'system'
    })
    .sort(compareReplayOrder)
    .slice(0, limit)
}

export function enqueueDelegatedRequest(input: {
  request: ActionRequest
  sourceDeviceClass: DeviceClass
  mode: ExecutionMode
  routeReason: string
  requiresApproval: boolean
}): DelegatedActionItem {
  const createdAt = nowIso()
  const idempotencyKey = makeDelegatedIdempotencyKey(input.request)
  return {
    id: makeId('delegate'),
    correlationId: makeId('corr'),
    idempotencyKey,
    request: input.request,
    sourceDeviceClass: input.sourceDeviceClass,
    mode: input.mode,
    routeReason: input.routeReason,
    requiresApproval: input.requiresApproval,
    status: input.requiresApproval ? 'pending-approval' : 'approved',
    replayCount: 0,
    lastAttemptAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  }
}

export function updateDelegatedStatus(
  items: DelegatedActionItem[],
  id: string,
  status: DelegationStatus,
  note?: string,
): DelegatedActionItem[] {
  const updatedAt = nowIso()
  return items.map((item) =>
    item.id === id
      ? {
          ...item,
          status,
          updatedAt,
          lastAttemptAt: updatedAt,
          replayCount:
            status === 'approved' || status === 'executing'
              ? Number(item.replayCount || 0) + 1
              : Number(item.replayCount || 0),
          note: note || item.note,
        }
      : item,
  )
}

export function recoverDelegatedQueue(items: DelegatedActionItem[]): {
  recovered: DelegatedActionItem[]
  resumedCount: number
} {
  let resumedCount = 0
  const recovered = items.map((item) => {
    if (item.status === 'executing') {
      resumedCount += 1
      const nextStatus: DelegationStatus = item.requiresApproval ? 'pending-approval' : 'approved'
      return {
        ...item,
        sourceDeviceClass: item.sourceDeviceClass || 'mobile',
        idempotencyKey: item.idempotencyKey || makeDelegatedIdempotencyKey(item.request),
        status: nextStatus,
        updatedAt: nowIso(),
        lastAttemptAt: nowIso(),
        replayCount: Number(item.replayCount || 0) + 1,
        note: item.requiresApproval
          ? 'Recovered after restart. Approval is required before delegated re-run.'
          : 'Recovered after restart. Ready for delegated re-run.',
      }
    }

    return {
      ...item,
      sourceDeviceClass: item.sourceDeviceClass || 'mobile',
      idempotencyKey: item.idempotencyKey || makeDelegatedIdempotencyKey(item.request),
      replayCount: Number(item.replayCount || 0),
      lastAttemptAt: item.lastAttemptAt || item.updatedAt || item.createdAt || nowIso(),
    }
  })

  return {
    recovered,
    resumedCount,
  }
}
