'use strict'

const { ipcMain, dialog, app } = require('electron')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const pdfParse = require('pdf-parse')

const ADMIN_CODEWORD = 'paro the chief'
const ADMIN_SESSION_TTL_MS = 15 * 60 * 1000
const APPROVAL_TTL_MS = 5 * 60 * 1000

const DEFAULT_CAPABILITIES = {
  workspaceExecution: true,
  workspaceFileWrite: true,
  libraryIngestLocal: true,
  libraryIngestWeb: false,
  voiceInput: true,
  voiceOutput: true,
}

const ACTION_REQUIRED_CAPABILITY = {
  'workspace.generateComponent': 'workspaceExecution',
  'library.ingestDocument': 'libraryIngestLocal',
}

// ── Policy constants (authoritative main-process mirror of src/security/policy.ts) ──

const BLOCKED_ACTION_IDS = new Set([
  'security.disablePolicy',
  'security.deleteAudit',
  'network.exfiltrateData',
  'system.disableDefenses',
])

const PROTECTED_PATH_PREFIXES = [
  '/src/security',
  '/electron',
  '/docs/paxion-master-brief.md',
  '/docs/development-checkpoints.md',
]

const CODEGEN_ALLOWED_PREFIXES = ['/workspace', '/generated', '/projects']

const SENSITIVE_CATEGORIES = new Set(['filesystem', 'network', 'codegen', 'system'])

function normalizePath(p) {
  return String(p).replace(/\\/g, '/').toLowerCase()
}

function isWithinPrefixes(p, prefixes) {
  const norm = normalizePath(p)
  return prefixes.some((prefix) => norm.startsWith(prefix))
}

