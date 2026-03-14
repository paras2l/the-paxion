'use strict'

function summarizeVaultProviders(state) {
  return {
    ok: true,
    providers: Array.isArray(state?.providers) ? state.providers : [],
    activeProvider: state?.activeProvider || 'local-safeStorage',
  }
}

function configureVaultProvider(state, input) {
  const provider = {
    id: String(input?.id || 'local-safeStorage').trim(),
    type: String(input?.type || 'local').trim(),
    endpoint: String(input?.endpoint || '').trim(),
    hasHsm: Boolean(input?.hasHsm),
    updatedAt: new Date().toISOString(),
  }
  return {
    ok: true,
    provider,
    state: {
      ...state,
      activeProvider: provider.id,
      providers: [...(Array.isArray(state?.providers) ? state.providers.filter((x) => x.id !== provider.id) : []), provider],
      updatedAt: provider.updatedAt,
    },
  }
}

module.exports = {
  summarizeVaultProviders,
  configureVaultProvider,
}
