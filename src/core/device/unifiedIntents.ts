import type { ActionRequest } from '../../security/types'
import type { ActionRoutingDecision, DeviceProfile, DeviceRoutingFlags, ExecutionMode } from './actionRouter'
import { routeActionRequest } from './actionRouter'

export type UnifiedIntentKind = 'general' | 'channel' | 'call'

export type UnifiedIntentDecision = {
  kind: UnifiedIntentKind
  primary: ActionRoutingDecision
  fallbackChain: ExecutionMode[]
  notes: string[]
}

function inferIntentKind(request: ActionRequest): UnifiedIntentKind {
  const actionId = String(request.actionId || '').toLowerCase()
  const detail = String(request.detail || '').toLowerCase()
  const target = String(request.targetPath || '').toLowerCase()

  if (
    actionId.includes('call')
    || actionId.includes('dial')
    || /\bcall\b|\bphone\b|\bdial\b/.test(detail)
  ) {
    return 'call'
  }

  if (
    actionId.includes('channel')
    || actionId.includes('message')
    || actionId.includes('whatsapp')
    || actionId.includes('telegram')
    || actionId.includes('discord')
    || target.includes('/channels/')
    || /\bmessage\b|\bsend\b|\bchannel\b|\bdiscord\b|\btelegram\b|\bwhatsapp\b/.test(detail)
  ) {
    return 'channel'
  }

  return 'general'
}

function appendFallback(
  chain: ExecutionMode[],
  notes: string[],
  mode: ExecutionMode,
  reason: string,
): void {
  if (!chain.includes(mode)) {
    chain.push(mode)
    notes.push(reason)
  }
}

export function buildUnifiedIntentDecision(
  request: ActionRequest,
  profile: DeviceProfile,
  flags: DeviceRoutingFlags,
): UnifiedIntentDecision {
  const kind = inferIntentKind(request)
  const primary = routeActionRequest(request, profile, flags)
  const fallbackChain: ExecutionMode[] = [primary.mode]
  const notes: string[] = [primary.reason]

  if (kind === 'call') {
    if (flags.cloudRelayEnabled) {
      appendFallback(
        fallbackChain,
        notes,
        'provider-backed',
        'Cloud relay can proxy call execution when direct call routing is unavailable.',
      )
    }
    if (flags.desktopAdapterEnabled) {
      appendFallback(
        fallbackChain,
        notes,
        'delegated-desktop',
        'Desktop delegation can execute telephony tasks under policy approval.',
      )
    }
  }

  if (kind === 'channel') {
    if (flags.cloudRelayEnabled) {
      appendFallback(
        fallbackChain,
        notes,
        'provider-backed',
        'Channel messaging can fail over to provider-backed relay path.',
      )
    }
    if (profile.class !== 'desktop' && flags.desktopAdapterEnabled) {
      appendFallback(
        fallbackChain,
        notes,
        'delegated-desktop',
        'Mobile and smart-glass channel tasks can be delegated to desktop authority.',
      )
    }
  }

  if (!fallbackChain.includes('direct') && profile.class === 'desktop' && profile.supportsNativeAutomation) {
    appendFallback(
      fallbackChain,
      notes,
      'direct',
      'Desktop environment remains available as a direct execution fallback.',
    )
  }

  if (!fallbackChain.includes('denied')) {
    appendFallback(
      fallbackChain,
      notes,
      'denied',
      'Policy deny remains terminal fallback if required capabilities are unavailable.',
    )
  }

  return {
    kind,
    primary,
    fallbackChain,
    notes,
  }
}
