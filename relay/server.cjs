'use strict'

const http = require('http')
const crypto = require('crypto')

const PORT = Number(process.env.PAXION_RELAY_PORT || 8787)
const RELAY_TOKEN = String(process.env.PAXION_RELAY_TOKEN || '').trim()
const pending = new Map()

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
    writeJson(res, 200, { ok: true, service: 'paxion-cloud-relay' })
    return
  }

  if (req.method === 'POST' && url.pathname === '/relay/request') {
    if (!requireToken(req, res)) return
    const body = await readBody(req)
    const requestId = `relay-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`
    const row = {
      id: requestId,
      request: body?.request || null,
      state: 'queued',
      createdAt: new Date().toISOString(),
      result: null,
    }
    pending.set(requestId, row)
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
    writeJson(res, 200, { ok: true, request: row })
    return
  }

  writeJson(res, 404, { ok: false, reason: 'Route not found.' })
})

server.listen(PORT, () => {
  console.log(`[Paxion Relay] listening on :${PORT}`)
})
