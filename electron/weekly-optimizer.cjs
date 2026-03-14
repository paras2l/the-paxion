'use strict'

function average(nums) {
  if (!Array.isArray(nums) || nums.length === 0) {
    return 0
  }
  const sum = nums.reduce((acc, n) => acc + Number(n || 0), 0)
  return sum / nums.length
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function runWeeklyOptimization(state, input) {
  const now = new Date().toISOString()
  const autoTune = input?.autoTune !== false
  const falseWakeCount = Math.max(0, Number(input?.falseWakeCount || 0))
  const missedWakeCount = Math.max(0, Number(input?.missedWakeCount || 0))

  const voiceSessions = Array.isArray(state?.voiceQuality?.sessions) ? state.voiceQuality.sessions : []
  const avgLatencyMs = Math.round(average(voiceSessions.map((x) => x?.latencyMs || 0)))
  const avgInterruptions = Number(average(voiceSessions.map((x) => x?.interruptions || 0)).toFixed(2))

  const perceptionFrames = Array.isArray(state?.perception?.frames) ? state.perception.frames : []
  const relayRequests = Array.isArray(state?.relay?.requests) ? state.relay.requests : []
  const relayPending = relayRequests.filter((row) => String(row?.state || row?.status || 'pending') === 'pending').length

  const currentProfile = {
    duplexEnabled: Boolean(state?.voiceQuality?.profile?.duplexEnabled ?? true),
    interruptionHandling: String(state?.voiceQuality?.profile?.interruptionHandling || 'barge-in'),
    personaMemory: String(state?.voiceQuality?.profile?.personaMemory || 'friendly-technical'),
    prosody: String(state?.voiceQuality?.profile?.prosody || 'balanced'),
  }
  const currentWakeword = {
    sensitivity: Number(state?.wakeword?.adapter?.sensitivity ?? 0.55),
    alwaysOn: Boolean(state?.wakeword?.adapter?.alwaysOn ?? false),
  }
  const currentRelay = {
    mode: String(state?.relay?.config?.mode || 'disabled'),
    pollingEnabled: Boolean(state?.relay?.config?.pollingEnabled),
  }

  const recommendations = []
  const applied = []

  if (avgLatencyMs > 320) {
    recommendations.push('Use calmer prosody for clearer TTS under high latency.')
  }
  if (avgInterruptions > 3) {
    recommendations.push('Set interruption handling to barge-in to reduce dialog overlap.')
  }
  if (relayPending > 0 && currentRelay.mode === 'cloud') {
    recommendations.push('Keep cloud relay polling enabled while pending remote requests exist.')
  }
  if (falseWakeCount > missedWakeCount) {
    recommendations.push('Lower wake-word sensitivity to reduce false activations.')
  } else if (missedWakeCount > falseWakeCount) {
    recommendations.push('Raise wake-word sensitivity to reduce missed activations.')
  }

  let nextProfile = { ...currentProfile }
  let nextWakeword = { ...currentWakeword }
  let nextRelay = { ...currentRelay }

  if (autoTune) {
    if (avgLatencyMs > 320 && nextProfile.prosody !== 'calm') {
      nextProfile.prosody = 'calm'
      applied.push('voice.prosody -> calm')
    } else if (avgLatencyMs > 0 && avgLatencyMs < 180 && nextProfile.prosody !== 'energetic') {
      nextProfile.prosody = 'energetic'
      applied.push('voice.prosody -> energetic')
    }

    if (avgInterruptions > 3 && nextProfile.interruptionHandling !== 'barge-in') {
      nextProfile.interruptionHandling = 'barge-in'
      applied.push('voice.interruptionHandling -> barge-in')
    }

    if (falseWakeCount > missedWakeCount) {
      const tuned = clamp(nextWakeword.sensitivity - 0.03, 0.1, 0.99)
      if (tuned !== nextWakeword.sensitivity) {
        nextWakeword.sensitivity = tuned
        applied.push(`wakeword.sensitivity -> ${tuned.toFixed(2)}`)
      }
    } else if (missedWakeCount > falseWakeCount) {
      const tuned = clamp(nextWakeword.sensitivity + 0.03, 0.1, 0.99)
      if (tuned !== nextWakeword.sensitivity) {
        nextWakeword.sensitivity = tuned
        applied.push(`wakeword.sensitivity -> ${tuned.toFixed(2)}`)
      }
    }

    if (nextRelay.mode === 'cloud' && relayPending > 0 && !nextRelay.pollingEnabled) {
      nextRelay.pollingEnabled = true
      applied.push('relay.pollingEnabled -> true')
    }
  }

  const report = {
    id: `weekly-${Date.now().toString(36)}`,
    generatedAt: now,
    autoTune,
    metrics: {
      sessionsReviewed: voiceSessions.length,
      avgLatencyMs,
      avgInterruptions,
      perceptionFrames: perceptionFrames.length,
      relayPending,
      falseWakeCount,
      missedWakeCount,
    },
    recommendations,
    applied,
  }

  const previousReports = Array.isArray(state?.optimization?.reports) ? state.optimization.reports : []
  return {
    ok: true,
    report,
    state: {
      ...state,
      voiceQuality: {
        ...(state?.voiceQuality || {}),
        profile: {
          ...nextProfile,
          updatedAt: now,
        },
        updatedAt: now,
      },
      wakeword: {
        ...(state?.wakeword || {}),
        adapter: {
          ...(state?.wakeword?.adapter || {}),
          sensitivity: nextWakeword.sensitivity,
          alwaysOn: nextWakeword.alwaysOn,
        },
        updatedAt: now,
      },
      relay: {
        ...(state?.relay || {}),
        config: {
          ...(state?.relay?.config || {}),
          pollingEnabled: nextRelay.pollingEnabled,
        },
        updatedAt: now,
      },
      optimization: {
        reports: [...previousReports, report].slice(-52),
        lastRunAt: now,
        autoTune,
        updatedAt: now,
      },
    },
  }
}

module.exports = {
  runWeeklyOptimization,
}
