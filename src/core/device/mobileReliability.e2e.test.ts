import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { detectAuditAnomaly } from '../../security/anomalyDetector'
import type { AuditEntry, AuditEventType } from '../../security/types'
import {
  enqueueDelegatedRequest,
  recoverDelegatedQueue,
  selectReplayCandidates,
  updateDelegatedStatus,
} from './delegationQueue'
import { deriveDeviceProfile, routeActionRequest } from './actionRouter'

function makeAuditEntry(id: string, type: AuditEventType, payload: Record<string, unknown>): AuditEntry {
  return {
    id,
    timestamp: new Date(`2026-03-20T10:00:${id.padStart(2, '0')}.000Z`).toISOString(),
    type,
    payload,
    prevHash: 'prev',
    hash: `hash-${id}`,
  }
}

test('pwa install prerequisites are present in manifest and service worker', () => {
  const manifestPath = path.resolve(process.cwd(), 'public/manifest.webmanifest')
  const swPath = path.resolve(process.cwd(), 'public/sw.js')

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>
  const swSource = readFileSync(swPath, 'utf-8')

  assert.equal(typeof manifest.name, 'string')
  assert.equal(typeof manifest.short_name, 'string')
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.start_url, '/')
  assert.equal(Array.isArray(manifest.icons), true)
  assert.equal(/addEventListener\('install'/.test(swSource), true)
  assert.equal(/addEventListener\('activate'/.test(swSource), true)
  assert.equal(/addEventListener\('fetch'/.test(swSource), true)
})

test('mobile delegated reliability flow is deterministic across restart and reconnect', async () => {
  const profile = deriveDeviceProfile({
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel)',
    isWebRuntime: true,
  })

  const privilegedRequest = {
    actionId: 'workspace.runToolCommand',
    category: 'system' as const,
    targetPath: '/repo',
    detail: 'run migration',
  }

  const safeRequest = {
    actionId: 'network.fetchContext',
    category: 'network' as const,
    targetPath: '/repo/status',
    detail: 'sync status',
  }

  const privilegedDecision = routeActionRequest(privilegedRequest, profile, {
    cloudRelayEnabled: true,
    desktopAdapterEnabled: true,
    emergencyCallRelayEnabled: true,
    burstThrottleActive: false,
  })

  assert.equal(privilegedDecision.mode, 'delegated-desktop')
  assert.equal(privilegedDecision.requiresApproval, true)

  let queue = [
    enqueueDelegatedRequest({
      request: privilegedRequest,
      sourceDeviceClass: profile.class,
      mode: privilegedDecision.mode,
      routeReason: privilegedDecision.reason,
      requiresApproval: privilegedDecision.requiresApproval,
    }),
    enqueueDelegatedRequest({
      request: safeRequest,
      sourceDeviceClass: profile.class,
      mode: 'delegated-desktop',
      routeReason: 'test replay',
      requiresApproval: false,
    }),
  ]

  // Simulate restart in the middle of execution.
  queue = updateDelegatedStatus(queue, queue[0].id, 'executing')
  const recovered = recoverDelegatedQueue(queue).recovered

  const recoveredPrivileged = recovered.find((item) => item.request.actionId === privilegedRequest.actionId)
  assert.equal(recoveredPrivileged?.status, 'pending-approval')

  const replayPlanA = selectReplayCandidates(recovered, {
    safeOnly: true,
    sourceDeviceClass: 'mobile',
    statuses: ['approved', 'failed'],
    limit: 12,
  })
  const replayPlanB = selectReplayCandidates(recovered, {
    safeOnly: true,
    sourceDeviceClass: 'mobile',
    statuses: ['approved', 'failed'],
    limit: 12,
  })

  assert.deepEqual(
    replayPlanA.map((item) => item.id),
    replayPlanB.map((item) => item.id),
  )
  assert.equal(
    replayPlanA.some((item) => item.request.category === 'system' || item.request.category === 'filesystem'),
    false,
  )

  const failureHistory: AuditEntry[] = [
    makeAuditEntry('1', 'action_result', { actionId: 'relay.sync', status: 'failed' }),
    makeAuditEntry('2', 'action_result', { actionId: 'relay.sync', status: 'failed' }),
  ]
  const latestFailure = makeAuditEntry('3', 'action_result', { actionId: 'relay.sync', status: 'failed' })
  const anomaly = detectAuditAnomaly(failureHistory, latestFailure)
  assert.equal(anomaly.detected, true)
  assert.equal(/retry storm/i.test(String(anomaly.reason || '')), true)

  const throttled = routeActionRequest(safeRequest, profile, {
    cloudRelayEnabled: true,
    desktopAdapterEnabled: true,
    emergencyCallRelayEnabled: true,
    burstThrottleActive: true,
  })
  assert.equal(throttled.mode, 'denied')
  assert.equal(/burst throttle/i.test(throttled.reason), true)

  const deterministicA = routeActionRequest(safeRequest, profile, {
    cloudRelayEnabled: true,
    desktopAdapterEnabled: true,
    emergencyCallRelayEnabled: true,
    burstThrottleActive: false,
  })
  await new Promise((resolve) => setTimeout(resolve, 20))
  const deterministicB = routeActionRequest(safeRequest, profile, {
    cloudRelayEnabled: true,
    desktopAdapterEnabled: true,
    emergencyCallRelayEnabled: true,
    burstThrottleActive: false,
  })

  assert.deepEqual(deterministicA, deterministicB)
})
