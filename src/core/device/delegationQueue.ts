import type { ActionRequest } from '../../security/types'
import type { ExecutionMode } from './actionRouter'

export type DelegationStatus =
  | 'pending-approval'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'failed'

export type DelegatedActionItem = {
  id: string
  correlationId: string
  request: ActionRequest
  mode: ExecutionMode
  routeReason: string
  requiresApproval: boolean
  status: DelegationStatus
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

export function enqueueDelegatedRequest(input: {
  request: ActionRequest
  mode: ExecutionMode
  routeReason: string
  requiresApproval: boolean
}): DelegatedActionItem {
  const createdAt = nowIso()
  return {
    id: makeId('delegate'),
    correlationId: makeId('corr'),
    request: input.request,
    mode: input.mode,
    routeReason: input.routeReason,
    requiresApproval: input.requiresApproval,
    status: input.requiresApproval ? 'pending-approval' : 'approved',
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
      return {
        ...item,
        status: 'approved' as const,
        updatedAt: nowIso(),
        note: 'Recovered after restart. Ready for delegated re-run.',
      }
    }

    return item
  })

  return {
    recovered,
    resumedCount,
  }
}
