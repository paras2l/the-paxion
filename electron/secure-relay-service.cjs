'use strict'

const crypto = require('crypto')

function buildRelayEnvelope(input) {
  const payload = {
    requestId: String(input?.requestId || `relay-${Date.now().toString(36)}`),
    actionId: String(input?.actionId || ''),
    issuedAt: new Date().toISOString(),
    nonce: crypto.randomBytes(8).toString('hex'),
  }
  return {
    ok: true,
    envelope: payload,
  }
}

function issueOneTimeToken(state, input) {
  const token = crypto.randomBytes(18).toString('hex')
  const row = {
    token,
    purpose: String(input?.purpose || 'relay-command'),
    createdAt: Date.now(),
    expiresAt: Date.now() + Math.max(30_000, Number(input?.ttlMs || 120_000)),
    used: false,
  }
  return {
    ok: true,
    token: row,
    state: {
      ...state,
      oneTimeTokens: [...(Array.isArray(state?.oneTimeTokens) ? state.oneTimeTokens : []), row].slice(-100),
      updatedAt: new Date().toISOString(),
    },
  }
}

function consumeOneTimeToken(state, token) {
  const rows = Array.isArray(state?.oneTimeTokens) ? state.oneTimeTokens : []
  let valid = false
  const nextRows = rows.map((row) => {
    if (row.token !== token) {
      return row
    }
    const usable = !row.used && Date.now() <= Number(row.expiresAt || 0)
    valid = usable
    return {
      ...row,
      used: true,
      usedAt: Date.now(),
    }
  })
  return {
    ok: true,
    valid,
    state: {
      ...state,
      oneTimeTokens: nextRows,
      updatedAt: new Date().toISOString(),
    },
  }
}

module.exports = {
  buildRelayEnvelope,
  issueOneTimeToken,
  consumeOneTimeToken,
}
