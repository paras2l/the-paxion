'use strict'

const SAFE_TERMINAL_PATTERNS = [
  /^npm\s+(run\s+build|run\s+lint|test)$/i,
  /^node\s+--version$/i,
  /^git\s+(status|diff\s+--stat|log\s+--oneline\s+-n\s+\d+)$/i,
  /^nmap\s+--version$/i,
  /^nmap\s+--help$/i,
  /^python\s+--version$/i,
  /^pip\s+--version$/i,
]

function assessTerminalCommand(command) {
  const value = String(command || '').trim()
  if (!value) {
    return {
      allowed: false,
      risk: 'high',
      reason: 'Command is empty.',
    }
  }

  const allowed = SAFE_TERMINAL_PATTERNS.some((pattern) => pattern.test(value))
  if (!allowed) {
    return {
      allowed: false,
      risk: 'high',
      reason: 'Command is outside safe terminal allowlist. Use workspace tooling approval flow for expansion.',
    }
  }

  return {
    allowed: true,
    risk: 'low',
    reason: 'Command matches safe allowlist.',
  }
}

function buildCommandPlan(input) {
  const command = String(input?.command || '').trim()
  const assessment = assessTerminalCommand(command)
  return {
    ok: true,
    plan: {
      id: `term-${Date.now().toString(36)}`,
      command,
      allowed: assessment.allowed,
      risk: assessment.risk,
      reason: assessment.reason,
      preflight: [
        'Check admin session state.',
        'Validate policy decision for workspace.runToolCommand.',
        'Capture stdout/stderr and write audit event.',
      ],
    },
  }
}

module.exports = {
  assessTerminalCommand,
  buildCommandPlan,
}
