import type { ActionRequest, EnforcementContext, PolicyDecision } from './types'

const ADMIN_CODEWORD = 'paro the chief'

const PROTECTED_PATH_PREFIXES = [
  '/src/security',
  '/electron',
  '/docs/paxion-master-brief.md',
  '/docs/development-checkpoints.md',
]

const CODEGEN_ALLOWED_PREFIXES = ['/workspace', '/generated', '/projects']

const BLOCKED_ACTION_IDS = new Set([
  'security.disablePolicy',
  'security.deleteAudit',
  'network.exfiltrateData',
  'system.disableDefenses',
])

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

export function getImmutablePolicySummary(): string[] {
  return [
    'Security core files are immutable and cannot be changed by generated code.',
    'Code generation is restricted to approved workspace paths only.',
    'High-risk actions always require admin verification and explicit approval.',
    'Blocked operations stay blocked regardless of prompts or context.',
  ]
}

export function evaluateActionPolicy(request: ActionRequest): PolicyDecision {
  if (BLOCKED_ACTION_IDS.has(request.actionId)) {
    return {
      allowed: false,
      requiresApproval: false,
      ruleId: 'blocked-action-id',
      reason: 'This action is permanently blocked by security policy.',
    }
  }

  if (request.targetPath) {
    if (isWithinPrefixes(request.targetPath, PROTECTED_PATH_PREFIXES)) {
      return {
        allowed: false,
        requiresApproval: false,
        ruleId: 'immutable-core-protection',
        reason: 'Target path belongs to immutable security core and cannot be modified.',
      }
    }

    if (
      request.category === 'codegen' &&
      !isWithinPrefixes(request.targetPath, CODEGEN_ALLOWED_PREFIXES)
    ) {
      return {
        allowed: false,
        requiresApproval: false,
        ruleId: 'codegen-path-allowlist',
        reason: 'Code generation is restricted to approved workspace paths.',
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
