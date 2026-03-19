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
      'x-paxion-relay-token': token,
    },
    body: JSON.stringify({ request: input?.request || null }),
  })

  return response.ok ? response.payload : { ok: false, reason: response.payload?.reason || 'Relay request failed.' }
}

async function listPendingRelayRequests(input) {
  const endpoint = String(input?.endpoint || '').replace(/\/$/, '')
  const token = String(input?.token || '')
  const deviceId = String(input?.deviceId || '').trim()
  if (!endpoint || !token) {
    return { ok: false, reason: 'Relay endpoint and token are required.' }
  }

  const query = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : ''
  const response = await relayFetchJson(`${endpoint}/relay/request${query}`, {
    method: 'GET',
    headers: {
      'x-paxion-relay-token': token,
    },
  })

  if (!response.ok) {
    return { ok: false, reason: response.payload?.reason || 'Relay queue fetch failed.' }
  }

  const requests = Array.isArray(response.payload?.requests) ? response.payload.requests : []
  return {
    ok: true,
    requests,
  }
}

async function completeRelayRequest(input) {
  const endpoint = String(input?.endpoint || '').replace(/\/$/, '')
  const token = String(input?.token || '')
  const requestId = String(input?.requestId || '').trim()
  if (!endpoint || !token) {
    return { ok: false, reason: 'Relay endpoint and token are required.' }
  }
  if (!requestId) {
    return { ok: false, reason: 'Request ID is required.' }
  }

  const response = await relayFetchJson(`${endpoint}/relay/request/${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-paxion-relay-token': token,
    },
    body: JSON.stringify({
      state: input?.state || 'completed',
      result: input?.result || {},
    }),
  })

  return response.ok ? response.payload : { ok: false, reason: response.payload?.reason || 'Relay completion failed.' }
}

module.exports = {
  submitRelayRequest,
  listPendingRelayRequests,
  completeRelayRequest,
}
