'use strict'

function updateVoiceQuality(state, input) {
  const profile = {
    duplexEnabled: Boolean(input?.duplexEnabled),
    interruptionHandling: String(input?.interruptionHandling || 'barge-in').trim() || 'barge-in',
    personaMemory: String(input?.personaMemory || 'friendly-technical').trim() || 'friendly-technical',
    prosody: String(input?.prosody || 'balanced').trim() || 'balanced',
    updatedAt: new Date().toISOString(),
  }
  return {
    ok: true,
    profile,
    state: {
      ...state,
      profile,
      updatedAt: profile.updatedAt,
    },
  }
}

function evaluateDuplexSession(input) {
  const interruptions = Math.max(0, Number(input?.interruptions || 0))
  const latencyMs = Math.max(0, Number(input?.latencyMs || 0))
  return {
    ok: true,
    session: {
      interruptions,
      latencyMs,
      quality: latencyMs < 220 && interruptions < 3 ? 'good' : 'needs-tuning',
    },
  }
}

module.exports = {
  updateVoiceQuality,
  evaluateDuplexSession,
}
