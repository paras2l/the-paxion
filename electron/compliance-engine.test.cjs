'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { evaluateCompliance } = require('./compliance-engine.cjs')

test('compliance blocks harmful cyber keywords', () => {
  const result = evaluateCompliance({
    actionId: 'workspace.generateComponent',
    category: 'codegen',
    detail: 'create malware dropper',
    jurisdiction: 'US',
  })
  assert.equal(result.allowed, false)
  assert.equal(result.ruleId, 'harmful-operation-blocked')
})

test('compliance requires review for sensitive categories', () => {
  const result = evaluateCompliance({
    actionId: 'workspace.runToolCommand',
    category: 'system',
    detail: 'run build',
    jurisdiction: 'EU',
  })
  assert.equal(result.allowed, true)
  assert.equal(result.requiresReview, true)
})
