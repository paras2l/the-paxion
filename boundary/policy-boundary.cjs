'use strict'

const ADMIN_CODEWORD = 'paro the chief'
const MASTER_CODEWORD = 'paro the master'

const MASTER_GATED_ACTION_IDS = new Set([
  'security.disablePolicy',
  'security.deleteAudit',
  'network.exfiltrateData',
  'system.disableDefenses',
])

const HARMFUL_PATTERN = /\b(hack|malware|ransom|phishing|ddos|exploit|exfiltrate|keylogger)\b/i

// Only this boundary folder is immutable to self-generated code edits.
const IMMUTABLE_BOUNDARY_PREFIXES = ['/boundary']

const SENSITIVE_CATEGORIES = new Set(['filesystem', 'network', 'codegen', 'system'])

function normalizePath(p) {
  return String(p || '').replace(/\\/g, '/').toLowerCase()
}

function isWithinPrefixes(p, prefixes) {
  const norm = normalizePath(p)
  return prefixes.some((prefix) => norm.startsWith(prefix))
}

function isBoundaryProtectedPath(targetPath) {
  return isWithinPrefixes(targetPath, IMMUTABLE_BOUNDARY_PREFIXES)
}

function isMasterGatedAction(request) {
  return (
    MASTER_GATED_ACTION_IDS.has(String(request?.actionId || '')) ||
    HARMFUL_PATTERN.test(`${String(request?.actionId || '')}\n${String(request?.detail || '')}`)
  )
}

function isAdminCodewordValid(codeword) {
  return String(codeword || '').trim().toLowerCase() === ADMIN_CODEWORD
}

function isMasterCodewordValid(codeword) {
  return String(codeword || '').trim().toLowerCase() === MASTER_CODEWORD
}

module.exports = {
  ADMIN_CODEWORD,
  MASTER_CODEWORD,
  MASTER_GATED_ACTION_IDS,
  HARMFUL_PATTERN,
  IMMUTABLE_BOUNDARY_PREFIXES,
  SENSITIVE_CATEGORIES,
  normalizePath,
  isWithinPrefixes,
  isBoundaryProtectedPath,
  isMasterGatedAction,
  isAdminCodewordValid,
  isMasterCodewordValid,
}
