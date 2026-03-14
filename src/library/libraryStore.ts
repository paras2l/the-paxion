import type { LibraryDocument } from './types'

function makeId(): string {
  return `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function makeExcerpt(text: string, maxLen = 220): string {
  const trimmed = text.trim()
  return trimmed.length <= maxLen ? trimmed : `${trimmed.slice(0, maxLen)}…`
}

export class LibraryStore {
  private docs: LibraryDocument[] = []

  add(
    name: string,
    content: string,
    source: LibraryDocument['source'] = 'paste',
  ): LibraryDocument {
    const doc: LibraryDocument = {
      id: makeId(),
      name: name.trim() || 'Untitled document',
      content: content.trim(),
      addedAt: new Date().toISOString(),
      wordCount: content.trim().split(/\s+/).filter(Boolean).length,
      excerpt: makeExcerpt(content),
      source,
    }
    this.docs.push(doc)
    return doc
  }

  remove(id: string): void {
    this.docs = this.docs.filter((d) => d.id !== id)
  }

  getAll(): LibraryDocument[] {
    return [...this.docs]
  }

  search(query: string): LibraryDocument[] {
    const q = query.toLowerCase().trim()
    if (!q) return this.getAll()
    return this.docs.filter(
      (d) => d.name.toLowerCase().includes(q) || d.content.toLowerCase().includes(q),
    )
  }
}
