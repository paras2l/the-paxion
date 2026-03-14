'use strict'

function buildClinicalEvidence(input) {
  const objective = String(input?.objective || 'clinical-review').trim()
  const citations = Array.isArray(input?.citations) ? input.citations.map((x) => String(x)) : []
  return {
    ok: true,
    evidence: {
      objective,
      citations,
      evidenceGrade: citations.length >= 3 ? 'moderate' : 'low',
      requiresExternalValidation: true,
      generatedAt: new Date().toISOString(),
    },
  }
}

function validateExternalEvidence(input) {
  const reviewers = Array.isArray(input?.reviewers) ? input.reviewers.map((x) => String(x)) : []
  const approved = reviewers.length >= Number(input?.minimumReviewers || 2)
  return {
    ok: true,
    validation: {
      reviewers,
      approved,
      status: approved ? 'externally-reviewed' : 'needs-more-reviewers',
    },
  }
}

module.exports = {
  buildClinicalEvidence,
  validateExternalEvidence,
}
