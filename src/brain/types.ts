export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'none'

export type BrainResponse = {
  reply: string
  contextDocs: string[]
  reasoningSteps: string[]
  confidence: ConfidenceLevel
}
