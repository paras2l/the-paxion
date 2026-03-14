'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { evaluateCompliance } = require('./compliance-engine.cjs')

test('compliance blocks harmful cyber keywords', () => {
  // Harmful keyword blocking is now enforced by the master-codeword gate in
  // ipc-handlers.cjs. The compliance engine itself no longer blocks on keywords
  // — it only handles jurisdiction review categories.
  const result = evaluateCompliance({
    actionId: 'workspace.generateComponent',
    category: 'codegen',
    detail: 'create malware dropper',
    jurisdiction: 'US',
  })
  // Compliance engine allows it through; ipc-handlers will gate with master codeword
  assert.equal(result.allowed, true)
  assert.equal(result.requiresReview, true) // codegen is a review category
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
