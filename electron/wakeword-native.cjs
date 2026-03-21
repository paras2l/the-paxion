'use strict'

function configureWakewordAdapter(state, input) {
  const adapter = {
    provider: String(input?.provider || 'browser-fallback').trim() || 'browser-fallback',
    modelPath: String(input?.modelPath || '').trim(),
    keyword: String(input?.keyword || 'raizen wakeup').trim().toLowerCase(),
    status: 'configured',
    updatedAt: new Date().toISOString(),
  }
  return {
    ok: true,
    adapter,
    state: {
      ...state,
      adapter,
      updatedAt: adapter.updatedAt,
    },
  }
}

function getNativeWakewordStatus(state) {
  return {
    ok: true,
    status: state?.adapter || {
      provider: 'browser-fallback',
      keyword: 'raizen wakeup',
      status: 'not-configured',
      updatedAt: null,
    },
  }
}

module.exports = {
  configureWakewordAdapter,
  getNativeWakewordStatus,
}
