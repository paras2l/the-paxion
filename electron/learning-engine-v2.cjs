'use strict'

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function evolveSkills(state, input) {
  const skills = Array.isArray(state?.skills) ? [...state.skills] : []
  const confidence = state?.confidence && typeof state.confidence === 'object' ? { ...state.confidence } : {}
  const ts = new Date().toISOString()

  const learned = Array.isArray(input?.newSkills)
    ? input.newSkills.filter((entry) => typeof entry === 'string' && entry.trim()).map((entry) => entry.trim())
    : []

  const successful = Boolean(input?.successful)
  for (const skill of learned) {
    if (!skills.includes(skill)) {
      skills.push(skill)
    }
    const base = Number(confidence[skill] || 0.2)
    confidence[skill] = clamp(base + (successful ? 0.08 : 0.02), 0.05, 1)
  }

  for (const skill of skills) {
    if (!learned.includes(skill)) {
      confidence[skill] = clamp(Number(confidence[skill] || 0.2) - 0.005, 0.05, 1)
    }
  }

  return {
    skills: skills.sort((a, b) => a.localeCompare(b)),
    confidence,
    updatedAt: ts,
  }
}

function generateHypotheses(state, input) {
  const goal = String(input?.goal || '').trim() || 'Unspecified goal'
  const confidence = state?.confidence && typeof state.confidence === 'object' ? state.confidence : {}
  const weakSkills = Object.entries(confidence)
    .filter(([, value]) => Number(value) < 0.35)
    .map(([key]) => key)
    .slice(0, 5)

  const hypotheses = weakSkills.map((skill, index) => ({
    id: `hyp-${Date.now().toString(36)}-${index}`,
    skill,
    goal,
    recommendation: `Run supervised task to improve ${skill} for goal: ${goal}`,
    createdAt: new Date().toISOString(),
  }))

  return hypotheses
}

module.exports = {
  evolveSkills,
  generateHypotheses,
}
