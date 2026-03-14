'use strict'

function simulatePolicyDiff(input) {
  const current = String(input?.currentPolicy || '')
  const proposed = String(input?.proposedPolicy || '')
  const currentLines = current.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
  const proposedLines = proposed.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
  const added = proposedLines.filter((line) => !currentLines.includes(line))
  const removed = currentLines.filter((line) => !proposedLines.includes(line))
  const riskScore = Math.min(100, added.length * 8 + removed.length * 12)
  return {
    ok: true,
    simulation: {
      added,
      removed,
      riskScore,
      decision: riskScore > 60 ? 'high-risk-review' : riskScore > 25 ? 'review' : 'safe-canary',
    },
  }
}

function buildCanaryPlan(input) {
  const target = String(input?.target || 'current-deployment')
  const cohortPercent = Math.max(1, Math.min(100, Number(input?.cohortPercent || 5)))
  return {
    ok: true,
    canary: {
      target,
      stages: [
        { name: 'shadow', percent: 0, exitCriteria: 'no critical errors in simulation' },
        { name: 'canary-1', percent: cohortPercent, exitCriteria: 'error rate below baseline' },
        { name: 'canary-2', percent: Math.min(25, cohortPercent * 3), exitCriteria: 'latency stable and no rollback triggers' },
        { name: 'full-rollout', percent: 100, exitCriteria: 'all anomaly gates green' },
      ],
    },
  }
}

function detectAnomalyRollback(input) {
  const signals = Array.isArray(input?.signals) ? input.signals : []
  const score = signals.reduce((acc, signal) => acc + Number(signal?.severity || 0), 0)
  const shouldRollback = score >= Number(input?.rollbackThreshold || 7)
  return {
    ok: true,
    anomaly: {
      signals,
      score,
      shouldRollback,
      recommendation: shouldRollback ? 'trigger-rollback' : 'continue-observing',
    },
  }
}

module.exports = {
  simulatePolicyDiff,
  buildCanaryPlan,
  detectAnomalyRollback,
}
