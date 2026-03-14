'use strict'

const CONTRAINDICATIONS = new Map([
  ['aspirin+warfarin', 'High bleeding risk when combining Warfarin and Aspirin.'],
  ['nitrate+sildenafil', 'Severe hypotension risk for Nitrate with Sildenafil.'],
  ['contrast-dye+metformin', 'Potential lactic acidosis risk; review renal function first.'],
])

function pairKey(left, right) {
  return [String(left || '').trim().toLowerCase(), String(right || '').trim().toLowerCase()].sort().join('+')
}

function evaluateMedicationSafety(input) {
  const medications = Array.isArray(input?.medications)
    ? input.medications.filter((entry) => typeof entry === 'string' && entry.trim()).map((entry) => entry.trim())
    : []
  const findings = []

  for (let i = 0; i < medications.length; i += 1) {
    for (let j = i + 1; j < medications.length; j += 1) {
      const key = pairKey(medications[i], medications[j])
      if (CONTRAINDICATIONS.has(key)) {
        findings.push({
          medications: [medications[i], medications[j]],
          severity: 'high',
          message: CONTRAINDICATIONS.get(key),
        })
      }
    }
  }

  return {
    safe: findings.length === 0,
    findings,
    reviewedAt: new Date().toISOString(),
  }
}

function evaluateMedicalAdviceConfidence(input) {
  const confidence = Math.max(0, Math.min(1, Number(input?.confidence || 0)))
  const threshold = Math.max(0, Math.min(1, Number(input?.threshold || 0.75)))
  return {
    allowed: confidence >= threshold,
    confidence,
    threshold,
    reason:
      confidence >= threshold
        ? 'Confidence threshold satisfied for supervised advisory output.'
        : 'Confidence below medical advisory threshold; escalate to human review.',
  }
}

module.exports = {
  evaluateMedicationSafety,
  evaluateMedicalAdviceConfidence,
}
