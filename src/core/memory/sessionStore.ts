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
        .map((session) => ({
          id: String(session.id),
          channelId: String(session.channelId || 'webchat'),
          title: String(session.title || 'Untitled Session'),
          compactSummary: String(session.compactSummary || ''),
          createdAt: String(session.createdAt || new Date().toISOString()),
          facts: Number(session.facts || 0),
          relevanceScore: clampScore(Number(session.relevanceScore || 50)),
        })),
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
      return {
        id: item.id,
        channelId,
        title: item.actionId,
        compactSummary: item.detail || 'Policy-gated action evaluated by the runtime queue.',
        createdAt,
        facts: Math.max(1, Math.min(24, learnedSkills.length + index + 2)),
        relevanceScore: clampScore(80 - index * 2),
      }
    })

  return {
    sessions: generatedSessions,
    totalDocuments,
    totalWords,
  }
}
