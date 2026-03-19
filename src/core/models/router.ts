export type ModelProviderId = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'ollama'

export type RoutingProfile = 'quality-first' | 'balanced' | 'low-latency' | 'low-cost'

export type ProviderConfig = {
  id: ModelProviderId
  label: string
  apiKey: string
  baseUrl?: string
  enabled: boolean
}

export type ModelRouterConfig = {
  defaultProfile: RoutingProfile
  fallbackOrder: ModelProviderId[]
  providers: ProviderConfig[]
}

export type ProviderHealth = {
  id: ModelProviderId
  label: string
  enabled: boolean
  ready: boolean
  health: 'ready' | 'missing-key' | 'disabled'
  keyPreview: string
}

const STORAGE_KEY = 'paxion.modelRouter.v1'

const DEFAULT_PROVIDERS: ProviderConfig[] = [
  { id: 'openai', label: 'OpenAI', apiKey: '', enabled: false },
  { id: 'anthropic', label: 'Anthropic', apiKey: '', enabled: false },
  { id: 'google', label: 'Google', apiKey: '', enabled: false },
  { id: 'openrouter', label: 'OpenRouter', apiKey: '', enabled: false },
  { id: 'ollama', label: 'Ollama', apiKey: '', baseUrl: 'http://127.0.0.1:11434', enabled: true },
]

const DEFAULT_CONFIG: ModelRouterConfig = {
  defaultProfile: 'balanced',
  fallbackOrder: ['openai', 'anthropic', 'google', 'openrouter', 'ollama'],
  providers: DEFAULT_PROVIDERS,
}

function cloneDefaultConfig(): ModelRouterConfig {
  return {
    defaultProfile: DEFAULT_CONFIG.defaultProfile,
    fallbackOrder: [...DEFAULT_CONFIG.fallbackOrder],
    providers: DEFAULT_CONFIG.providers.map((provider) => ({ ...provider })),
  }
}

function maskKey(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return 'not set'
  }
  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}****`
  }
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-3)}`
}

export function getDefaultModelRouterConfig(): ModelRouterConfig {
  return cloneDefaultConfig()
}

export function loadModelRouterConfig(): ModelRouterConfig {
  if (typeof window === 'undefined') {
    return cloneDefaultConfig()
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return cloneDefaultConfig()
    }

    const parsed = JSON.parse(raw) as Partial<ModelRouterConfig>
    const defaults = cloneDefaultConfig()

    const providerMap = new Map(defaults.providers.map((provider) => [provider.id, provider]))
    const mergedProviders = defaults.providers.map((provider) => {
      const incoming = Array.isArray(parsed.providers)
        ? parsed.providers.find((item) => item?.id === provider.id)
        : null
      if (!incoming) {
        return provider
      }
      return {
        ...provider,
        apiKey: typeof incoming.apiKey === 'string' ? incoming.apiKey : provider.apiKey,
        baseUrl: typeof incoming.baseUrl === 'string' ? incoming.baseUrl : provider.baseUrl,
        enabled: typeof incoming.enabled === 'boolean' ? incoming.enabled : provider.enabled,
      }
    })

    const fallbackOrder = Array.isArray(parsed.fallbackOrder)
      ? parsed.fallbackOrder.filter((id): id is ModelProviderId => providerMap.has(id as ModelProviderId))
      : defaults.fallbackOrder

    return {
      defaultProfile: parsed.defaultProfile ?? defaults.defaultProfile,
      fallbackOrder: fallbackOrder.length > 0 ? fallbackOrder : defaults.fallbackOrder,
      providers: mergedProviders,
    }
  } catch {
    return cloneDefaultConfig()
  }
}

export function saveModelRouterConfig(config: ModelRouterConfig): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // Ignore storage failures in restricted runtimes.
  }
}

export function deriveProviderHealth(providers: ProviderConfig[]): ProviderHealth[] {
  return providers.map((provider) => {
    const hasKey = provider.apiKey.trim().length > 0
    const ready = provider.enabled && (provider.id === 'ollama' || hasKey)
    let health: ProviderHealth['health'] = 'ready'

    if (!provider.enabled) {
      health = 'disabled'
    } else if (provider.id !== 'ollama' && !hasKey) {
      health = 'missing-key'
    }

    return {
      id: provider.id,
      label: provider.label,
      enabled: provider.enabled,
      ready,
      health,
      keyPreview: provider.id === 'ollama' ? 'local runtime' : maskKey(provider.apiKey),
    }
  })
}
