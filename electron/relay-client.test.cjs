'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const {
  submitRelayRequest,
  listPendingRelayRequests,
  completeRelayRequest,
} = require('./relay-client.cjs')

test('relay client: submit request posts payload to relay endpoint', async () => {
  const calls = []
  const originalFetch = global.fetch
  global.fetch = async (url, options) => {
    calls.push({ url, options })
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, requestId: 'req-1' }),
    }
  }

  try {
    const result = await submitRelayRequest({
      endpoint: 'https://relay.example.com/',
      token: 'secret-token',
      request: { actionId: 'assistant.remoteHeartbeat' },
    })

    assert.equal(result.ok, true)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://relay.example.com/relay/request')
    assert.equal(calls[0].options.method, 'POST')
    assert.equal(calls[0].options.headers['x-paxion-relay-token'], 'secret-token')
  } finally {
    global.fetch = originalFetch
  }
})

test('relay client: list pending requests uses relay queue endpoint', async () => {
  const calls = []
  const originalFetch = global.fetch
  global.fetch = async (url, options) => {
    calls.push({ url, options })
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, requests: [{ id: 'req-2' }] }),
    }
  }

  try {
    const result = await listPendingRelayRequests({
      endpoint: 'https://relay.example.com/',
      token: 'secret-token',
      deviceId: 'paxion-primary',
    })

    assert.equal(result.ok, true)
    assert.equal(Array.isArray(result.requests), true)
    assert.equal(result.requests.length, 1)
    assert.equal(calls[0].url, 'https://relay.example.com/relay/request?deviceId=paxion-primary')
    assert.equal(calls[0].options.method, 'GET')
  } finally {
    global.fetch = originalFetch
  }
})

test('relay client: complete request patches specific request id', async () => {
  const calls = []
  const originalFetch = global.fetch
  global.fetch = async (url, options) => {
    calls.push({ url, options })
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, requestId: 'req-3', state: 'completed' }),
    }
  }

  try {
    const result = await completeRelayRequest({
      endpoint: 'https://relay.example.com/',
      token: 'secret-token',
      requestId: 'req-3',
      state: 'completed',
      result: { runtime: 'desktop' },
    })

    assert.equal(result.ok, true)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://relay.example.com/relay/request/req-3')
    assert.equal(calls[0].options.method, 'PATCH')
  } finally {
    global.fetch = originalFetch
  }
})
