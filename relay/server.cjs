'use strict'

const http = require('http')
const crypto = require('crypto')

const PORT = Number(process.env.PORT || process.env.PAXION_RELAY_PORT || 8787)
const RELAY_TOKEN = String(process.env.PAXION_RELAY_TOKEN || '').trim()
const pending = new Map()
const relayAudit = []

function appendRelayAudit(type, payload) {
  relayAudit.push({
    id: `audit-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    type,
    payload,
  })
  if (relayAudit.length > 300) {
    relayAudit.shift()
  }
}

function localPolicyCheck(request) {
  const actionId = String(request?.actionId || '').toLowerCase()
  const detail = String(request?.detail || '').toLowerCase()
  const blockedPatterns = ['exfiltrate', 'disable policy', 'delete audit', 'bypass']
  const blocked = blockedPatterns.some((pattern) => actionId.includes(pattern) || detail.includes(pattern))
  if (blocked) {
    return {
      allowed: false,
      reason: 'Relay denied request due to local policy block pattern.',
    }
  }
  return {
    allowed: true,
    reason: 'Relay accepted request. Final authority remains local desktop policy.',
  }
}

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += String(chunk || '')
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'))
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

function requireToken(req, res) {
  if (!RELAY_TOKEN) {
    writeJson(res, 500, { ok: false, reason: 'PAXION_RELAY_TOKEN is not configured.' })
    return false
  }
  const token = String(req.headers['x-paxion-relay-token'] || '')
  if (token !== RELAY_TOKEN) {
    writeJson(res, 401, { ok: false, reason: 'Invalid relay token.' })
    return false
  }
  return true
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'GET' && url.pathname === '/health') {
    writeJson(res, 200, { ok: true, service: 'paxion-cloud-relay', auditDepth: relayAudit.length })
    return
  }

  if (req.method === 'GET' && url.pathname === '/relay/audit') {
    if (!requireToken(req, res)) return
    writeJson(res, 200, { ok: true, entries: relayAudit.slice(-120) })
    return
  }

  if (req.method === 'POST' && url.pathname === '/relay/request') {
    if (!requireToken(req, res)) return
    const body = await readBody(req)
    const policy = localPolicyCheck(body?.request || null)
    if (!policy.allowed) {
      appendRelayAudit('request_blocked', {
        reason: policy.reason,
        request: body?.request || null,
      })
      writeJson(res, 403, { ok: false, reason: policy.reason })
      return
    }

    const requestId = `relay-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`
    const row = {
      id: requestId,
      request: body?.request || null,
      state: 'queued',
      createdAt: new Date().toISOString(),
      result: null,
    }
    pending.set(requestId, row)
    appendRelayAudit('request_queued', {
      requestId,
      actionId: body?.request?.actionId || null,
      policy: policy.reason,
    })
    writeJson(res, 200, { ok: true, requestId, state: row.state })
    return
  }

  if (req.method === 'GET' && url.pathname === '/relay/request') {
    if (!requireToken(req, res)) return
    const requestId = String(url.searchParams.get('id') || '')
    const row = pending.get(requestId)
    if (!row) {
      writeJson(res, 404, { ok: false, reason: 'Request not found.' })
      return
    }
    writeJson(res, 200, { ok: true, request: row })
    return
  }

  if (req.method === 'POST' && url.pathname === '/relay/complete') {
    if (!requireToken(req, res)) return
    const body = await readBody(req)
    const requestId = String(body?.requestId || '')
    const row = pending.get(requestId)
    if (!row) {
      writeJson(res, 404, { ok: false, reason: 'Request not found.' })
      return
    }
    row.state = String(body?.state || 'completed')
    row.result = body?.result || null
    pending.set(requestId, row)
    appendRelayAudit('request_completed', {
      requestId,
      state: row.state,
    })
    writeJson(res, 200, { ok: true, request: row })
    return
  }

  writeJson(res, 404, { ok: false, reason: 'Route not found.' })
})

server.listen(PORT, () => {
  console.log(`[Paxion Relay] listening on :${PORT}`)
})
