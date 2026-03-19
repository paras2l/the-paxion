import type { ActionRequest } from '../../security/types'

export type DeviceClass = 'desktop' | 'mobile' | 'tablet' | 'smartglass'
export type ExecutionMode = 'direct' | 'delegated-desktop' | 'provider-backed' | 'denied'

export type DeviceProfile = {
  class: DeviceClass
  isWebRuntime: boolean
  supportsVoiceIo: boolean
  supportsNativeAutomation: boolean
  supportsBackgroundRuntime: boolean
}

export type DeviceRoutingFlags = {
  cloudRelayEnabled: boolean
  desktopAdapterEnabled: boolean
  emergencyCallRelayEnabled: boolean
  burstThrottleActive?: boolean
}

export type ActionRoutingDecision = {
  mode: ExecutionMode
  reason: string
  requiresApproval: boolean
}

function inferDeviceClass(userAgent: string, isWebRuntime: boolean): DeviceClass {
  const ua = userAgent.toLowerCase()
  const looksTablet = /ipad|tablet|sm-t|tab/i.test(ua)
  const looksSmartglass = /glass|vision|smart.?glass|hololens|xreal/i.test(ua)
  const looksMobile = /android|iphone|mobile/i.test(ua)

  if (!isWebRuntime) {
    return 'desktop'
  }

  if (looksSmartglass) {
    return 'smartglass'
  }

  if (looksTablet) {
    return 'tablet'
  }

  return looksMobile ? 'mobile' : 'desktop'
}

export function deriveDeviceProfile(input: { userAgent: string; isWebRuntime: boolean }): DeviceProfile {
  const deviceClass = inferDeviceClass(input.userAgent, input.isWebRuntime)

  if (deviceClass === 'desktop') {
    return {
      class: 'desktop',
      isWebRuntime: input.isWebRuntime,
      supportsVoiceIo: true,
      supportsNativeAutomation: !input.isWebRuntime,
      supportsBackgroundRuntime: !input.isWebRuntime,
    }
  }

  if (deviceClass === 'smartglass') {
    return {
      class: 'smartglass',
      isWebRuntime: true,
      supportsVoiceIo: true,
      supportsNativeAutomation: false,
      supportsBackgroundRuntime: false,
    }
  }

  return {
    class: deviceClass,
    isWebRuntime: true,
    supportsVoiceIo: true,
    supportsNativeAutomation: false,
    supportsBackgroundRuntime: false,
  }
}

function isDesktopOnlyAction(request: ActionRequest): boolean {
  const actionId = String(request.actionId || '')
  return (
    actionId === 'automation.desktopAppEdit'
    || actionId === 'workspace.runToolCommand'
    || actionId === 'vscode.executeCommand'
  )
}

function isProviderPreferredAction(request: ActionRequest): boolean {
  const actionId = String(request.actionId || '')
  return (
    actionId === 'media.generateAsset'
    || actionId === 'network.fetchContext'
    || actionId === 'learning.youtubeSegmentStudy'
  )
}

export function routeActionRequest(
  request: ActionRequest,
  profile: DeviceProfile,
  flags: DeviceRoutingFlags,
): ActionRoutingDecision {
  const requiresApproval = request.category === 'filesystem' || request.category === 'system'

  if (flags.burstThrottleActive) {
    return {
      mode: 'denied',
      reason: 'Burst throttle is active due to reliability guardrails. Retry after cooldown.',
      requiresApproval,
    }
  }

  if (isDesktopOnlyAction(request)) {
    if (profile.class === 'desktop' && profile.supportsNativeAutomation) {
      return {
        mode: 'direct',
        reason: 'Desktop runtime has required native automation capabilities.',
        requiresApproval,
      }
    }

    if (!flags.desktopAdapterEnabled) {
      return {
        mode: 'denied',
        reason: 'Desktop adapter feature flag is disabled for this action.',
        requiresApproval,
      }
    }

    return {
      mode: 'delegated-desktop',
      reason: 'Action requires desktop execution and will be delegated through secure bridge.',
      requiresApproval: true,
    }
  }

  if (request.actionId === 'voice.call' && !flags.emergencyCallRelayEnabled) {
    return {
      mode: 'denied',
      reason: 'Call relay capability is disabled in current policy state.',
      requiresApproval,
    }
  }

  if (isProviderPreferredAction(request) && flags.cloudRelayEnabled) {
    return {
      mode: 'provider-backed',
      reason: 'Provider-backed execution selected due to cloud relay availability.',
      requiresApproval,
    }
  }

  if (profile.class === 'smartglass') {
    return {
      mode: 'delegated-desktop',
      reason: 'Smart-glass mode prefers desktop delegation for reliability and safety.',
      requiresApproval,
    }
  }

  return {
    mode: 'direct',
    reason: 'Current device can execute this action directly under policy controls.',
    requiresApproval,
  }
}
