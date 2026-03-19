import type { QueueItem } from '../execution/queue'

export type SessionMemoryRecord = {
  id: string
  channelId: string
  title: string
  compactSummary: string
  createdAt: string
  facts: number
  relevanceScore: number
}

export type ChannelMemorySchema = {
  id: string
  channelId: string
  roleContext: 'webchat' | 'telegram' | 'discord' | 'whatsapp' | 'system'
  title: string
  compactSummary: string
  createdAt: string
  eventCount: number
  tokensBudget: number
  relevanceScore: number
}

export type MemoryState = {
  sessions: SessionMemoryRecord[]
  totalDocuments: number
  totalWords: number
}

const STORAGE_KEY = 'paxion.control.memory.v1'

function clampScore(value: number): number {
  if (value < 1) return 1
  if (value > 100) return 100
  return Math.round(value)
}

function normalizeChannelId(value: string): ChannelMemorySchema['roleContext'] {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'telegram') return 'telegram'
  if (normalized === 'discord') return 'discord'
  if (normalized === 'whatsapp') return 'whatsapp'
  if (normalized === 'system') return 'system'
  return 'webchat'
}

function normalizeChannelMemory(raw: Partial<SessionMemoryRecord>): ChannelMemorySchema {
  const roleContext = normalizeChannelId(String(raw.channelId || 'webchat'))
  const facts = Number(raw.facts || 0)
  const eventCount = Math.max(1, Math.min(200, facts || 1))
  const tokensBudget = Math.max(256, 4096 - Math.min(3000, eventCount * 16))

  return {
    id: String(raw.id || `session-${Date.now().toString(36)}`),
    channelId: roleContext,
    roleContext,
    title: String(raw.title || 'Untitled Session'),
    compactSummary: String(raw.compactSummary || ''),
    createdAt: String(raw.createdAt || new Date().toISOString()),
    eventCount,
    tokensBudget,
    relevanceScore: clampScore(Number(raw.relevanceScore || 50)),
  }
}

export function loadMemoryState(): MemoryState | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<MemoryState>
    if (!Array.isArray(parsed.sessions)) {
      return null
    }

    return {
      sessions: parsed.sessions
        .filter((session) => session && typeof session.id === 'string')
        .slice(0, 50)
        .map((session) => {
          const normalized = normalizeChannelMemory(session)
          return {
            id: normalized.id,
            channelId: normalized.channelId,
            title: normalized.title,
            compactSummary: normalized.compactSummary,
            createdAt: normalized.createdAt,
            facts: normalized.eventCount,
            relevanceScore: normalized.relevanceScore,
          }
        }),
      totalDocuments: Number(parsed.totalDocuments || 0),
      totalWords: Number(parsed.totalWords || 0),
    }
  } catch {
    return null
  }
}

export function saveMemoryState(state: MemoryState): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage write failures in restricted contexts.
  }
}

export function deriveMemoryState(
  queueItems: QueueItem[],
  learnedSkills: string[],
  totalDocuments: number,
  totalWords: number,
): MemoryState {
  const generatedSessions: SessionMemoryRecord[] = queueItems
    .filter((item) => item.status === 'completed' || item.status === 'denied')
    .slice(0, 18)
    .map((item, index) => {
      const channelId = item.request.jurisdiction || 'webchat'
      const createdAt = item.completedAt || item.approvedAt || item.requestedAt
      const normalized = normalizeChannelMemory({
        id: item.id,
        channelId,
        title: item.actionId,
        compactSummary: item.detail || 'Policy-gated action evaluated by the runtime queue.',
        createdAt,
        facts: Math.max(1, Math.min(24, learnedSkills.length + index + 2)),
        relevanceScore: clampScore(80 - index * 2),
      })

      return {
        id: normalized.id,
        channelId: normalized.channelId,
        title: normalized.title,
        compactSummary: normalized.compactSummary,
        createdAt: normalized.createdAt,
        facts: normalized.eventCount,
        relevanceScore: normalized.relevanceScore,
      }
    })

  return {
    sessions: generatedSessions,
    totalDocuments,
    totalWords,
  }
}
