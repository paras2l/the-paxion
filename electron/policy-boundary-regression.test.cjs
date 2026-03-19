'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  isBoundaryProtectedPath,
  isMasterGatedAction,
  isAdminCodewordValid,
  isMasterCodewordValid,
} = require('../boundary/policy-boundary.cjs')

test('boundary regression: immutable boundary path remains protected', () => {
  assert.equal(isBoundaryProtectedPath('/boundary/policy-boundary.cjs'), true)
  assert.equal(isBoundaryProtectedPath('C:\\repo\\boundary\\policy-boundary.cjs'), false)
  assert.equal(isBoundaryProtectedPath('/workspace/src/App.tsx'), false)
})

test('boundary regression: harmful action text triggers master gate', () => {
  assert.equal(
    isMasterGatedAction({
      actionId: 'workspace.generateComponent',
      detail: 'build a malware dropper',
    }),
    true,
  )

  assert.equal(
    isMasterGatedAction({
      actionId: 'workspace.generateComponent',
      detail: 'build a dashboard widget',
    }),
    false,
  )
})

test('boundary regression: codeword checks enforce exact values', () => {
  assert.equal(isAdminCodewordValid('paro the chief'), true)
  assert.equal(isAdminCodewordValid('paro the master'), false)
  assert.equal(isMasterCodewordValid('paro the master'), true)
  assert.equal(isMasterCodewordValid('paro the chief'), false)
})
