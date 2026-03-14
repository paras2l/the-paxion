'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { upsertDevice, revokeDevice } = require('./device-control-plane.cjs')
const { evolveSkills, generateHypotheses } = require('./learning-engine-v2.cjs')
const { runBacktest, placePaperOrder } = require('./trading-engine.cjs')
const { evaluateMedicationSafety, evaluateMedicalAdviceConfidence } = require('./medical-safety.cjs')
const { enqueueMediaJob } = require('./media-generation.cjs')

test('device control plane register and revoke', () => {
  const registered = upsertDevice([], {
    id: 'device-1',
    name: 'Phone',
    platform: 'android',
    publicKeyFingerprint: 'abc',
  })
  assert.equal(registered.ok, true)
  const revoked = revokeDevice(registered.devices, 'device-1')
  assert.equal(revoked.ok, true)
  assert.equal(revoked.device.trusted, false)
})

test('learning engine evolves confidence and hypotheses', () => {
  const evolved = evolveSkills({ skills: [], confidence: {} }, { newSkills: ['Risk Analysis'], successful: true })
  assert.equal(evolved.skills.includes('Risk Analysis'), true)
  const hypotheses = generateHypotheses(evolved, { goal: 'Improve trading decisions' })
  assert.equal(Array.isArray(hypotheses), true)
})

test('trading engine computes backtest and paper order', () => {
  const backtest = runBacktest({ prices: [100, 105, 102, 110] })
  assert.equal(typeof backtest.totalReturn, 'number')
  const order = placePaperOrder({ symbol: 'AAPL', side: 'buy', quantity: 2, price: 190 })
  assert.equal(order.status, 'filled-paper')
})

test('medical safety returns contraindications and confidence gate', () => {
  const safety = evaluateMedicationSafety({ medications: ['Warfarin', 'Aspirin'] })
  assert.equal(safety.safe, false)
  const confidence = evaluateMedicalAdviceConfidence({ confidence: 0.6, threshold: 0.75 })
  assert.equal(confidence.allowed, false)
})

test('media generation queue returns completed artifact with watermark', () => {
  const result = enqueueMediaJob({ jobs: [] }, { type: 'image', prompt: 'futuristic dashboard' })
  assert.equal(result.job.status, 'completed')
  assert.equal(result.job.watermark.includes('Paxion'), true)
})
