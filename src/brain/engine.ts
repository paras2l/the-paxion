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

  if (titleLow.includes('[concept]') || titleLow.includes('concept distillation')) {
    score += 6
  }

  return score
}

type DocChunk = {
  text: string
  startWord: number
}

function buildChunks(content: string, wordsPerChunk = 130, overlap = 28): DocChunk[] {
  const words = content
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)

  if (words.length === 0) {
    return []
  }

  const chunks: DocChunk[] = []
  const step = Math.max(20, wordsPerChunk - overlap)
  for (let i = 0; i < words.length; i += step) {
    const text = words.slice(i, i + wordsPerChunk).join(' ').trim()
    if (text.length >= 80) {
      chunks.push({ text, startWord: i + 1 })
    }
    if (i + wordsPerChunk >= words.length) {
      break
    }
  }

  return chunks
}

function scoreChunk(keywords: string[], chunkText: string): number {
  if (keywords.length === 0) return 0
  const low = chunkText.toLowerCase()
  let score = 0

  for (const kw of keywords) {
    if (low.includes(kw)) {
      score += 2
    }

    let idx = 0
    let count = 0
    while ((idx = low.indexOf(kw, idx)) !== -1 && count < 6) {
      count += 1
      idx += kw.length
    }
    score += count
  }

  return score
}

