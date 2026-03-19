import type { ReactNode } from 'react'
import type { ModelProviderId, ProviderHealth, RoutingProfile } from '../../../core/models/router'

interface ModelsProps {
  defaultProfile: RoutingProfile
  fallbackOrder: ModelProviderId[]
  providers: ProviderHealth[]
  onProfileChange?: (profile: RoutingProfile) => void
  onProviderEnabledChange?: (providerId: ModelProviderId, enabled: boolean) => void
  onProviderKeyChange?: (providerId: ModelProviderId, apiKey: string) => void
  children?: ReactNode
}

const routingProfiles: RoutingProfile[] = [
  'quality-first',
  'balanced',
  'low-latency',
  'low-cost',
]

export function Models(props: ModelsProps) {
  const {
    defaultProfile,
    fallbackOrder,
    providers,
    onProfileChange,
    onProviderEnabledChange,
    onProviderKeyChange,
  } = props

  return (
    <div className="nova-surface">
      <div className="nova-stack">
        <div className="nova-card">
          <h3>Model Routing Configuration</h3>
          <p className="muted">
            Select routing profile and manage provider credentials. Paxion routes requests 
            based on defined profile and provider health/availability.
          </p>
        </div>

        <div className="nova-card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label htmlFor="routing-profile">Routing Profile</label>
              <select
                id="routing-profile"
                value={defaultProfile}
                onChange={(e) => onProfileChange?.(e.target.value as RoutingProfile)}
                className="nova-select"
              >
                {routingProfiles.map((profile) => (
                  <option key={profile} value={profile}>
                    {profile === 'quality-first'
                      ? 'Quality-First (prefer best model)'
                      : profile === 'balanced'
                        ? 'Balanced (speed + quality)'
                        : profile === 'low-latency'
                          ? 'Low-Latency (fastest response)'
                          : 'Low-Cost (cheapest API)'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="fallback-order">Fallback Order</label>
              <input
                id="fallback-order"
                type="text"
                value={fallbackOrder.join(' → ')}
                readOnly
                className="nova-input"
              />
            </div>
          </div>
        </div>

        <div className="nova-card">
          <h3>Providers</h3>
          <div className="nova-grid-cards">
            {providers.map((provider) => (
              <article
                key={provider.id}
                className={`nova-provider-card ${provider.ready ? 'is-ready' : 'is-pending'}`}
              >
                <div className="nova-provider-head">
                  <strong>{provider.id}</strong>
                  <span
                    className={`nova-health-indicator ${provider.health}`}
                    aria-label={`Provider ${provider.id} health: ${provider.health}`}
                  />
                </div>

                <p className="muted">
                  Status: <strong>{provider.ready ? 'Ready' : 'Pending'}</strong>
                </p>

                {provider.keyPreview && (
                  <p className="muted">
                    Key: <code>{provider.keyPreview}</code>
                  </p>
                )}

                <input
                  type="password"
                    value={provider.enabled ? (provider.id !== 'ollama' ? '••••••••' : '') : ''}
                  onChange={(e) => onProviderKeyChange?.(provider.id, e.target.value)}
                  placeholder={`API key for ${provider.id}`}
                  className="nova-input"
                  style={{ marginTop: '12px' }}
                />

                <button
                  className="run-button"
                  onClick={() =>
                    onProviderEnabledChange?.(
                      provider.id,
                      !provider.enabled
                    )
                  }
                  style={{ marginTop: '12px' }}
                >
                  {provider.enabled ? 'Disable' : 'Enable'}
                </button>
              </article>
            ))}
          </div>
        </div>

        <div className="nova-card">
          <h3>Provider Guide</h3>
          <ul className="muted">
            <li>
              <strong>OpenAI:</strong> GPT-4, GPT-4 Turbo. Requires API key from 
              platform.openai.com
            </li>
            <li>
              <strong>Anthropic:</strong> Claude 3 models. Get key from console.anthropic.com
            </li>
            <li>
              <strong>Google:</strong> Gemini models. Configure via Google Cloud console
            </li>
            <li>
              <strong>OpenRouter:</strong> Access multiple models via single provider. 
              Requires openrouter.ai key
            </li>
            <li>
              <strong>Ollama:</strong> Local inference engine (no API key needed). 
              Runs on http://127.0.0.1:11434
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
