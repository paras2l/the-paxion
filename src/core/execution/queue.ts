import { ApprovalStore } from '../../security/approvals'
import { evaluateActionPolicy, finalizePolicyDecision } from '../../security/policy'
import type { ActionRequest } from '../../security/types'

export type QueueStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'executing'
  | 'completed'
  | 'failed'

export type QueueItem = {
  id: string
  actionId: string
  status: QueueStatus
  pipeline: 'normal' | 'privileged'
  requestedAt: string
  approvedAt?: string
  completedAt?: string
  auditEntryId?: string
  detail?: string
  request: ActionRequest
}

export type QueueResolution = {
  items: QueueItem[]
  resolved?: QueueItem
  reason: string
}

const BASE_ACTIONS: ActionRequest[] = [
  {
    actionId: 'workspace.generateComponent',
    category: 'codegen',
    targetPath: '/workspace/missions/phase3-component.tsx',
    detail: 'Generate a new workspace component from approved mission context.',
  },
  {
    actionId: 'network.fetchContext',
    category: 'network',
    targetPath: '/library/incoming/channel-context.txt',
    detail: 'Fetch and stage channel context for mission execution.',
  },
]

function makeQueueId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function pipelineFor(request: ActionRequest): 'normal' | 'privileged' {
  const base = evaluateActionPolicy(request)
  return base.requiresApproval ? 'privileged' : 'normal'
}

export function createSeedQueue(): QueueItem[] {
  const now = nowIso()
  return BASE_ACTIONS.map((request) => ({
    id: makeQueueId(),
    actionId: request.actionId,
    status: 'pending',
    pipeline: pipelineFor(request),
    requestedAt: now,
    detail: request.detail,
    request,
  }))
}

export function enqueueAction(items: QueueItem[], request: ActionRequest): QueueItem[] {
  return [
    {
      id: makeQueueId(),
      actionId: request.actionId,
      status: 'pending',
      pipeline: pipelineFor(request),
      requestedAt: nowIso(),
      detail: request.detail,
      request,
    },
    ...items,
  ]
}

export function approveQueuedAction(
  items: QueueItem[],
  itemId: string,
  adminUnlocked: boolean,
  approvalStore: ApprovalStore,
): QueueResolution {
  const pending = items.find((item) => item.id === itemId && item.status === 'pending')
  if (!pending) {
    return { items, reason: 'Queue item not found or no longer pending.' }
  }

  const baseDecision = evaluateActionPolicy(pending.request)
  if (!baseDecision.allowed) {
    const next = items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            status: 'denied' as const,
            completedAt: nowIso(),
            detail: baseDecision.reason,
          }
        : item,
    )
    return {
      items: next,
      resolved: next.find((item) => item.id === itemId),
      reason: baseDecision.reason,
    }
  }

  let finalAllowed = true
  let reason = baseDecision.reason
  const approvedAt = nowIso()

  if (baseDecision.requiresApproval) {
    const ticket = adminUnlocked ? approvalStore.issue(pending.actionId) : null
    const approvalGranted = ticket ? approvalStore.consume(ticket.id, pending.actionId) : false
    const finalDecision = finalizePolicyDecision(baseDecision, {
      adminVerified: adminUnlocked,
      approvalGranted,
    })
    finalAllowed = finalDecision.allowed
    reason = finalDecision.reason
  }

  const completedAt = nowIso()
  const auditEntryId = `audit-${itemId}`
  const next = items.map((item) => {
    if (item.id !== itemId) {
      return item
    }

    if (!finalAllowed) {
      return {
        ...item,
        status: 'denied' as const,
        approvedAt,
        completedAt,
        auditEntryId,
        detail: reason,
      }
    }

    return {
      ...item,
      status: 'completed' as const,
      approvedAt,
      completedAt,
      auditEntryId,
      detail: reason,
    }
  })

  return {
    items: next,
    resolved: next.find((item) => item.id === itemId),
    reason,
  }
}

export function denyQueuedAction(items: QueueItem[], itemId: string): QueueResolution {
  const target = items.find((item) => item.id === itemId)
  if (!target) {
    return { items, reason: 'Queue item not found.' }
  }

  const deniedAt = nowIso()
  const next = items.map((item) =>
    item.id === itemId
      ? {
          ...item,
          status: 'denied' as const,
          completedAt: deniedAt,
          detail: 'Denied by operator from ControlShell queue.',
        }
      : item,
  )

  return {
    items: next,
    resolved: next.find((item) => item.id === itemId),
    reason: 'Denied by operator.',
  }
}