function extractPassages(query: string, content: string, maxPassages = 4): DocChunk[] {
  const keywords = extractKeywords(query)
  const chunks = buildChunks(content)

  const scored = chunks
    .map((chunk) => ({
      chunk,
      score: scoreChunk(keywords, chunk.text),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, maxPassages).map((item) => item.chunk)
}

function totalWords(library: LibraryDocument[]): number {
  return library.reduce((acc, d) => acc + d.wordCount, 0)
}

type CoreKnowledgeCard = {
  topic: string
  keywords: string[]
  principles: string[]
}

const CORE_KNOWLEDGE_CARDS: CoreKnowledgeCard[] = [
  {
    topic: 'C language fundamentals',
    keywords: ['c', 'pointer', 'malloc', 'free', 'struct', 'segmentation', 'buffer'],
    principles: [
      'Manage memory manually: pair every successful allocation with free and guard against leaks.',
      'Prefer explicit bounds checks for arrays and strings to avoid overflow vulnerabilities.',
      'Use small, testable functions and clear struct layouts to keep low-level code maintainable.',
    ],
  },
  {
    topic: 'C++ systems and performance',
    keywords: ['c++', 'cpp', 'stl', 'template', 'constexpr', 'raii', 'move semantics'],
    principles: [
      'Use RAII and smart pointers to eliminate manual lifetime bugs.',
      'Prefer value semantics by default and apply move semantics for heavy objects.',
      'Profile before optimizing; focus on data layout and hot-path allocations.',
    ],
  },
  {
    topic: 'Java architecture and OOP',
    keywords: ['java', 'jvm', 'class', 'object', 'interface', 'spring', 'thread'],
    principles: [
      'Model behavior with interfaces and composition before deep inheritance trees.',
      'Keep business logic pure and isolate IO side effects for easier testing.',
      'Use immutable value objects where possible to reduce threading and state bugs.',
    ],
  },
  {
    topic: 'Python engineering',
    keywords: ['python', 'pandas', 'numpy', 'asyncio', 'typing', 'pytest'],
    principles: [
      'Write readable functions with type hints and docstrings for long-term maintainability.',
      'Use virtual environments and pinned dependencies for reproducible builds.',
      'Add tests around edge cases first, then optimize hotspots with profiling data.',
    ],
  },
  {
    topic: 'JavaScript and TypeScript runtime engineering',
    keywords: ['javascript', 'typescript', 'node', 'react', 'event loop', 'async', 'promise'],
    principles: [
      'Control async flow explicitly to avoid race conditions and hidden state bugs.',
      'Keep pure domain logic separate from UI/framework glue code.',
      'Use typed contracts and schema validation at all external boundaries.',
    ],
  },
  {
    topic: 'Julia for scientific and numeric computing',
    keywords: ['julia', 'multiple dispatch', 'scientific computing', 'dataframes.jl', 'flux', 'differential equations'],
    principles: [
      'Design around multiple dispatch and concrete types for speed and clarity.',
      'Benchmark with representative inputs and avoid global mutable state in hot loops.',
      'Keep notebooks exploratory but move core logic into reusable modules.',
    ],
  },
  {
    topic: 'R for statistics and analytical workflows',
    keywords: ['r language', 'rstudio', 'tidyverse', 'ggplot', 'dplyr', 'statistics', 'regression'],
    principles: [
      'Build reproducible pipelines with explicit data-cleaning and transformation steps.',
      'Validate assumptions before selecting statistical models.',
      'Communicate results with clear visualizations and uncertainty context.',
    ],
  },
  {
    topic: 'Data structures and algorithms',
    keywords: ['algorithm', 'complexity', 'dsa', 'graph', 'tree', 'dp', 'binary search'],
    principles: [
      'Start with time and space complexity targets before implementing the final approach.',
      'Choose data structures by access pattern: hash maps for lookup, heaps for priority, trees for ordering.',
      'Validate with adversarial tests, not only happy-path examples.',
    ],
  },
  {
    topic: 'Debugging and reliability',
    keywords: ['debug', 'bug', 'error', 'trace', 'crash', 'test', 'fix'],
    principles: [
      'Reproduce consistently first, then isolate minimal failing scope.',
      'Instrument assumptions with logs/assertions instead of guessing.',
      'Fix root cause and add a regression test to lock the issue down.',
    ],
  },
  {
    topic: 'System design mindset',
    keywords: ['system design', 'scalability', 'cache', 'queue', 'latency', 'throughput', 'availability'],
    principles: [
      'Define SLOs and load profile before selecting architecture patterns.',
      'Separate stateless compute from durable state to scale independently.',
      'Design observability early: metrics, traces, alerts, and failure budgets.',
    ],
  },
  {
    topic: 'Human conversation and empathy',
    keywords: ['talk', 'conversation', 'friend', 'relationship', 'understand', 'listen', 'empathy'],
    principles: [
      'Listen first, reflect what the person is feeling, then answer with clarity.',
      'Be direct but warm: useful guidance without robotic tone.',
      'When uncertain, ask one focused follow-up instead of pretending certainty.',
    ],
  },
  {
    topic: 'Decision making and critical thinking',
    keywords: ['decide', 'choice', 'option', 'confused', 'overthinking', 'priority', 'plan'],
    principles: [
      'Clarify goal, constraints, and trade-offs before choosing a path.',
      'Compare 2-3 options with pros, risks, and reversibility.',
      'Pick a small next action now, then iterate with feedback.',
    ],
  },
  {
    topic: 'Learning and skill growth',
    keywords: ['learn', 'study', 'practice', 'improve', 'focus', 'habit', 'discipline'],
    principles: [
      'Break big topics into short cycles: learn, apply, review, refine.',
      'Use active recall and deliberate practice instead of passive reading only.',
      'Track progress weekly and adjust plan by results, not mood alone.',
    ],
  },
]

type MentorDomain = 'c' | 'cpp' | 'java' | 'python' | 'javascript' | 'julia' | 'r' | 'system-design'

function detectMentorDomain(query: string): MentorDomain | null {
  const q = query.toLowerCase()
  if (/\b(system design|scalability|distributed|availability|throughput|latency)\b/.test(q)) {
    return 'system-design'
  }
  if (/\b(c\+\+|cpp|stl|raii|constexpr|template metaprogramming)\b/.test(q)) return 'cpp'
  if (/\b(java|jvm|spring|maven|gradle)\b/.test(q)) return 'java'
  if (/\b(python|pandas|numpy|django|flask)\b/.test(q)) return 'python'
  if (/\b(javascript|typescript|node|react|nextjs|vite|promise|event loop)\b/.test(q)) return 'javascript'
  if (/\b(julia|multiple dispatch|dataframes\.jl|flux\.jl|julia package)\b/.test(q)) return 'julia'
  if (/\b(r language|rstudio|tidyverse|ggplot|dplyr|caret|shiny)\b/.test(q)) return 'r'
  if (/\b(c|pointer|malloc|free|segmentation|struct)\b/.test(q)) return 'c'
  return null
}

function detectMentorProblemType(query: string): 'debugging' | 'design' | 'optimization' | 'interview' | 'implementation' {
  const q = query.toLowerCase()
  if (/\b(debug|bug|fix|error|crash|failing|issue)\b/.test(q)) return 'debugging'
  if (/\b(design|architecture|system|component|service|api)\b/.test(q)) return 'design'
  if (/\b(optimi[sz]e|performance|latency|memory|slow|throughput)\b/.test(q)) return 'optimization'
  if (/\b(interview|prep|question|leetcode|dsa round)\b/.test(q)) return 'interview'
  return 'implementation'
}

function buildMentorTemplate(
  domain: MentorDomain,
  query: string,
  problemType: 'debugging' | 'design' | 'optimization' | 'interview' | 'implementation',
): string {
  const titleByDomain = {
    c: 'C Problem-Solving Template',
    cpp: 'C++ Problem-Solving Template',
    java: 'Java Problem-Solving Template',
    python: 'Python Problem-Solving Template',
    javascript: 'JavaScript/TypeScript Template',
    julia: 'Julia Scientific Computing Template',
    r: 'R Analytics Template',
    'system-design': 'System Design Template',
  }

  const checksByDomain = {
    c: ['Input constraints and memory model', 'Pointer safety and bounds', 'Time/space complexity', 'Edge-case tests'],
    cpp: ['Ownership model and RAII usage', 'STL/container choice', 'Copy/move behavior and object lifetime', 'Benchmark + sanitizer checks'],
    java: ['Domain model and interfaces', 'Exception and null handling', 'Thread-safety/immutability', 'Unit/integration tests'],
    python: ['Data model and typed interfaces', 'Readable decomposition', 'Performance profile hotspots', 'Pytest coverage for edge paths'],
    javascript: ['Input/output schema validation', 'Async control flow and error boundaries', 'State management consistency', 'Unit + integration tests'],
    julia: ['Type stability and dispatch design', 'Array/vectorization strategy', 'BenchmarkTools profile results', 'Numerical correctness checks'],
    r: ['Data cleaning/reproducibility pipeline', 'Model assumption checks', 'Statistical significance and effect size', 'Plot quality and interpretation'],
    'system-design': ['SLO and traffic profile', 'API and data model', 'Scaling and failure strategy', 'Observability and rollout plan'],
  }

  const actionByDomain = {
    c: 'Draft function signatures, then implement safest correct version first before micro-optimizing.',
    cpp: 'Design ownership and interfaces first, then implement with RAII and profile-guided tuning.',
    java: 'Design interfaces and value objects first, then implement services and tests.',
    python: 'Start with clear function contracts and tests, then optimize bottlenecks with profiling.',
    javascript: 'Lock contracts and async paths first, then implement thin, testable modules.',
    julia: 'Start with numerically correct baseline and type-stable functions before optimization.',
    r: 'Build a reproducible data pipeline first, then iterate modeling and reporting quality.',
    'system-design': 'Start with requirements and constraints, then iteratively evolve architecture with trade-off notes.',
  }

  const focusByProblemType = {
    debugging: [
      'Collect exact failing input, expected output, and observed output first.',
      'Instrument assumptions and isolate first incorrect state transition.',
      'Patch root cause, then lock with a regression test.',
    ],
    design: [
      'Define constraints, interfaces, and ownership boundaries.',
      'Document trade-offs (simplicity, cost, scalability, reliability).',
      'Propose phased rollout with measurable acceptance criteria.',
    ],
    optimization: [
      'Measure baseline with reproducible benchmark before changing code.',
      'Target top bottleneck only, then re-measure impact.',
      'Guard performance gains with tests and telemetry thresholds.',
    ],
    interview: [
      'State brute-force approach first, then improve with better data structure.',
      'Explain complexity clearly and justify each optimization.',
      'Close with edge cases and test walkthrough.',
    ],
    implementation: [
      'Break work into smallest compilable milestones.',
      'Validate each milestone with quick tests before moving forward.',
      'Capture assumptions explicitly so later changes stay safe.',
    ],
  }

  const checks = checksByDomain[domain].map((item, idx) => `${idx + 1}. ${item}`).join('\n')
  const focus = focusByProblemType[problemType].map((item, idx) => `${idx + 1}. ${item}`).join('\n')

  return [
    `Mentor Mode: ${titleByDomain[domain]}`,
    `Problem mode: ${problemType}`,
    '',
    `Problem focus: ${query}`,
    '',
    'Step-by-step solve flow:',
    '1. Restate the problem in one precise sentence.',
    '2. Define constraints, inputs, outputs, and failure cases.',
    '3. Pick an approach and justify trade-offs.',
    '4. Implement/architect in small verifiable pieces.',
    '5. Validate with edge cases and performance checks.',
    '',
    'Domain checklist:',
    checks,
    '',
    'Problem-mode checklist:',
    focus,
    '',
    `Execution advice: ${actionByDomain[domain]}`,
  ].join('\n')
}

const POLYGLOT_LANGUAGE_HINTS: Array<{ name: string; regex: RegExp; strengths: string[] }> = [
  {
    name: 'Python',
    regex: /\bpython\b/i,
    strengths: ['AI/ML ecosystem', 'Rapid prototyping', 'Automation and tooling'],
  },
  {
    name: 'C',
    regex: /\bc language\b|\bc\b/i,
    strengths: ['Low-level control', 'Embedded/runtime components', 'Predictable memory behavior'],
  },
  {
    name: 'C++',
    regex: /\bc\+\+\b|\bcpp\b/i,
    strengths: ['High-performance systems', 'Native engines', 'Low-latency compute'],
  },
  {
    name: 'Java',
    regex: /\bjava\b/i,
    strengths: ['Scalable backend services', 'Mature tooling', 'Large enterprise systems'],
  },
  {
    name: 'Julia',
    regex: /\bjulia\b/i,
    strengths: ['Numerical/scientific computing', 'High-level syntax with speed', 'Research-heavy workloads'],
  },
  {
    name: 'R',
    regex: /\br language\b|\br\b|\btidyverse\b/i,
    strengths: ['Statistics and analytics', 'Data exploration', 'Reporting/visualization'],
  },
  {
    name: 'JavaScript',
    regex: /\bjavascript\b|\btypescript\b|\bnode\b/i,
    strengths: ['Web product layer', 'Cross-platform UX', 'Realtime app logic'],
  },
]

function detectPolyglotLanguages(query: string): string[] {
  return POLYGLOT_LANGUAGE_HINTS.filter((entry) => entry.regex.test(query)).map((entry) => entry.name)
}

function buildPolyglotStrategyReply(languages: string[]): string {
  const unique = Array.from(new Set(languages))
  const lines = unique
    .map((lang) => {
      const found = POLYGLOT_LANGUAGE_HINTS.find((entry) => entry.name === lang)
      if (!found) return null
      return `- ${found.name}: ${found.strengths.join(' | ')}`
    })
    .filter((line): line is string => Boolean(line))

  return [
    `Polyglot architecture detected (${unique.join(', ')}).`,
    'Best role split:',
    ...lines,
    '',
    'Execution rule: keep one language per responsibility boundary, define API contracts between them, and benchmark bottlenecks before adding complexity.',
  ].join('\n')
}

function buildCoreKnowledgeAnswer(query: string): string | null {
  const q = query.toLowerCase()
  const ranked = CORE_KNOWLEDGE_CARDS
    .map((card) => {
      const score = card.keywords.reduce((acc, kw) => acc + (q.includes(kw) ? 1 : 0), 0)
      return { card, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  if (ranked.length === 0) return null

  const top = ranked.slice(0, 2)
  const body = top
    .map(({ card }) => `From ${card.topic}:\n- ${card.principles.join('\n- ')}`)
    .join('\n\n')

  return `I can guide you from core engineering knowledge even before a matching library source exists.\n\n${body}\n\nIf you want deeper precision on your project, feed me targeted docs and I will align this guidance to your exact stack.`
}

function buildGeneralCommonKnowledgeReply(query: string): string | null {
  const q = query.toLowerCase()

  if (/\b(stress|anxiety|overwhelm|burnout|tired)\b/.test(q)) {
    return [
      'You sound overloaded. Quick stabilizer:',
      '1. Reduce to one priority for the next 60-90 minutes.',
      '2. Do one visible action now (write, fix, or decide one thing).',
      '3. Take a short reset break and continue with a smaller scope.',
      'If you want, I can help you turn your current mess into a 3-step plan.',
    ].join('\n')
  }

  if (/\b(career|job|resume|interview|promotion|switch)\b/.test(q)) {
    return [
      'Career decision framework:',
      '- Pick target role and timeline first.',
      '- Identify top 3 skill gaps blocking that role.',
      '- Build one proof artifact per gap (project, write-up, measurable result).',
      '- Practice interviews weekly with feedback loops.',
      'Share your target role and I will generate a direct weekly roadmap.',
    ].join('\n')
  }

  if (/\b(learn|study|focus|discipline|habit|consistency)\b/.test(q)) {
    return [
      'Learning loop that works in practice:',
      '- Learn small concept (20-30 min).',
      '- Apply immediately (15-30 min).',
      '- Review mistakes and capture one rule.',
      '- Repeat daily with a tiny increase in difficulty.',
      'Tell me your topic and available daily time, and I will map a realistic plan.',
    ].join('\n')
  }

  if (/\b(relationship|friend|communication|argument|conflict)\b/.test(q)) {
    return [
      'Use this communication format:',
      '1. State observation without blame.',
      '2. Say how it affects you.',
      '3. Ask for one specific change.',
      '4. Listen and restate their view before solving.',
      'If you share the exact situation, I can draft the exact words to use.',
    ].join('\n')
  }

  if (/\b(money|budget|saving|debt|finance)\b/.test(q)) {
    return [
      'Simple money control baseline:',
      '- Track all expenses for 2 weeks first.',
      '- Cut recurring low-value costs before cutting essentials.',
      '- Build emergency buffer gradually and avoid new high-interest debt.',
      '- Automate savings right after income arrives.',
      'If you share your current numbers, I can draft a clean budget split.',
    ].join('\n')
  }

  return null
}

function compactText(text: string, maxChars = 260): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxChars) return normalized
  return `${normalized.slice(0, maxChars - 3).trimEnd()}...`
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40)
}

function classifyMissingInfoNeed(query: string): 'comparison' | 'implementation' | 'debugging' | 'architecture' | 'generic' {
  const q = query.toLowerCase()
  if (/\b(vs|versus|better|which|compare|difference|trade-?off)\b/.test(q)) return 'comparison'
  if (/\b(build|implement|code|create|write|make)\b/.test(q)) return 'implementation'
  if (/\b(debug|bug|error|fix|crash|failing)\b/.test(q)) return 'debugging'
  if (/\b(system|architecture|scalability|service|api|design)\b/.test(q)) return 'architecture'
  return 'generic'
}

function buildMissingInfoPrompt(query: string, keywords: string[]): string {
  const need = classifyMissingInfoNeed(query)
  if (need === 'comparison') {
    return 'To answer this comparison precisely, tell me which two options you want compared and your top constraint (speed, maintainability, cost, or reliability).'
  }
  if (need === 'implementation') {
    return 'To give an implementation-level answer, share target language/runtime, input-output shape, and one concrete example case.'
  }
  if (need === 'debugging') {
    return 'To debug this accurately, share the exact error text, minimal failing snippet, and expected vs actual behavior.'
  }
  if (need === 'architecture') {
    return 'For architecture guidance, provide expected traffic/load, latency target, and critical failure tolerance.'
  }

  if (keywords.length === 0) {
    return 'I need one sharper question to proceed. Mention the exact goal and domain (for example: "optimize Python loop for 1M rows").'
  }
  return 'I can refine this further if you share one concrete use case and the output format you want.'
}

function computeEvidenceCoverage(keywords: string[], passages: Array<{ docName: string; text: string }>): number {
  if (keywords.length === 0 || passages.length === 0) return 0
  const merged = passages.map((p) => p.text.toLowerCase()).join(' ')
  const matched = keywords.filter((kw) => merged.includes(kw)).length
  return matched / keywords.length
}

function synthesizeAnswer(query: string, chunks: Array<{ docName: string; text: string }>): {
  answer: string
  traceEvidence: string[]
} {
  const keywords = extractKeywords(query)
  const candidates: Array<{ sentence: string; score: number; docName: string }> = []

  for (const chunk of chunks) {
    const sentences = splitSentences(chunk.text)
    for (const sentence of sentences) {
      const low = sentence.toLowerCase()
      let score = 0
      for (const kw of keywords) {
        if (low.includes(kw)) score += 2
      }
      if (score > 0) {
        candidates.push({ sentence, score, docName: chunk.docName })
      }
    }
  }

  const unique = new Set<string>()
  const selected = candidates
    .sort((a, b) => b.score - a.score)
    .filter((item) => {
      const key = item.sentence.toLowerCase()
      if (unique.has(key)) return false
      unique.add(key)
      return true
    })
    .slice(0, 4)

  if (selected.length === 0) {
    const fallback = chunks
      .slice(0, 3)
      .map((chunk) => compactText(chunk.text, 180))
    return {
      answer: 'I found related material, but not enough for a strong concept-level summary. Feed me a more targeted source for this topic.',
      traceEvidence: fallback,
    }
  }

  const bullets = selected
    .map((item) => `- ${compactText(item.sentence, 210)}`)
    .join('\n')

  return {
    answer: `Concept-level answer:\n${bullets}`,
    traceEvidence: selected.map((item) => `${compactText(item.sentence, 220)} (${item.docName})`),
  }
}

function matchesStatusQuery(q: string): boolean {
  return STATUS_PATTERNS.some((p) => q.includes(p))
    || (/\b(knowledge|library|docs|documents|books?)\b/.test(q) && /\b(what|which|show|list|have|loaded|now|status)\b/.test(q))
}

function buildKnowledgeInventory(library: LibraryDocument[]): string {
  if (library.length === 0) {
    return 'Library is currently empty. Add a PDF, text, or markdown file and I will use it for grounded answers.'
  }

  const top = library
    .slice()
    .sort((a, b) => b.wordCount - a.wordCount)
    .slice(0, 8)
    .map((doc) => `- ${doc.name} (${doc.wordCount.toLocaleString()} words)`)
    .join('\n')

  return [
    `I currently have ${library.length} source document${library.length === 1 ? '' : 's'} loaded.`,
    `Total indexed words: ${totalWords(library).toLocaleString()}.`,
    '',
    'Top loaded sources:',
    top,
  ].join('\n')
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
    if (matchesStatusQuery(q)) {
      return {
        reply: buildKnowledgeInventory(library),
        contextDocs: library.slice(0, 8).map((doc) => doc.name),
        reasoningSteps: ['Knowledge inventory query detected. Reporting loaded sources and index size.'],
        confidence: 'high',
      }
    }

    // ── Boundary check ──
    if (BOUNDARY_PATTERNS.some((p) => q.includes(p))) {
      return {
        reply: `${CORE_IDENTITY.name} operates within strict boundaries set by Paro the Chief.\nSensitive actions require admin codeword authorization ("paro the chief").\nMaster-gated harmful actions require the secret master codeword ("paro the master").\nImmutable boundary policy files can never be rewritten by generated code.`,
        contextDocs: [],
        reasoningSteps: ['Boundary keyword detected. Policy gate engaged.'],
        confidence: 'high',
      }
    }

    const mentorIntent = /\b(step by step|mentor|teach|guide|roadmap|how to solve|interview prep)\b/.test(q)
    const mentorDomain = detectMentorDomain(q)
    if (mentorIntent && mentorDomain) {
      const mentorProblemType = detectMentorProblemType(q)
      return {
        reply: buildMentorTemplate(mentorDomain, query, mentorProblemType),
        contextDocs: ['Paxion Mentor Mode'],
        reasoningSteps: ['Mentor intent detected. Returned structured domain template with problem-type checklist.'],
        confidence: 'high',
      }
    }

    const polyglotLanguages = detectPolyglotLanguages(query)
    if (polyglotLanguages.length >= 2 && /\b(best|strong|strongest|architecture|combine|use|integrate|together|all)\b/.test(q)) {
      return {
        reply: buildPolyglotStrategyReply(polyglotLanguages),
        contextDocs: ['Paxion Polyglot Strategy'],
        reasoningSteps: ['Detected multi-language architecture intent and returned capability split guidance.'],
        confidence: 'high',
      }
    }

    // ── Library knowledge search ──
    steps.push(`Scanning Neural Index (${library.length} documents)…`)

    if (library.length === 0) {
      const coreAnswer = buildCoreKnowledgeAnswer(q)
      if (coreAnswer) {
        return {
          reply: coreAnswer,
          contextDocs: ['Paxion Core Knowledge'],
          reasoningSteps: [...steps, 'Library empty; switched to embedded core engineering knowledge cards.'],
          confidence: 'medium',
        }
      }

      const generalAnswer = buildGeneralCommonKnowledgeReply(q)
      if (generalAnswer) {
        return {
          reply: generalAnswer,
          contextDocs: ['Paxion Common Knowledge'],
          reasoningSteps: [...steps, 'Library empty; switched to embedded common-knowledge guidance.'],
          confidence: 'medium',
        }
      }

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
      if (/\b(read|summarize|summary|explain|library|book|document|docs?)\b/.test(q)) {
        const sampleDocs = library.slice(0, 5).map((doc) => doc.name).join(', ')
        return {
          reply: `I can do that. Tell me a specific question or ask: "summarize <document name>". Available sources: ${sampleDocs}.`,
          contextDocs: library.slice(0, 5).map((doc) => doc.name),
          reasoningSteps: [...steps, 'Detected broad library intent without specific keywords; returned guided clarification with available sources.'],
          confidence: 'medium',
        }
      }

      return {
        reply: pick(PAXION_REPLIES.unknown),
        contextDocs: [],
        reasoningSteps: [...steps, 'Insufficient intent signals; requested one focused clarification.'],
        confidence: 'low',
      }
    }

    const scored = library
      .map((doc) => ({ doc, score: scoreDoc(keywords, doc) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)

    if (scored.length === 0) {
      const coreAnswer = buildCoreKnowledgeAnswer(q)
      if (coreAnswer) {
        steps.push('No direct library match; used built-in core engineering knowledge cards for guidance.')
        return {
          reply: `${coreAnswer}\n\n${buildMissingInfoPrompt(query, keywords)}`,
          contextDocs: ['Paxion Core Knowledge'],
          reasoningSteps: steps,
          confidence: 'low',
        }
      }

      const generalAnswer = buildGeneralCommonKnowledgeReply(q)
      if (generalAnswer) {
        steps.push('No direct library match; used embedded common-knowledge guidance for everyday topic.')
        return {
          reply: `${generalAnswer}\n\n${buildMissingInfoPrompt(query, keywords)}`,
          contextDocs: ['Paxion Common Knowledge'],
          reasoningSteps: steps,
          confidence: 'low',
        }
      }

      steps.push('Library scan: no relevant documents found.')
      return {
        reply: `${pick(PAXION_REPLIES.notFound)}\n\n${buildMissingInfoPrompt(query, keywords)}`,
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

    const allPassages: Array<{ docName: string; text: string }> = []
    let chunkCount = 0
    for (const { doc } of topDocs) {
      const docChunks = buildChunks(doc.content)
      chunkCount += docChunks.length
      const passages = extractPassages(q, doc.content)
      allPassages.push(...passages.map((passage) => ({ docName: doc.name, text: passage.text })))
      steps.push(
        `Indexed ${docChunks.length} chunk(s), extracted ${passages.length} from "${doc.name}"`,
      )
    }

    steps.push(`Chunk scan complete across ${chunkCount} chunk(s).`)

    if (allPassages.length === 0) {
      steps.push('Documents were matched but no relevant passages could be isolated.')
      return {
        reply: `${pick(PAXION_REPLIES.notFound)}\n\n${buildMissingInfoPrompt(query, keywords)}`,
        contextDocs: topDocs.map((x) => x.doc.name),
        reasoningSteps: steps,
        confidence: 'low',
      }
    }

    const synthesized = synthesizeAnswer(q, allPassages)
    const evidenceCoverage = computeEvidenceCoverage(keywords, allPassages)
    const topScore = topDocs[0].score
    const calibratedStrength = topScore + Math.round(evidenceCoverage * 8)

    let confidence: ConfidenceLevel =
      calibratedStrength >= 16 ? 'high' : calibratedStrength >= 9 ? 'medium' : 'low'

    if (evidenceCoverage < 0.35 && confidence === 'medium') {
      confidence = 'low'
      steps.push('Confidence downgraded due to weak keyword coverage in extracted evidence.')
    }

    let reply = `${pick(PAXION_REPLIES.found)}\n\n${synthesized.answer}`
    if (confidence === 'low') {
      reply = `${reply}\n\n${buildMissingInfoPrompt(query, keywords)}`
      steps.push('Low-confidence response augmented with a targeted missing-information prompt.')
    }

    if (synthesized.traceEvidence.length > 0) {
      steps.push('Evidence (trace-only):')
      synthesized.traceEvidence.slice(0, 4).forEach((line) => steps.push(`- ${line}`))
    }

    return {
      reply,
      contextDocs: topDocs.map((x) => x.doc.name),
      reasoningSteps: steps,
      confidence,
    }
  }
}
