'use strict'

const crypto = require('crypto')

const JURISDICTION_RULES = {
  GLOBAL: {
    requireReviewCategories: ['network', 'filesystem', 'system', 'codegen'],
  },
  US: {
    requireReviewCategories: ['network', 'filesystem', 'system', 'codegen'],
  },
  EU: {
    requireReviewCategories: ['network', 'filesystem', 'system', 'codegen'],
  },
  IN: {
    requireReviewCategories: ['network', 'filesystem', 'system', 'codegen'],
  },
}

function normalizeJurisdiction(input) {
  const value = String(input || '').trim().toUpperCase()
  return JURISDICTION_RULES[value] ? value : 'GLOBAL'
}

function buildPolicySnapshotHash() {
  const payload = JSON.stringify(JURISDICTION_RULES)
  return crypto.createHash('sha256').update(payload).digest('hex')
}

function evaluateCompliance(input) {
  const actionId = String(input?.actionId || '')
  const category = String(input?.category || '')
  const detail = String(input?.detail || '')
  const jurisdiction = normalizeJurisdiction(input?.jurisdiction)
  const rule = JURISDICTION_RULES[jurisdiction] || JURISDICTION_RULES.GLOBAL

  const requiresReview = rule.requireReviewCategories.includes(category)
  return {
    allowed: true,
    requiresReview,
    ruleId: requiresReview ? 'jurisdiction-reviewed-action' : 'jurisdiction-standard-action',
    reason: requiresReview
      ? `Action requires review under ${jurisdiction} compliance policy.`
      : `Action allowed under ${jurisdiction} compliance policy.`,
    jurisdiction,
    policySnapshotHash: buildPolicySnapshotHash(),
  }
}

module.exports = {
  evaluateCompliance,
  normalizeJurisdiction,
  buildPolicySnapshotHash,
}
