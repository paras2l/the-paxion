import type { ProviderHealth } from '../models/router'

export type AppFeatureKey =
  | 'userManagement'
  | 'thirdPartyIntegrations'
  | 'workflowBuilder'
  | 'notifications'
  | 'analytics'
  | 'pluginMarketplace'
  | 'mobileSupport'
  | 'backupRecovery'
  | 'onboarding'
  | 'endToEndEncryption'
  | 'localBrainLearning'
  | 'multimodelRouting'
  | 'multitasking'

export type IntegrationKey =
  | 'whatsapp'
  | 'instagram'
  | 'email'
  | 'slack'
  | 'teams'
  | 'google'
  | 'homeAssistant'
  | 'phoneCalls'
  | 'browserAutomation'

export type PermissionKey =
  | 'sendMessages'
  | 'readMessages'
  | 'makeCalls'
  | 'browseWeb'
  | 'sendEmail'
  | 'postSocial'
  | 'editFiles'
  | 'runTools'
  | 'homeAutomation'

export type FeatureToggleState = Record<AppFeatureKey, boolean>
export type IntegrationState = Record<IntegrationKey, boolean>
export type PermissionState = Record<PermissionKey, boolean>

export const defaultFeatureToggles: FeatureToggleState = {
  userManagement: true,
  thirdPartyIntegrations: true,
  workflowBuilder: true,
  notifications: true,
  analytics: true,
  pluginMarketplace: true,
  mobileSupport: true,
  backupRecovery: true,
  onboarding: true,
  endToEndEncryption: true,
  localBrainLearning: true,
  multimodelRouting: true,
  multitasking: true,
}

export const defaultIntegrationState: IntegrationState = {
  whatsapp: false,
  instagram: false,
  email: true,
  slack: false,
  teams: false,
  google: true,
  homeAssistant: false,
  phoneCalls: false,
  browserAutomation: true,
}

export const defaultPermissionState: PermissionState = {
  sendMessages: false,
  readMessages: true,
  makeCalls: false,
  browseWeb: true,
  sendEmail: false,
  postSocial: false,
  editFiles: false,
  runTools: false,
  homeAutomation: false,
}

export function selectBestModel(providerHealth: ProviderHealth[]): string {
  const ready = providerHealth.filter((provider) => provider.ready)
  if (ready.length === 0) {
    return 'local-fallback'
  }

  const priority = ['openai', 'anthropic', 'google', 'openrouter', 'ollama']
  const best = ready.sort(
    (a, b) => priority.indexOf(a.id) - priority.indexOf(b.id),
  )[0]

  return best.id
}

export function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