function enforcePolicy(request) {
  if (!request || typeof request.actionId !== 'string') {
    return {
      allowed: false,
      requiresApproval: false,
      ruleId: 'invalid-request',
      reason: 'Malformed action request rejected by main-process policy.',
    }
  }

  if (BLOCKED_ACTION_IDS.has(request.actionId)) {
    return {
      allowed: false,
      requiresApproval: false,
      ruleId: 'blocked-action-id',
      reason: 'This action is permanently blocked by security policy.',
    }
  }

  const target = request.targetPath || ''
  if (target) {
    if (isWithinPrefixes(target, PROTECTED_PATH_PREFIXES)) {
      return {
        allowed: false,
        requiresApproval: false,
        ruleId: 'immutable-core-protection',
        reason: 'Target path belongs to immutable security core and cannot be modified.',
      }
    }
    if (request.category === 'codegen' && !isWithinPrefixes(target, CODEGEN_ALLOWED_PREFIXES)) {
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

function finalizePolicyDecision(baseDecision, context) {
  if (!baseDecision.allowed || !baseDecision.requiresApproval) {
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

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function buildAdminSessionState() {
  return {
    unlocked: false,
    unlockedAt: null,
    expiresAt: null,
  }
}

function isAdminUnlocked(adminSession) {
  if (!adminSession.unlocked || !adminSession.expiresAt) {
    return false
  }

  if (Date.now() > adminSession.expiresAt) {
    adminSession.unlocked = false
    adminSession.unlockedAt = null
    adminSession.expiresAt = null
    return false
  }

  return true
}

function buildDeniedDecision(ruleId, reason) {
  return {
    allowed: false,
    requiresApproval: true,
    ruleId,
    reason,
  }
}

function sanitizeRelativePath(inputPath) {
  const normalized = String(inputPath || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const safe = normalized
    .split('/')
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .join(path.sep)
  return safe
}

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue)
  }

  if (value && typeof value === 'object') {
    const sorted = Object.keys(value)
      .sort()
      .map((key) => [key, sortValue(value[key])])
    return Object.fromEntries(sorted)
  }

  return value
}

function stableStringify(value) {
  return JSON.stringify(sortValue(value))
}

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

// ── IPC handler registration ──

function registerIpcHandlers(mainWindow) {
  const auditFilePath = path.join(app.getPath('userData'), 'paxion-audit.jsonl')
  const approvalsFilePath = path.join(app.getPath('userData'), 'paxion-approvals.json')
  const workspaceStateFilePath = path.join(app.getPath('userData'), 'paxion-workspace-state.json')
  const capabilityStateFilePath = path.join(app.getPath('userData'), 'paxion-capabilities.json')
  const adminSession = buildAdminSessionState()
  const approvalTickets = new Map()
  let capabilityState = { ...DEFAULT_CAPABILITIES }
  const auditState = {
    lastHash: 'GENESIS',
    lastIndex: 0,
  }

  function loadAuditEntriesFromDisk() {
    if (!fs.existsSync(auditFilePath)) {
      return []
    }

    const raw = fs.readFileSync(auditFilePath, 'utf8')
    return raw
      .split('\n')
      .filter(Boolean)
      .reduce((acc, line) => {
        try {
          acc.push(JSON.parse(line))
        } catch {
          // Skip corrupt lines rather than crashing.
        }
        return acc
      }, [])
  }

  function initializeAuditState() {
    try {
      const entries = loadAuditEntriesFromDisk()
      const last = entries.at(-1)

      if (!last) {
        auditState.lastHash = 'GENESIS'
        auditState.lastIndex = 0
        return
      }

      auditState.lastHash = typeof last.hash === 'string' ? last.hash : 'GENESIS'
      const matched = /^log-(\d+)$/.exec(String(last.id || ''))
      auditState.lastIndex = matched ? Number(matched[1]) : entries.length
    } catch {
      auditState.lastHash = 'GENESIS'
      auditState.lastIndex = 0
    }
  }

  function appendAuditEntry(type, payload) {
    const nextIndex = auditState.lastIndex + 1
    const entrySeed = {
      id: `log-${nextIndex}`,
      timestamp: new Date().toISOString(),
      type,
      payload,
      prevHash: auditState.lastHash,
    }

    const entry = {
      ...entrySeed,
      hash: sha256Hex(stableStringify(entrySeed)),
    }

    fs.appendFileSync(auditFilePath, JSON.stringify(entry) + '\n', 'utf8')
    auditState.lastIndex = nextIndex
    auditState.lastHash = entry.hash
    return entry
  }

  function saveApprovalTickets() {
    try {
      const data = JSON.stringify(Array.from(approvalTickets.values()), null, 2)
      fs.writeFileSync(approvalsFilePath, data, 'utf8')
    } catch (err) {
      console.error('[Paxion] approval save failed:', err)
    }
  }

  function cleanupExpiredApprovalTickets() {
    const now = Date.now()
    let changed = false
    for (const [ticketId, ticket] of approvalTickets.entries()) {
      if (ticket.expiresAt < now) {
        approvalTickets.delete(ticketId)
        changed = true
      }
    }
    if (changed) {
      saveApprovalTickets()
    }
  }

  function loadApprovalTickets() {
    if (!fs.existsSync(approvalsFilePath)) {
      return
    }

    try {
      const raw = fs.readFileSync(approvalsFilePath, 'utf8')
      const rows = JSON.parse(raw)
      if (!Array.isArray(rows)) {
        return
      }

      for (const row of rows) {
        if (!row || typeof row !== 'object') {
          continue
        }

        const ticket = {
          id: String(row.id || ''),
          actionId: String(row.actionId || ''),
          createdAt: Number(row.createdAt || 0),
          expiresAt: Number(row.expiresAt || 0),
        }

        if (!ticket.id || !ticket.actionId) {
          continue
        }

        approvalTickets.set(ticket.id, ticket)
      }

      cleanupExpiredApprovalTickets()
    } catch (err) {
      console.error('[Paxion] approval load failed:', err)
    }
  }

  function issueApprovalTicket(actionId, ttlMs = APPROVAL_TTL_MS) {
    cleanupExpiredApprovalTickets()

    const createdAt = Date.now()
    const ticket = {
      id: makeId(),
      actionId,
      createdAt,
      expiresAt: createdAt + ttlMs,
    }

    approvalTickets.set(ticket.id, ticket)
    saveApprovalTickets()
    return ticket
  }

  function consumeApprovalTicket(ticketId, actionId) {
    cleanupExpiredApprovalTickets()

    const ticket = approvalTickets.get(ticketId)
    if (!ticket) {
      return false
    }

    approvalTickets.delete(ticketId)
    saveApprovalTickets()

    if (ticket.actionId !== actionId) {
      return false
    }

    return Date.now() <= ticket.expiresAt
  }

  function isCodewordValid(codeword) {
    return String(codeword || '').trim().toLowerCase() === ADMIN_CODEWORD
  }

  function loadCapabilityState() {
    if (!fs.existsSync(capabilityStateFilePath)) {
      capabilityState = { ...DEFAULT_CAPABILITIES }
      return
    }

    try {
      const raw = fs.readFileSync(capabilityStateFilePath, 'utf8')
      const parsed = JSON.parse(raw)
      capabilityState = {
        ...DEFAULT_CAPABILITIES,
        ...(parsed && typeof parsed === 'object' ? parsed : {}),
      }
    } catch {
      capabilityState = { ...DEFAULT_CAPABILITIES }
    }
  }

  function saveCapabilityState() {
    fs.writeFileSync(capabilityStateFilePath, JSON.stringify(capabilityState, null, 2), 'utf8')
  }

  function decideRequest(request, adminCodeword) {
    const baseDecision = enforcePolicy(request)

    const requiredCapability = ACTION_REQUIRED_CAPABILITY[request?.actionId]
    if (requiredCapability && capabilityState[requiredCapability] === false) {
      const deniedDecision = {
        allowed: false,
        requiresApproval: false,
        ruleId: 'capability-disabled',
        reason: `Action blocked because capability "${requiredCapability}" is disabled in Access tab.`,
      }

      return {
        baseDecision: deniedDecision,
        finalDecision: deniedDecision,
        context: {
          adminSessionActive: isAdminUnlocked(adminSession),
          adminVerified: false,
          approvalGranted: false,
          approvalTicketId: null,
          approvalExpiresAt: null,
        },
      }
    }

    if (!baseDecision.allowed || !baseDecision.requiresApproval) {
      return {
        baseDecision,
        finalDecision: baseDecision,
        context: {
          adminSessionActive: isAdminUnlocked(adminSession),
          adminVerified: false,
          approvalGranted: false,
          approvalTicketId: null,
          approvalExpiresAt: null,
        },
      }
    }

    const adminSessionActive = isAdminUnlocked(adminSession)
    if (!adminSessionActive) {
      const deniedDecision = buildDeniedDecision(
        'admin-session-required',
        'Sensitive action rejected because admin session is locked or expired.',
      )

      return {
        baseDecision,
        finalDecision: deniedDecision,
        context: {
          adminSessionActive: false,
          adminVerified: false,
          approvalGranted: false,
          approvalTicketId: null,
          approvalExpiresAt: null,
        },
      }
    }

    const adminVerified = isCodewordValid(adminCodeword)
    if (!adminVerified) {
      const deniedDecision = finalizePolicyDecision(baseDecision, {
        adminVerified: false,
        approvalGranted: false,
      })

      return {
        baseDecision,
        finalDecision: deniedDecision,
        context: {
          adminSessionActive,
          adminVerified: false,
          approvalGranted: false,
          approvalTicketId: null,
          approvalExpiresAt: null,
        },
      }
    }

    const ticket = issueApprovalTicket(request.actionId)
    const approvalGranted = consumeApprovalTicket(ticket.id, request.actionId)
    const finalDecision = finalizePolicyDecision(baseDecision, {
      adminVerified,
      approvalGranted,
    })

    return {
      baseDecision,
      finalDecision,
      context: {
        adminSessionActive,
        adminVerified,
        approvalGranted,
        approvalTicketId: ticket.id,
        approvalExpiresAt: ticket.expiresAt,
      },
    }
  }

  async function executeAllowedAction(request) {
    const actionId = request?.actionId

    if (actionId === 'workspace.generateComponent') {
      const targetPath = String(request?.targetPath || '/workspace/generated-component.tsx')
      const rel = sanitizeRelativePath(targetPath.replace(/^\/workspace\/?/i, ''))
      const workspaceRoot = path.join(app.getPath('userData'), 'paxion-workspace')
      const outputPath = path.join(workspaceRoot, rel || 'generated-component.tsx')

      fs.mkdirSync(path.dirname(outputPath), { recursive: true })

      const componentName = 'PaxionGeneratedComponent'
      const code = [
        "import React from 'react'",
        '',
        `export function ${componentName}() {`,
        "  return <section>Generated by Paxion under guarded execution flow.</section>",
        '}',
        '',
      ].join('\n')

      fs.writeFileSync(outputPath, code, 'utf8')

      return {
        executed: true,
        mode: 'filesystem-write',
        outputPath,
      }
    }

    if (actionId === 'library.ingestDocument') {
      return {
        executed: true,
        mode: 'knowledge-op',
        note: 'Library ingestion is handled in renderer flow with user-picked content.',
      }
    }

    return {
      executed: true,
      mode: 'no-op',
      note: 'Action was allowed and acknowledged; no execution adapter registered yet.',
    }
  }

  loadApprovalTickets()
  initializeAuditState()
  loadCapabilityState()

  // Legacy endpoint for compatibility with existing renderer logging calls.
  ipcMain.handle('paxion:audit:append', (_event, input) => {
    try {
      const type = typeof input?.type === 'string' ? input.type : 'action_result'
      const payload =
        input && typeof input === 'object' && input.payload && typeof input.payload === 'object'
          ? input.payload
          : { detail: input }

      return appendAuditEntry(type, payload)
    } catch (err) {
      console.error('[Paxion] audit append failed:', err)
      return null
    }
  })

  // Load the full persisted audit log on startup.
  // This endpoint is privileged and requires an active admin session.
  ipcMain.handle('paxion:audit:load', () => {
    if (!isAdminUnlocked(adminSession)) {
      return {
        ok: false,
        reason: 'Admin session required.',
        entries: [],
      }
    }

    try {
      const entries = loadAuditEntriesFromDisk()

      return {
        ok: true,
        entries,
      }
    } catch (err) {
      console.error('[Paxion] audit load failed:', err)
      return {
        ok: false,
        reason: 'Failed to read audit log.',
        entries: [],
      }
    }
  })

  ipcMain.handle('paxion:admin:unlock', (_event, codeword) => {
    const valid = String(codeword || '').trim().toLowerCase() === ADMIN_CODEWORD
    if (!valid) {
      return {
        ok: false,
        reason: 'Invalid codeword.',
      }
    }

    const now = Date.now()
    adminSession.unlocked = true
    adminSession.unlockedAt = now
    adminSession.expiresAt = now + ADMIN_SESSION_TTL_MS

    return {
      ok: true,
      unlocked: true,
      expiresAt: adminSession.expiresAt,
    }
  })

  ipcMain.handle('paxion:admin:status', () => {
    return {
      unlocked: isAdminUnlocked(adminSession),
      expiresAt: adminSession.expiresAt,
    }
  })

  ipcMain.handle('paxion:admin:lock', () => {
    adminSession.unlocked = false
    adminSession.unlockedAt = null
    adminSession.expiresAt = null
    return {
      ok: true,
      unlocked: false,
    }
  })

  // Authoritative main-process policy evaluation.
  ipcMain.handle('paxion:policy:evaluate', (_event, request) => {
    return enforcePolicy(request)
  })

  ipcMain.handle('paxion:access:load', () => {
    return {
      ok: true,
      capabilities: capabilityState,
    }
  })

  ipcMain.handle('paxion:access:set', (_event, input) => {
    const key = String(input?.key || '')
    const enabled = Boolean(input?.enabled)

    if (!(key in DEFAULT_CAPABILITIES)) {
      return {
        ok: false,
        reason: 'Unknown capability key.',
        capabilities: capabilityState,
      }
    }

    capabilityState = {
      ...capabilityState,
      [key]: enabled,
    }
    saveCapabilityState()

    appendAuditEntry('action_result', {
      actionId: 'access.setCapability',
      status: 'allowed',
      reason: `Capability ${key} set to ${enabled ? 'enabled' : 'disabled'}`,
    })

    return {
      ok: true,
      capabilities: capabilityState,
    }
  })

  // Full decision endpoint: policy evaluate + admin verify + approval ticket consume.
  ipcMain.handle('paxion:policy:decide', (_event, input) => {
    const request = input?.request
    const adminCodeword = input?.adminCodeword
    return decideRequest(request, adminCodeword)
  })

  // Atomic endpoint: decision and execution are coupled in main process.
  ipcMain.handle('paxion:action:execute', async (_event, input) => {
    const request = input?.request
    const adminCodeword = input?.adminCodeword
    const decision = decideRequest(request, adminCodeword)

    appendAuditEntry('policy_check', {
      request,
      decision: decision.baseDecision,
    })

    if (decision.context.approvalTicketId) {
      appendAuditEntry('approval_issue', {
        actionId: request?.actionId,
        ticketId: decision.context.approvalTicketId,
        expiresAt: decision.context.approvalExpiresAt
          ? new Date(decision.context.approvalExpiresAt).toISOString()
          : null,
      })

      appendAuditEntry('approval_use', {
        actionId: request?.actionId,
        ticketId: decision.context.approvalTicketId,
        approvalGranted: decision.context.approvalGranted,
      })
    }

    let execution
    if (!decision.finalDecision.allowed) {
      execution = {
        executed: false,
        mode: 'blocked',
        note: 'Execution skipped because final decision denied.',
      }
    } else {
      execution = await executeAllowedAction(request)
    }

    appendAuditEntry('action_result', {
      actionId: request?.actionId,
      status: decision.finalDecision.allowed ? 'allowed' : 'denied',
      reason: decision.finalDecision.reason,
      execution,
    })

    return {
      ...decision,
      execution,
    }
  })

  // Native file picker for Library ingestion.
  ipcMain.handle('paxion:library:pickFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Add Document to Library',
      filters: [
        { name: 'PDF Documents', extensions: ['pdf'] },
        {
          name: 'Text & Code',
          extensions: ['txt', 'md', 'ts', 'tsx', 'js', 'jsx', 'json', 'csv', 'xml', 'yaml', 'yml'],
        },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })

    if (result.canceled || result.filePaths.length === 0) return null

    const filePath = result.filePaths[0]
    try {
      const stat = fs.statSync(filePath)
      const MAX_BYTES = 52 * 1024 * 1024 // 52 MB — enough for large books
      if (stat.size > MAX_BYTES) {
        return { error: 'File too large. Maximum 52 MB allowed.' }
      }

      const ext = path.extname(filePath).toLowerCase()
      if (ext === '.pdf') {
        const buffer = fs.readFileSync(filePath)
        const parsed = await pdfParse(buffer)
        return {
          name: path.basename(filePath),
          content: parsed.text,
          path: filePath,
          pageCount: parsed.numpages,
        }
      }

      const content = fs.readFileSync(filePath, 'utf8')
      return { name: path.basename(filePath), content, path: filePath }
    } catch (err) {
      return { error: `Could not read file: ${err.message}` }
    }
  })

  ipcMain.handle('paxion:workspace:load', () => {
    try {
      if (!fs.existsSync(workspaceStateFilePath)) {
        return {
          ok: true,
          state: {
            goal: '',
            plan: [],
            updatedAt: null,
          },
        }
      }

      const raw = fs.readFileSync(workspaceStateFilePath, 'utf8')
      const parsed = JSON.parse(raw)
      const state = {
        goal: typeof parsed?.goal === 'string' ? parsed.goal : '',
        plan: Array.isArray(parsed?.plan) ? parsed.plan : [],
        updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : null,
      }

      return {
        ok: true,
        state,
      }
    } catch (err) {
      return {
        ok: false,
        reason: `Failed to load workspace state: ${err.message}`,
        state: {
          goal: '',
          plan: [],
          updatedAt: null,
        },
      }
    }
  })

  ipcMain.handle('paxion:workspace:save', (_event, input) => {
    try {
      const state = {
        goal: typeof input?.goal === 'string' ? input.goal : '',
        plan: Array.isArray(input?.plan) ? input.plan : [],
        updatedAt: new Date().toISOString(),
      }

      fs.writeFileSync(workspaceStateFilePath, JSON.stringify(state, null, 2), 'utf8')
      return {
        ok: true,
        updatedAt: state.updatedAt,
      }
    } catch (err) {
      return {
        ok: false,
        reason: `Failed to save workspace state: ${err.message}`,
      }
    }
  })

  ipcMain.handle('paxion:workspace:clear', () => {
    try {
      if (fs.existsSync(workspaceStateFilePath)) {
        fs.unlinkSync(workspaceStateFilePath)
      }
      return {
        ok: true,
      }
    } catch (err) {
      return {
        ok: false,
        reason: `Failed to clear workspace state: ${err.message}`,
      }
    }
  })
}

module.exports = { registerIpcHandlers }
