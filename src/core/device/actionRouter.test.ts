import test from 'node:test'
import assert from 'node:assert/strict'

import type { ActionRequest } from '../../security/types'
import { routeActionRequest, type DeviceProfile, type DeviceRoutingFlags } from './actionRouter'

const mobileProfile: DeviceProfile = {
  class: 'mobile',
  isWebRuntime: true,
  supportsVoiceIo: true,
  supportsNativeAutomation: false,
  supportsBackgroundRuntime: false,
}

const defaultFlags: DeviceRoutingFlags = {
  cloudRelayEnabled: true,
  desktopAdapterEnabled: true,
  emergencyCallRelayEnabled: true,
  burstThrottleActive: false,
}

test('routeActionRequest is deterministic across repeated evaluations', () => {
  const request: ActionRequest = {
    actionId: 'media.generateAsset',
    detail: 'generate image',
    category: 'network',
    targetPath: '/tmp/output.png',
  }

  const first = routeActionRequest(request, mobileProfile, defaultFlags)
  for (let i = 0; i < 25; i += 1) {
    const next = routeActionRequest(request, mobileProfile, defaultFlags)
    assert.deepEqual(next, first)
  }
})

test('routeActionRequest auto-throttles when burst throttle is active', () => {
  const request: ActionRequest = {
    actionId: 'network.fetchContext',
    detail: 'fetch status',
    category: 'network',
    targetPath: '/status',
  }

  const throttled = routeActionRequest(request, mobileProfile, {
    ...defaultFlags,
    burstThrottleActive: true,
  })

  assert.equal(throttled.mode, 'denied')
  assert.equal(/burst throttle/i.test(throttled.reason), true)
})

test('desktop-only actions from mobile remain delegated and approval-gated', () => {
  const request: ActionRequest = {
    actionId: 'workspace.runToolCommand',
    detail: 'run integration check',
    category: 'system',
    targetPath: '/repo',
  }

  const decision = routeActionRequest(request, mobileProfile, defaultFlags)
  assert.equal(decision.mode, 'delegated-desktop')
  assert.equal(decision.requiresApproval, true)
})
