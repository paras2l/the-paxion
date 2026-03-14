'use strict'

function createLongHorizonPlan(input) {
  const goal = String(input?.goal || '').trim() || 'Untitled objective'
  const horizons = ['immediate', 'short-term', 'mid-term', 'long-term']
  return {
    ok: true,
    plan: {
      id: `plan-${Date.now().toString(36)}`,
      goal,
      horizons: horizons.map((name, index) => ({
        id: `${name}-${index + 1}`,
        name,
        validationLoop: ['gather evidence', 'run action', 'compare result', 'store memory'],
      })),
      generatedAt: new Date().toISOString(),
    },
  }
}

function advanceValidationLoop(state, input) {
  const cycle = {
    id: `cycle-${Date.now().toString(36)}`,
    planId: String(input?.planId || ''),
    phase: String(input?.phase || 'gather evidence'),
    notes: String(input?.notes || ''),
    createdAt: new Date().toISOString(),
  }
  return {
    ok: true,
    cycle,
    state: {
      ...state,
      cycles: [...(Array.isArray(state?.cycles) ? state.cycles : []), cycle].slice(-240),
      updatedAt: cycle.createdAt,
    },
  }
}

module.exports = {
  createLongHorizonPlan,
  advanceValidationLoop,
}
