import type { AuditEntry } from './types'

export type AnomalySignal = {
  detected: boolean
  score: number
  reason?: string
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return {}
  }
  return value as Record<string, unknown>
}

export function detectAuditAnomaly(entries: AuditEntry[], latest: AuditEntry): AnomalySignal {
  const recent = [...entries, latest].slice(-8)
  const deniedCount = recent.filter((entry) => {
    if (entry.type !== 'action_result') return false
    const payload = asRecord(entry.payload)
    return String(payload.status || '').toLowerCase() === 'denied'
  }).length

  if (deniedCount >= 5) {
    return {
      detected: true,
      score: 90,
      reason: `Detected ${deniedCount} denied actions in a short window.`,
    }
  }

  const capabilityBlocks = recent.filter((entry) => {
    if (entry.type !== 'policy_check') return false
    const payload = asRecord(entry.payload)
    const decision = asRecord(payload.decision)
    return String(decision.ruleId || '').toLowerCase() === 'capability-disabled'
  }).length

  if (capabilityBlocks >= 3) {
    return {
      detected: true,
      score: 74,
      reason: `Repeated capability-disabled policy checks (${capabilityBlocks}) detected.`,
    }
  }

  return {
    detected: false,
    score: 0,
  }
}