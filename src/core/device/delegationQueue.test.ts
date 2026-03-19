import test from 'node:test'
import assert from 'node:assert/strict'

import {
  enqueueDelegatedRequest,
  makeDelegatedIdempotencyKey,
  recoverDelegatedQueue,
  selectReplayCandidates,
  type DelegatedActionItem,
} from './delegationQueue'

function makeItem(overrides: Partial<DelegatedActionItem>): DelegatedActionItem {
  const createdAt = overrides.createdAt || '2026-03-20T10:00:00.000Z'
  return {
    id: overrides.id || 'item-1',
    correlationId: overrides.correlationId || 'corr-1',
    idempotencyKey: overrides.idempotencyKey || 'key-1',
    request: overrides.request || {
      actionId: 'network.fetchContext',
      detail: 'fetch project data',
      category: 'network',
      targetPath: '/workspace',
    },
    sourceDeviceClass: overrides.sourceDeviceClass || 'mobile',
    mode: overrides.mode || 'delegated-desktop',
    routeReason: overrides.routeReason || 'delegated',
    requiresApproval: overrides.requiresApproval ?? false,
    status: overrides.status || 'approved',
    replayCount: overrides.replayCount ?? 0,
    lastAttemptAt: overrides.lastAttemptAt || createdAt,
    createdAt,
    updatedAt: overrides.updatedAt || createdAt,
    note: overrides.note,
  }
}

test('recoverDelegatedQueue keeps privileged executing actions approval-gated', () => {
  const executingPrivileged = makeItem({
    id: 'privileged-1',
    requiresApproval: true,
    status: 'executing',
    request: {
      actionId: 'workspace.runToolCommand',
      detail: 'run migration',
      category: 'system',
      targetPath: '/repo',
    },
  })

  const recovered = recoverDelegatedQueue([executingPrivileged]).recovered[0]
  assert.equal(recovered.status, 'pending-approval')
  assert.equal(recovered.requiresApproval, true)
})

test('recoverDelegatedQueue resumes non-privileged executing actions as approved', () => {
  const executingSafe = makeItem({
    id: 'safe-1',
    requiresApproval: false,
    status: 'executing',
  })

  const recovered = recoverDelegatedQueue([executingSafe]).recovered[0]
  assert.equal(recovered.status, 'approved')
})

test('selectReplayCandidates returns deterministic order and safe-only filtering', () => {
  const items = [
    makeItem({
      id: 'z-item',
      createdAt: '2026-03-20T10:02:00.000Z',
      status: 'failed',
      request: {
        actionId: 'network.fetchContext',
        detail: 'late item',
        category: 'network',
        targetPath: '/a',
      },
    }),
    makeItem({
      id: 'a-item',
      createdAt: '2026-03-20T10:00:00.000Z',
      status: 'approved',
      request: {
        actionId: 'workspace.runToolCommand',
        detail: 'privileged item',
        category: 'system',
        targetPath: '/b',
      },
    }),
    makeItem({
      id: 'b-item',
      createdAt: '2026-03-20T10:01:00.000Z',
      status: 'approved',
      request: {
        actionId: 'chat.send',
        detail: 'safe item',
        category: 'chat',
        targetPath: '/c',
      },
    }),
  ]

  const safe = selectReplayCandidates(items, { safeOnly: true, statuses: ['approved', 'failed'], limit: 10 })
  assert.deepEqual(
    safe.map((item) => item.id),
    ['b-item', 'z-item'],
  )

  const all = selectReplayCandidates(items, { safeOnly: false, statuses: ['approved', 'failed'], limit: 10 })
  assert.deepEqual(
    all.map((item) => item.id),
    ['a-item', 'b-item', 'z-item'],
  )
})

test('idempotency key normalization is deterministic and stable', () => {
  const keyA = makeDelegatedIdempotencyKey({
    actionId: 'Workspace.RunToolCommand',
    detail: '  RUN MIGRATION  ',
    category: 'system',
    targetPath: '/Repo/Main',
  })

  const keyB = makeDelegatedIdempotencyKey({
    actionId: 'workspace.runtoolcommand',
    detail: 'run migration',
    category: 'system',
    targetPath: '/repo/main',
  })

  assert.equal(keyA, keyB)
})

test('enqueueDelegatedRequest keeps privileged actions pending-approval', () => {
  const queued = enqueueDelegatedRequest({
    request: {
      actionId: 'workspace.runToolCommand',
      detail: 'write file',
      category: 'filesystem',
      targetPath: '/repo/file.txt',
    },
    sourceDeviceClass: 'mobile',
    mode: 'delegated-desktop',
    routeReason: 'requires native automation',
    requiresApproval: true,
  })

  assert.equal(queued.status, 'pending-approval')
  assert.equal(queued.requiresApproval, true)
})
