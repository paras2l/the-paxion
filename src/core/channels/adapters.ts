export type ChannelAdapterId = 'webchat' | 'telegram' | 'discord' | 'whatsapp'

export type ChannelAdapterState = 'connected' | 'pending' | 'disabled'

export type ChannelAdapter = {
  id: ChannelAdapterId
  name: string
  enabled: boolean
  status: ChannelAdapterState
  description: string
  lastActiveAt?: string
  mode: 'local' | 'relay'
}

export type ChannelAdapterSeed = {
  id: string
  label: string
  status: ChannelAdapterState
  detail: string
}

const ORDER: ChannelAdapterId[] = ['webchat', 'telegram', 'discord', 'whatsapp']

const FALLBACK_LABELS: Record<ChannelAdapterId, string> = {
  webchat: 'WebChat',
  telegram: 'Telegram',
  discord: 'Discord',
  whatsapp: 'WhatsApp',
}

function toChannelId(raw: string): ChannelAdapterId {
  if (raw === 'telegram' || raw === 'discord' || raw === 'whatsapp') {
    return raw
  }
  return 'webchat'
}

function nowIso(): string {
  return new Date().toISOString()
}

export function createChannelAdapters(seed: ChannelAdapterSeed[]): ChannelAdapter[] {
  const seeded = new Map(seed.map((channel) => [toChannelId(channel.id), channel]))

  return ORDER.map((id) => {
    const item = seeded.get(id)
    const status: ChannelAdapterState = item?.status ?? (id === 'webchat' ? 'connected' : 'disabled')
    return {
      id,
      name: item?.label ?? FALLBACK_LABELS[id],
      enabled: status !== 'disabled',
      status,
      description: item?.detail ?? `${FALLBACK_LABELS[id]} adapter is ready for gateway connection.`,
      lastActiveAt: status === 'connected' ? nowIso() : undefined,
      mode: id === 'webchat' ? 'local' : 'relay',
    }
  })
}

export function toggleChannelAdapter(
  current: ChannelAdapter[],
  channelId: ChannelAdapterId,
  enabled: boolean,
): ChannelAdapter[] {
  return current.map((channel) => {
    if (channel.id !== channelId) {
      return channel
    }

    if (!enabled) {
      return {
        ...channel,
        enabled: false,
        status: 'disabled',
        description: `${channel.name} adapter disabled from ControlShell.`,
      }
    }

    const status: ChannelAdapterState = channel.id === 'webchat' ? 'connected' : 'pending'
    return {
      ...channel,
      enabled: true,
      status,
      description:
        channel.id === 'webchat'
          ? 'WebChat adapter is active in local runtime.'
          : `${channel.name} adapter enabled. Waiting for token/webhook handshake.`,
      lastActiveAt: status === 'connected' ? nowIso() : channel.lastActiveAt,
    }
  })
}

export function countConnectedAdapters(channels: ChannelAdapter[]): number {
  return channels.filter((channel) => channel.status === 'connected').length
}
