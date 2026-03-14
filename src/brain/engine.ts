import type { LibraryDocument } from '../library/types'
import {
  BOUNDARY_PATTERNS,
  CORE_IDENTITY,
  GREETING_PATTERNS,
  IDENTITY_PATTERNS,
  PAXION_REPLIES,
  STATUS_PATTERNS,
} from './knowledge'
import type { BrainResponse, ConfidenceLevel } from './types'

// ── Text utilities ──

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'is', 'are', 'was',
  'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'it', 'its', 'this', 'that', 'these', 'those',
  'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
  'his', 'our', 'their', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'of', 'with',
  'by', 'from', 'as', 'into', 'through', 'about', 'up', 'out', 'if', 'then', 'so', 'not',
  'no', 'yes', 'just', 'more', 'also', 'very', 'much', 'than', 'too', 'now', 'like', 'go',
  'get', 'make', 'use', 'one', 'two', 'three', 'some', 'all', 'any', 'each', 'there', 'here',
  'after', 'before', 'over', 'under', 'same', 'such',
])

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Score a document by how many query keywords appear in it (title weighted 4x).
function scoreDoc(keywords: string[], doc: LibraryDocument): number {
  if (keywords.length === 0) return 0
  const titleLow = doc.name.toLowerCase()
  const contentLow = doc.content.toLowerCase()
  let score = 0

  for (const kw of keywords) {
    if (titleLow.includes(kw)) score += 4
    // Count non-overlapping occurrences in content, capped at 8 per keyword.
    let idx = 0
    let count = 0
    while ((idx = contentLow.indexOf(kw, idx)) !== -1 && count < 8) {
      count++
      idx += kw.length
    }
    score += count
  }

  return score
}

// Extract the sentences from a document most relevant to the query.
function extractPassages(query: string, content: string, maxPassages = 5): string[] {
  const keywords = extractKeywords(query)

  // Split on sentence terminators and paragraph breaks.
  const sentences = content
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 30)

  const scored = sentences
    .map((text) => {
      const low = text.toLowerCase()
      const score = keywords.reduce((acc, kw) => acc + (low.includes(kw) ? 1 : 0), 0)
      return { text, score }
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, maxPassages).map((s) => s.text)
}

function totalWords(library: LibraryDocument[]): number {
  return library.reduce((acc, d) => acc + d.wordCount, 0)
}

// ── PaxionBrain ──

export class PaxionBrain {
  think(query: string, library: LibraryDocument[]): BrainResponse {
    const steps: string[] = []
    const q = query.toLowerCase().trim()

    // ── Greeting ──
    if (GREETING_PATTERNS.some((p) => q === p || q.startsWith(p + ' ') || q.endsWith(` ${p}`))) {
      return {
        reply: pick(PAXION_REPLIES.greeting),
        contextDocs: [],
        reasoningSteps: ['Greeting pattern detected. Core response activated.'],
        confidence: 'high',
      }
    }

    // ── Identity / self-description ──
    if (IDENTITY_PATTERNS.some((p) => q.includes(p))) {
      return {
        reply: PAXION_REPLIES.identity(library.length, totalWords(library)),
        contextDocs: [],
        reasoningSteps: ['Identity query detected. Core knowledge invoked.'],
        confidence: 'high',
      }
    }

    // ── Status / knowledge report ──
    if (STATUS_PATTERNS.some((p) => q.includes(p))) {
      return {
        reply: PAXION_REPLIES.status(library.length, totalWords(library)),
        contextDocs: [],
        reasoningSteps: ['Status query detected. Reporting Neural Index state.'],
        confidence: 'high',
      }
    }

    // ── Boundary check ──
    if (BOUNDARY_PATTERNS.some((p) => q.includes(p))) {
      return {
        reply: `${CORE_IDENTITY.name} operates within strict boundaries set by Paro the Chief.\nHarmful or illegal actions require explicit codeword authorization ("paro the chief").\nWithout that authorization, I am required to decline.`,
        contextDocs: [],
        reasoningSteps: ['Boundary keyword detected. Policy gate engaged.'],
        confidence: 'high',
      }
    }

    // ── Library knowledge search ──
    steps.push(`Scanning Neural Index (${library.length} documents)…`)

    if (library.length === 0) {
      return {
        reply: pick(PAXION_REPLIES.emptyLibrary),
        contextDocs: [],
        reasoningSteps: steps,
        confidence: 'none',
      }
    }

    const keywords = extractKeywords(q)
    steps.push(
      keywords.length > 0
        ? `Keywords extracted: [${keywords.slice(0, 10).join(', ')}]`
        : 'No significant keywords found in query.',
    )

    if (keywords.length === 0) {
      return {
        reply: pick(PAXION_REPLIES.unknown),
        contextDocs: [],
        reasoningSteps: steps,
        confidence: 'none',
      }
    }

    const scored = library
      .map((doc) => ({ doc, score: scoreDoc(keywords, doc) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)

    if (scored.length === 0) {
      steps.push('Library scan: no relevant documents found.')
      return {
        reply: pick(PAXION_REPLIES.notFound),
        contextDocs: [],
        reasoningSteps: steps,
        confidence: 'none',
      }
    }

    // Use top 2 documents for answer synthesis.
    const topDocs = scored.slice(0, 2)
    steps.push(
      `Matched: ${topDocs.map((x) => `"${x.doc.name}" (score ${x.score})`).join(' | ')}`,
    )

    const allPassages: string[] = []
    for (const { doc } of topDocs) {
      const passages = extractPassages(q, doc.content)
      allPassages.push(...passages)
      steps.push(`Extracted ${passages.length} passage(s) from "${doc.name}"`)
    }

    if (allPassages.length === 0) {
      steps.push('Documents were matched but no relevant passages could be isolated.')
      return {
        reply: pick(PAXION_REPLIES.notFound),
        contextDocs: topDocs.map((x) => x.doc.name),
        reasoningSteps: steps,
        confidence: 'low',
      }
    }

    const passageBlock = allPassages.slice(0, 5).join('\n\n')
    const reply = `${pick(PAXION_REPLIES.found)}\n\n${passageBlock}`

    const topScore = topDocs[0].score
    const confidence: ConfidenceLevel =
      topScore >= 12 ? 'high' : topScore >= 5 ? 'medium' : 'low'

    return {
      reply,
      contextDocs: topDocs.map((x) => x.doc.name),
      reasoningSteps: steps,
      confidence,
    }
  }
}
