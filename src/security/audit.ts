import type { AuditEntry, AuditEventType } from './types'

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue)
  }

  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>
    const sortedEntries = Object.keys(input)
      .sort()
      .map((key) => [key, sortValue(input[key])])

    return Object.fromEntries(sortedEntries)
  }

  return value
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(digest)
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function makeEntryId(index: number): string {
  return `log-${index + 1}`
}

export class AuditLedger {
  private entries: AuditEntry[] = []

  getAll(): AuditEntry[] {
    return [...this.entries]
  }

  /** Restore a previously persisted set of entries (e.g. loaded from disk via IPC). */
  loadExternal(entries: AuditEntry[]): void {
    this.entries = [...entries]
  }

  async append(type: AuditEventType, payload: Record<string, unknown>): Promise<AuditEntry> {
    const prevHash = this.entries.at(-1)?.hash ?? 'GENESIS'
    const entrySeed = {
      id: makeEntryId(this.entries.length),
      timestamp: new Date().toISOString(),
      type,
      payload,
      prevHash,
    }

    const hash = await sha256(stableStringify(entrySeed))
    const entry: AuditEntry = {
      ...entrySeed,
      hash,
    }

    this.entries.push(entry)
    return entry
  }
}
