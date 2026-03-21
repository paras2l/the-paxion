'use strict'

function relayFetchJson(url, options = {}) {
  return fetch(url, options).then(async (response) => {
    const text = await response.text()
    let payload = null
    try {
      payload = JSON.parse(text || '{}')
    } catch {
      payload = { ok: false, reason: text || 'Invalid JSON response.' }
    }
    return {
      ok: response.ok,
      status: response.status,
      payload,
    }
  })
}

async function submitRelayRequest(input) {
  const endpoint = String(input?.endpoint || '').replace(/\/$/, '')
  const token = String(input?.token || '')
  if (!endpoint || !token) {
    return { ok: false, reason: 'Relay endpoint and token are required.' }
  }

  const response = await relayFetchJson(`${endpoint}/relay/request`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-raizen-relay-token': token,
    },
    body: JSON.stringify({ request: input?.request || null }),
  })

  return response.ok ? response.payload : { ok: false, reason: response.payload?.reason || 'Relay request failed.' }
}

module.exports = {
  submitRelayRequest,
}
