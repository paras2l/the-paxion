'use strict'

const crypto = require('crypto')

const HARMFUL_KEYWORD_PATTERN = /\b(hack|malware|ransom|phishing|ddos|exploit|exfiltrate|keylogger)\b/i

const JURISDICTION_RULES = {
  GLOBAL: {
    blockedActionIds: ['network.exfiltrateData', 'system.disableDefenses', 'security.disablePolicy'],
    requireReviewCategories: ['network', 'filesystem', 'system', 'codegen'],
  },
  US: {
    blockedActionIds: ['network.exfiltrateData', 'system.disableDefenses', 'security.disablePolicy'],
    requireReviewCategories: ['network', 'filesystem', 'system', 'codegen'],
  },
  EU: {
    blockedActionIds: ['network.exfiltrateData', 'system.disableDefenses', 'security.disablePolicy'],
    requireReviewCategories: ['network', 'filesystem', 'system', 'codegen'],
  },
  IN: {
    blockedActionIds: ['network.exfiltrateData', 'system.disableDefenses', 'security.disablePolicy'],
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

  if (HARMFUL_KEYWORD_PATTERN.test(`${actionId}\n${detail}`)) {
    return {
      allowed: false,
      requiresReview: false,
      ruleId: 'harmful-operation-blocked',
      reason: 'Potentially harmful or illegal cyber operation is blocked by policy.',
      jurisdiction,
      policySnapshotHash: buildPolicySnapshotHash(),
    }
  }

  if (rule.blockedActionIds.includes(actionId)) {
    return {
      allowed: false,
      requiresReview: false,
      ruleId: 'jurisdiction-blocked-action',
      reason: `Action blocked under ${jurisdiction} compliance policy.`,
      jurisdiction,
      policySnapshotHash: buildPolicySnapshotHash(),
    }
  }

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
