export type FeatureFlags = {
  desktopAdapterEnabled: boolean
  cloudRelayEnabled: boolean
  memoryNormalizationEnabled: boolean
}

export const defaultFeatureFlags: FeatureFlags = {
  desktopAdapterEnabled: false,
  cloudRelayEnabled: false,
  memoryNormalizationEnabled: true,
}

const STORAGE_KEY = 'paxion.feature-flags.v1'

export function loadFeatureFlags(): FeatureFlags {
  if (typeof window === 'undefined') {
    return defaultFeatureFlags
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return defaultFeatureFlags
    }

    const parsed = JSON.parse(raw) as Partial<FeatureFlags>
    return {
      ...defaultFeatureFlags,
      ...(parsed && typeof parsed === 'object' ? parsed : {}),
    }
  } catch {
    return defaultFeatureFlags
  }
}

export function saveFeatureFlags(next: FeatureFlags): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Ignore storage write errors.
  }
}