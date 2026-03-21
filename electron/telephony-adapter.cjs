'use strict'

const https = require('https')

function normalizePhoneNumber(input) {
  const cleaned = String(input || '').replace(/[^0-9+]/g, '')
  if (!cleaned) return ''
  if (cleaned.startsWith('+')) return cleaned
  return `+${cleaned}`
}

function callViaTwilio(input) {
  const accountSid = String(input?.accountSid || process.env.RAIZEN_TWILIO_ACCOUNT_SID || '').trim()
  const authToken = String(input?.authToken || process.env.RAIZEN_TWILIO_AUTH_TOKEN || '').trim()
  const fromNumber = normalizePhoneNumber(input?.fromNumber || process.env.RAIZEN_TWILIO_FROM_NUMBER)
  const toNumber = normalizePhoneNumber(input?.toNumber)

  if (!accountSid || !authToken || !fromNumber || !toNumber) {
    return Promise.resolve({
      ok: false,
      reason: 'Twilio provider is not fully configured (SID/TOKEN/FROM/TO required).',
    })
  }

  const twimlSay = String(input?.message || 'Emergency call from Raizen. Please respond.').trim()
  const body = new URLSearchParams({
    To: toNumber,
    From: fromNumber,
    Twiml: `<Response><Say>${twimlSay.replace(/[<>&]/g, ' ')}</Say></Response>`,
  }).toString()

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  const options = {
    hostname: 'api.twilio.com',
    path: `/2010-04-01/Accounts/${accountSid}/Calls.json`,
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
  }

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let raw = ''
      res.on('data', (chunk) => {
        raw += String(chunk || '')
      })
      res.on('end', () => {
        let parsed = null
        try {
          parsed = JSON.parse(raw)
        } catch {
          parsed = null
        }

        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            ok: true,
            provider: 'twilio',
            sid: parsed?.sid || null,
            status: parsed?.status || 'queued',
            to: parsed?.to || toNumber,
          })
          return
        }

        resolve({
          ok: false,
          provider: 'twilio',
          reason: parsed?.message || `Twilio call failed with status ${res.statusCode || 'unknown'}.`,
        })
      })
    })

    req.on('error', (err) => {
      resolve({ ok: false, provider: 'twilio', reason: `Twilio request error: ${String(err?.message || err)}` })
    })

    req.write(body)
    req.end()
  })
}

function sendMessageViaTwilio(input) {
  const accountSid = String(input?.accountSid || process.env.RAIZEN_TWILIO_ACCOUNT_SID || '').trim()
  const authToken = String(input?.authToken || process.env.RAIZEN_TWILIO_AUTH_TOKEN || '').trim()
  let fromNumber = normalizePhoneNumber(input?.fromNumber || process.env.RAIZEN_TWILIO_FROM_NUMBER)
  let toNumber = normalizePhoneNumber(input?.toNumber)
  const isWhatsapp = Boolean(input?.whatsapp)

  if (!accountSid || !authToken || !fromNumber || !toNumber) {
    return Promise.resolve({
      ok: false,
      reason: 'Twilio provider is not fully configured (SID/TOKEN/FROM/TO required).',
    })
  }

  if (isWhatsapp) {
    if (!fromNumber.startsWith('whatsapp:')) fromNumber = `whatsapp:${fromNumber}`
    if (!toNumber.startsWith('whatsapp:')) toNumber = `whatsapp:${toNumber}`
  }

  const messageBody = String(input?.message || 'Hello from Raizen.').trim()
  const body = new URLSearchParams({
    To: toNumber,
    From: fromNumber,
    Body: messageBody,
  }).toString()

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  const options = {
    hostname: 'api.twilio.com',
    path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
  }

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let raw = ''
      res.on('data', (chunk) => {
        raw += String(chunk || '')
      })
      res.on('end', () => {
        let parsed = null
        try {
          parsed = JSON.parse(raw)
        } catch {
          parsed = null
        }

        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            ok: true,
            provider: 'twilio',
            sid: parsed?.sid || null,
            status: parsed?.status || 'queued',
            to: toNumber,
          })
          return
        }

        resolve({
          ok: false,
          provider: 'twilio',
          reason: parsed?.message || `Twilio message failed with status ${res.statusCode || 'unknown'}.`,
        })
      })
    })

    req.on('error', (err) => {
      resolve({ ok: false, provider: 'twilio', reason: `Twilio request error: ${String(err?.message || err)}` })
    })

    req.write(body)
    req.end()
  })
}

module.exports = {
  normalizePhoneNumber,
  callViaTwilio,
  sendMessageViaTwilio,
}
