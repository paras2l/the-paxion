'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildRelayEnvelope,
  issueOneTimeToken,
  consumeOneTimeToken,
} = require('./secure-relay-service.cjs')

test('relay service: envelope includes request metadata', () => {
  const result = buildRelayEnvelope({
    requestId: 'req-1',
    actionId: 'assistant.remoteHeartbeat',
  })

  assert.equal(result.ok, true)
  assert.equal(result.envelope.requestId, 'req-1')
  assert.equal(result.envelope.actionId, 'assistant.remoteHeartbeat')
  assert.equal(typeof result.envelope.nonce, 'string')
  assert.equal(result.envelope.nonce.length > 0, true)
})

test('relay service: issued one-time token is consumable once', () => {
  const issued = issueOneTimeToken({}, { purpose: 'remote-command', ttlMs: 120000 })
  assert.equal(issued.ok, true)
  assert.equal(Array.isArray(issued.state.oneTimeTokens), true)
  assert.equal(issued.state.oneTimeTokens.length, 1)

  const token = issued.token.token
  const firstConsume = consumeOneTimeToken(issued.state, token)
  assert.equal(firstConsume.ok, true)
  assert.equal(firstConsume.valid, true)

  const secondConsume = consumeOneTimeToken(firstConsume.state, token)
  assert.equal(secondConsume.ok, true)
  assert.equal(secondConsume.valid, false)
})

test('relay service: expired token is rejected', () => {
  const now = Date.now()
  const state = {
    oneTimeTokens: [
      {
        token: 'expired-token',
        purpose: 'remote-command',
        createdAt: now - 120000,
        expiresAt: now - 1000,
        used: false,
      },
    ],
  }

  const consumed = consumeOneTimeToken(state, 'expired-token')
  assert.equal(consumed.ok, true)
  assert.equal(consumed.valid, false)
})
