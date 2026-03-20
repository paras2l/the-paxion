import type { ActionRequest, EnforcementContext, PolicyDecision } from './types'

const ADMIN_CODEWORD = 'paro the chief'
const MASTER_CODEWORD = 'paro the master'

const IMMUTABLE_BOUNDARY_PREFIXES = ['/boundary']

const MASTER_GATED_ACTION_IDS = new Set([
  'security.disablePolicy',
  'security.deleteAudit',
  'network.exfiltrateData',
  'system.disableDefenses',
])

const HARMFUL_PATTERN = /\b(hack|malware|ransom|phishing|ddos|exploit|exfiltrate|keylogger)\b/i

const SENSITIVE_CATEGORIES = new Set(['filesystem', 'network', 'codegen', 'system'])

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase()
}

function isWithinPrefixes(path: string, prefixes: string[]): boolean {
  const normalized = normalizePath(path)
  return prefixes.some((prefix) => normalized.startsWith(prefix))
}

export function verifyAdminCodeword(value: string): boolean {
  return value.trim().toLowerCase() === ADMIN_CODEWORD
}

export function verifyMasterCodeword(value: string): boolean {
  return value.trim().toLowerCase() === MASTER_CODEWORD
}

export function getImmutablePolicySummary(): string[] {
  return [
    'Boundary policy folder is immutable and cannot be changed by generated code.',
    'Code generation can modify app code outside the boundary folder with admin approval.',
    'High-risk actions always require admin verification and explicit approval.',
    'Master-gated actions require the secret master codeword in addition to normal safeguards.',
  ]
}

export function evaluateActionPolicy(request: ActionRequest): PolicyDecision {
  const isMasterGated =
    MASTER_GATED_ACTION_IDS.has(request.actionId) ||
    HARMFUL_PATTERN.test(`${request.actionId}\n${String(request.detail || '')}`)

  if (isMasterGated && !verifyMasterCodeword(String(request.masterCodeword || ''))) {
    return {
      allowed: false,
      requiresApproval: false,
      ruleId: 'master-codeword-required',
      reason: 'This action requires the master codeword "paro the master" to proceed.',
    }
  }

  if (request.targetPath) {
    if (isWithinPrefixes(request.targetPath, IMMUTABLE_BOUNDARY_PREFIXES)) {
      return {
        allowed: false,
        requiresApproval: false,
        ruleId: 'immutable-boundary-protection',
        reason: 'Target path belongs to immutable policy boundary and cannot be modified.',
      }
    }
  }

  if (SENSITIVE_CATEGORIES.has(request.category)) {
    return {
      allowed: true,
      requiresApproval: true,
      ruleId: 'sensitive-action-gate',
      reason: 'Sensitive action requires explicit admin verification and approval.',
    }
  }

  return {
    allowed: true,
    requiresApproval: false,
    ruleId: 'standard-allow',
    reason: 'Action is allowed under current baseline policy.',
  }
}

export function finalizePolicyDecision(
  baseDecision: PolicyDecision,
  context: EnforcementContext,
): PolicyDecision {
  if (!baseDecision.allowed) {
    return baseDecision
  }

  if (!baseDecision.requiresApproval) {
    return baseDecision
  }

  if (!context.adminVerified) {
    return {
      allowed: false,
      requiresApproval: true,
      ruleId: 'admin-verification-required',
      reason: 'Sensitive action rejected because admin codeword verification is missing.',
    }
  }

  if (!context.approvalGranted) {
    return {
      allowed: false,
      requiresApproval: true,
      ruleId: 'approval-ticket-required',
      reason: 'Sensitive action rejected because approval ticket is missing or invalid.',
    }
  }

  return {
    allowed: true,
    requiresApproval: true,
    ruleId: 'sensitive-action-approved',
    reason: 'Sensitive action approved with admin verification and valid approval ticket.',
  }
}

export function checkCodewordObedience(text: string): { allowed: boolean; reason?: string; cleanText: string } {
  const lowerText = text.toLowerCase()

  // Map of patterns that trigger restricted mode, excluding normal conversational chat
  const restrictedPatterns = [
    /\brun\s+terminal\b/i,
    /\bterminal\s+run\b/i,
    /\bcheck\s+nmap\b/i,
    /\bnmap\s+version\b/i,
    /\bcall\b/i,
    /\b(make|create|generate)\s+(ai\s+)?workflow\b/i,
    /\b(creative|ideate|brainstorm|research\s+idea)\b/i,
    /\badmin\b/i,
    /\bsudo\b/i,
    /\bexecute\b/i,
    /\bsystem\b/i,
  ]

  const isRestricted = restrictedPatterns.some((pattern) => pattern.test(lowerText))

  if (isRestricted) {
    if (lowerText.includes(MASTER_CODEWORD)) {
      return {
        allowed: true,
        cleanText: text.replace(new RegExp(MASTER_CODEWORD, 'ig'), '').trim(),
      }
    }
    if (lowerText.includes(ADMIN_CODEWORD)) {
      return {
        allowed: true,
        cleanText: text.replace(new RegExp(ADMIN_CODEWORD, 'ig'), '').trim(),
      }
    }

    return {
      allowed: false,
      reason: 'Missing authorization codeword ("paro the chief" or "paro the master") for restricted command.',
      cleanText: text,
    }
  }

  return { allowed: true, cleanText: text }
}
