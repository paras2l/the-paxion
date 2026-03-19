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

  const remoteQueueBursts = recent.filter((entry) => {
    if (entry.type !== 'action_result') return false
    const payload = asRecord(entry.payload)
    const status = String(payload.status || '').toLowerCase()
    const executionMode = String(payload.executionMode || '').toLowerCase()
    return status === 'queued' && executionMode === 'delegated-desktop'
  }).length

  if (remoteQueueBursts >= 4) {
    return {
      detected: true,
      score: 83,
      reason: `Potential remote command abuse: ${remoteQueueBursts} delegated queue bursts detected.`,
    }
  }

  const queuedByAction = new Map<string, number>()
  for (const entry of recent) {
    if (entry.type !== 'action_result') {
      continue
    }
    const payload = asRecord(entry.payload)
    const status = String(payload.status || '').toLowerCase()
    if (status !== 'queued') {
      continue
    }
    const key = `${String(payload.actionId || 'unknown')}::${String(payload.executionMode || 'unknown')}`
    queuedByAction.set(key, (queuedByAction.get(key) || 0) + 1)
  }

  const burstKey = [...queuedByAction.entries()].find(([, count]) => count >= 3)
  if (burstKey) {
    return {
      detected: true,
      score: 81,
      reason: `Burst throttle candidate detected for ${burstKey[0]} (${burstKey[1]} queued attempts).`,
    }
  }

  const failedByAction = new Map<string, number>()
  for (const entry of recent) {
    if (entry.type !== 'action_result') {
      continue
    }
    const payload = asRecord(entry.payload)
    const status = String(payload.status || '').toLowerCase()
    if (status !== 'failed') {
      continue
    }
    const actionId = String(payload.actionId || 'unknown-action')
    failedByAction.set(actionId, (failedByAction.get(actionId) || 0) + 1)
  }

  const retryStorm = [...failedByAction.entries()].find(([, count]) => count >= 3)
  if (retryStorm) {
    return {
      detected: true,
      score: 79,
      reason: `Retry storm detected for ${retryStorm[0]} (${retryStorm[1]} failures).`,
    }
  }

  return {
    detected: false,
    score: 0,
  }
}