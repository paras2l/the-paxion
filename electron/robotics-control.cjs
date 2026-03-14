'use strict'

function registerActuator(state, input) {
  const actuator = {
    id: String(input?.id || `act-${Date.now().toString(36)}`),
    kind: String(input?.kind || 'generic').trim(),
    workspace: String(input?.workspace || '').trim(),
    updatedAt: new Date().toISOString(),
  }
  return {
    ok: true,
    actuator,
    state: {
      ...state,
      actuators: [...(Array.isArray(state?.actuators) ? state.actuators : []), actuator].slice(-120),
      updatedAt: actuator.updatedAt,
    },
  }
}

function buildActuationPlan(input) {
  return {
    ok: true,
    actuationPlan: {
      target: String(input?.target || ''),
      command: String(input?.command || ''),
      safetyChecks: ['zone clear', 'limit checks', 'human approval'],
    },
  }
}

module.exports = {
  registerActuator,
  buildActuationPlan,
}
