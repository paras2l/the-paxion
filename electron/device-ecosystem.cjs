'use strict'

function registerEcosystemAdapter(state, input) {
  const adapter = {
    id: String(input?.id || `adapter-${Date.now().toString(36)}`),
    domain: String(input?.domain || 'general').trim(),
    protocol: String(input?.protocol || 'manual').trim(),
    target: String(input?.target || '').trim(),
    updatedAt: new Date().toISOString(),
  }
  return {
    ok: true,
    adapter,
    state: {
      ...state,
      adapters: [...(Array.isArray(state?.adapters) ? state.adapters : []), adapter].slice(-200),
      updatedAt: adapter.updatedAt,
    },
  }
}

function planDeviceAction(input) {
  return {
    ok: true,
    deviceAction: {
      target: String(input?.target || ''),
      action: String(input?.action || ''),
      requiresApproval: true,
      transport: String(input?.transport || 'manual'),
    },
  }
}

module.exports = {
  registerEcosystemAdapter,
  planDeviceAction,
}
