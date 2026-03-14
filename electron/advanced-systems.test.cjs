'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { simulatePolicyDiff, buildCanaryPlan, detectAnomalyRollback } = require('./governance-advanced.cjs')
const { issueOneTimeToken, consumeOneTimeToken } = require('./secure-relay-service.cjs')
const { createLongHorizonPlan } = require('./planner-executor.cjs')
const { buildSceneGraph } = require('./multimodal-perception.cjs')

test('governance advanced systems return simulation and canary outputs', () => {
  const diff = simulatePolicyDiff({ currentPolicy: 'allow a', proposedPolicy: 'allow a\nallow b' })
  const canary = buildCanaryPlan({ target: 'voice-runtime', cohortPercent: 10 })
  const anomaly = detectAnomalyRollback({ signals: [{ severity: 3 }, { severity: 5 }], rollbackThreshold: 7 })

  assert.equal(diff.ok, true)
  assert.equal(Array.isArray(diff.simulation.added), true)
  assert.equal(canary.ok, true)
  assert.equal(Array.isArray(canary.canary.stages), true)
  assert.equal(anomaly.anomaly.shouldRollback, true)
})

test('secure relay one-time tokens are consumable once', () => {
  const issued = issueOneTimeToken({ oneTimeTokens: [] }, { purpose: 'remote-command', ttlMs: 60000 })
  assert.equal(issued.ok, true)
  const token = issued.token.token
  const consumed1 = consumeOneTimeToken(issued.state, token)
  const consumed2 = consumeOneTimeToken(consumed1.state, token)
  assert.equal(consumed1.valid, true)
  assert.equal(consumed2.valid, false)
})

test('planner and perception systems produce structured outputs', () => {
  const plan = createLongHorizonPlan({ goal: 'Build autonomous science workflow' })
  const scene = buildSceneGraph({ objects: ['person', 'screen'], relations: ['person-near-screen'] })
  assert.equal(plan.ok, true)
  assert.equal(Array.isArray(plan.plan.horizons), true)
  assert.equal(scene.ok, true)
  assert.equal(Array.isArray(scene.sceneGraph.nodes), true)
})
