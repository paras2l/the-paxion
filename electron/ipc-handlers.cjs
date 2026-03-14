'use strict'

const { ipcMain, dialog, app, shell } = require('electron')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const pdfParse = require('pdf-parse')

const ADMIN_CODEWORD = 'paro the chief'
const ADMIN_SESSION_TTL_MS = 15 * 60 * 1000
const APPROVAL_TTL_MS = 5 * 60 * 1000

const DEFAULT_CAPABILITIES = {
  workspaceExecution: true,
  workspaceFileWrite: true,
  workspaceTooling: false,
  vscodeControl: false,
  desktopAppAutomation: false,
  webAppAutomation: false,
  mediaGeneration: false,
  selfEvolution: false,
  videoLearning: false,
  libraryIngestLocal: true,
  libraryIngestWeb: false,
  chatExternalModel: false,
  voiceInput: true,
  voiceOutput: true,
}

const ACTION_REQUIRED_CAPABILITY = {
  'workspace.generateComponent': 'workspaceExecution',
  'library.ingestDocument': 'libraryIngestLocal',
  'workspace.runToolCommand': 'workspaceTooling',
  'vscode.executeCommand': 'vscodeControl',
  'automation.desktopAppEdit': 'desktopAppAutomation',
  'automation.webAppEdit': 'webAppAutomation',
  'media.generateAsset': 'mediaGeneration',
  'workspace.selfEvolve': 'selfEvolution',
  'learning.youtubeSegmentStudy': 'videoLearning',
}

const TOOL_COMMAND_ALLOWLIST = new Set([
  'npm run build',
  'npm run lint',
  'npm test',
  'git status',
  'git diff --stat',
])

const VSCODE_COMMAND_ALLOWLIST = new Set([
  'workbench.view.explorer',
  'workbench.view.scm',
  'workbench.action.terminal.toggleTerminal',
  'workbench.action.tasks.runTask',
])

const AUTOMATION_ADAPTER_ALLOWLIST = new Set([
  'browser.formFill.basic',
  'browser.clickFlow.basic',
])

const AUTOMATION_STEP_TYPE_ALLOWLIST = new Set([
  'fill',
  'click',
  'select',
  'wait',
  'extractText',
])

const OBSERVE_LEARN_TEMPLATE_DEFS = [
  {
    id: 'code-editor.observe-learn',
    appType: 'code-editor',
    name: 'Code Editor Observe + Learn',
    observe: [
      'Track file navigation and project structure changes.',
      'Track code edits and refactor sequence.',
      'Track run/build/test and error-fix loop.',
    ],
    learnFocus: 'Code change workflow, debugging loops, and project organization habits.',
    skillSignals: ['Code Editing Workflow', 'Debugging Workflow', 'Project Navigation'],
  },
  {
    id: 'cms.observe-learn',
    appType: 'cms',
    name: 'CMS Observe + Learn',
    observe: [
      'Track content section edits and publishing path.',
      'Track form fields and validation outcomes.',
      'Track media attach/update sequence.',
    ],
    learnFocus: 'Content operations, publishing flow, and web form reliability.',
    skillSignals: ['CMS Content Editing', 'Form Operations', 'Publishing Workflow'],
  },
  {
    id: 'design.observe-learn',
    appType: 'design',
    name: 'Design Tool Observe + Learn',
    observe: [
      'Track layer/component edits and alignment operations.',
      'Track typography/color adjustments and rationale.',
      'Track export pipeline and asset naming.',
    ],
    learnFocus: 'Design execution patterns, consistency, and export discipline.',
    skillSignals: ['Design Operations', 'UI Composition', 'Asset Export Workflow'],
  },
]

const AUTOMATION_ADAPTER_PROFILE_DEFS = [
  {
    id: 'profile.wordpress-post-update',
    name: 'WordPress Post Update',
    appType: 'cms',
    adapterId: 'browser.formFill.basic',
    targetUrl: 'https://example.com/wp-admin/post.php',
    intent: 'Update post title and content, then trigger save.',
    stepTemplate: [
      'fill|#title|Paxion updated title',
      'fill|#content|Updated content from approved mission context.',
      'click|#publish',
      'wait||1500',
    ],
    gainedSkills: ['CMS Content Editing', 'Publishing Workflow'],
  },
  {
    id: 'profile.figma-export-flow',
    name: 'Figma Export Flow',
    appType: 'design',
    adapterId: 'browser.clickFlow.basic',
    targetUrl: 'https://www.figma.com/',
    intent: 'Open design file and run export checklist in supervised mode.',
    stepTemplate: [
      'click|[data-testid="recent-file"]',
      'click|[data-testid="export-button"]',
      'wait||1000',
      'extractText|[data-testid="export-status"]',
    ],
    gainedSkills: ['Design Operations', 'Asset Export Workflow'],
  },
  {
    id: 'profile.github-pr-review',
    name: 'GitHub PR Review Prep',
    appType: 'code-editor',
    adapterId: 'browser.clickFlow.basic',
    targetUrl: 'https://github.com/',
    intent: 'Open pull request diff and capture review context.',
    stepTemplate: [
      'click|a[href*="/pull/"]',
      'click|button[aria-label="Files changed"]',
      'wait||1200',
      'extractText|.js-file-content',
    ],
    gainedSkills: ['Code Review Workflow', 'Project Navigation'],
  },
]

const SKILL_CAPABILITY_SUGGESTION_RULES = [
  {
    capability: 'workspaceTooling',
    anySkills: ['Workspace Automation', 'Debugging Workflow', 'Project Navigation'],
    reason: 'Frequent workflow/build patterns indicate tooling automation readiness.',
  },
  {
    capability: 'webAppAutomation',
    anySkills: ['CMS Content Editing', 'Web Research', 'Form Operations'],
    reason: 'Web operation patterns suggest supervised web automation can be expanded.',
  },
  {
    capability: 'desktopAppAutomation',
    anySkills: ['Design Operations', 'Code Editing Workflow', 'UI Composition'],
    reason: 'Desktop workflow skill signals indicate app automation potential.',
  },
  {
    capability: 'mediaGeneration',
    anySkills: ['Media Generation Workflow', 'Asset Export Workflow'],
    reason: 'Media-oriented skills suggest enabling media generation adapters.',
  },
  {
    capability: 'vscodeControl',
    anySkills: ['Code Editing Workflow', 'TypeScript Engineering', 'Project Navigation'],
    reason: 'IDE-centric skills suggest VS Code command bridge usage.',
  },
  {
    capability: 'selfEvolution',
    anySkills: ['Task-specific UI Automation', 'Security Policy Design', 'Debugging Workflow'],
    reason: 'Mature automation and policy skills suggest controlled self-evolution phase.',
  },
]

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

function execCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(
      command,
      {
        ...options,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject({ error, stdout, stderr })
          return
        }

        resolve({ stdout, stderr })
      },
    )
  })
}

function slugifyName(input, fallback = 'target') {
  const normalized = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || fallback
}

// ── IPC handler registration ──

function registerIpcHandlers(mainWindow) {
  const auditFilePath = path.join(app.getPath('userData'), 'paxion-audit.jsonl')
  const approvalsFilePath = path.join(app.getPath('userData'), 'paxion-approvals.json')
  const workspaceStateFilePath = path.join(app.getPath('userData'), 'paxion-workspace-state.json')
  const capabilityStateFilePath = path.join(app.getPath('userData'), 'paxion-capabilities.json')
  const libraryStateFilePath = path.join(app.getPath('userData'), 'paxion-library-state.json')
  const learningStateFilePath = path.join(app.getPath('userData'), 'paxion-learning-state.json')
  const adminSession = buildAdminSessionState()
  const approvalTickets = new Map()
  let capabilityState = { ...DEFAULT_CAPABILITIES }
  let learningState = {
    skills: [],
    logs: [],
    videoPlans: [],
    automationTemplates: OBSERVE_LEARN_TEMPLATE_DEFS,
    automationProfiles: AUTOMATION_ADAPTER_PROFILE_DEFS,
    executionRecords: [],
    updatedAt: null,
  }
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

  function integrationsStatus() {
    return {
      desktopRelay: true,
      googleReady: true,
      gptReady: true,
      requiresAdminApproval: true,
    }
  }

  function saveLearningState() {
    fs.writeFileSync(learningStateFilePath, JSON.stringify(learningState, null, 2), 'utf8')
  }

  function loadLearningState() {
    if (!fs.existsSync(learningStateFilePath)) {
      learningState = {
        skills: [],
        logs: [],
        videoPlans: [],
        automationTemplates: OBSERVE_LEARN_TEMPLATE_DEFS,
        automationProfiles: AUTOMATION_ADAPTER_PROFILE_DEFS,
        executionRecords: [],
        updatedAt: null,
      }
      return
    }

    try {
      const raw = fs.readFileSync(learningStateFilePath, 'utf8')
      const parsed = JSON.parse(raw)
      learningState = {
        skills: Array.isArray(parsed?.skills) ? parsed.skills.filter((x) => typeof x === 'string') : [],
        logs: Array.isArray(parsed?.logs) ? parsed.logs.filter((x) => x && typeof x === 'object') : [],
        videoPlans: Array.isArray(parsed?.videoPlans) ? parsed.videoPlans.filter((x) => x && typeof x === 'object') : [],
        automationTemplates:
          Array.isArray(parsed?.automationTemplates) && parsed.automationTemplates.length > 0
            ? parsed.automationTemplates.filter((x) => x && typeof x === 'object')
            : OBSERVE_LEARN_TEMPLATE_DEFS,
        automationProfiles:
          Array.isArray(parsed?.automationProfiles) && parsed.automationProfiles.length > 0
            ? parsed.automationProfiles.filter((x) => x && typeof x === 'object')
            : AUTOMATION_ADAPTER_PROFILE_DEFS,
        executionRecords:
          Array.isArray(parsed?.executionRecords)
            ? parsed.executionRecords.filter((x) => x && typeof x === 'object')
            : [],
        updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : null,
      }
    } catch {
      learningState = {
        skills: [],
        logs: [],
        videoPlans: [],
        automationTemplates: OBSERVE_LEARN_TEMPLATE_DEFS,
        automationProfiles: AUTOMATION_ADAPTER_PROFILE_DEFS,
        executionRecords: [],
        updatedAt: null,
      }
    }
  }

  function computeCapabilitySuggestions() {
    const skills = Array.isArray(learningState.skills) ? learningState.skills : []
    const lowerSkills = skills.map((s) => s.toLowerCase())

    return SKILL_CAPABILITY_SUGGESTION_RULES.filter((rule) => {
      if (capabilityState[rule.capability] === true) {
        return false
      }

      return rule.anySkills.some((skill) => lowerSkills.includes(String(skill).toLowerCase()))
    }).map((rule) => ({
      capability: rule.capability,
      reason: rule.reason,
      recommendedAction: `Review and optionally enable capability \"${rule.capability}\" in Access tab.`,
    }))
  }

  function appendExecutionRecord(input) {
    const ts = new Date().toISOString()
    const record = {
      id: `exec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: ts,
      domain: typeof input?.domain === 'string' ? input.domain : 'automation',
      adapterId: typeof input?.adapterId === 'string' ? input.adapterId : null,
      templateId: typeof input?.templateId === 'string' ? input.templateId : null,
      appType: typeof input?.appType === 'string' ? input.appType : null,
      intendedStep: typeof input?.intendedStep === 'string' ? input.intendedStep : 'No intended step recorded.',
      performedStep:
        typeof input?.performedStep === 'string'
          ? input.performedStep
          : 'No performed step recorded.',
      result: typeof input?.result === 'string' ? input.result : 'unknown',
      newSkills: Array.isArray(input?.newSkills)
        ? input.newSkills.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim())
        : [],
      metadata: input?.metadata && typeof input.metadata === 'object' ? input.metadata : {},
      simpleLog:
        typeof input?.simpleLog === 'string'
          ? input.simpleLog
          : 'Executed automation step with no simple log message.',
    }

    const mergedSkills = new Set(learningState.skills)
    for (const skill of record.newSkills) {
      mergedSkills.add(skill)
    }

    learningState = {
      ...learningState,
      skills: Array.from(mergedSkills).sort((a, b) => a.localeCompare(b)),
      executionRecords: [...(learningState.executionRecords || []), record].slice(-1200),
      updatedAt: ts,
    }

    saveLearningState()

    appendAuditEntry('action_result', {
      actionId: 'automation.executionRecord',
      status: 'allowed',
      reason: record.simpleLog,
      recordId: record.id,
      result: record.result,
      domain: record.domain,
    })

    return record
  }

  function appendLearningLog(input) {
    const ts = new Date().toISOString()
    const entry = {
      id: `learn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: ts,
      title: typeof input?.title === 'string' ? input.title : 'Learning event',
      detail: typeof input?.detail === 'string' ? input.detail : 'Knowledge updated.',
      source: typeof input?.source === 'string' ? input.source : 'system',
      newSkills: Array.isArray(input?.newSkills)
        ? input.newSkills.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim())
        : [],
    }

    const mergedSkills = new Set(learningState.skills)
    for (const skill of entry.newSkills) {
      mergedSkills.add(skill)
    }

    learningState = {
      ...learningState,
      skills: Array.from(mergedSkills).sort((a, b) => a.localeCompare(b)),
      logs: [...learningState.logs, entry].slice(-600),
      updatedAt: ts,
    }

    saveLearningState()

    appendAuditEntry('action_result', {
      actionId: 'learning.record',
      status: 'allowed',
      reason: entry.detail,
      title: entry.title,
      newSkills: entry.newSkills,
      source: entry.source,
    })

    return entry
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

  function normalizeLibraryDoc(doc) {
    if (!doc || typeof doc !== 'object') {
      return null
    }

    const content = typeof doc.content === 'string' ? doc.content : ''
    const trimmedContent = content.trim()
    if (!trimmedContent) {
      return null
    }

    return {
      id: typeof doc.id === 'string' && doc.id ? doc.id : makeId(),
      name: typeof doc.name === 'string' && doc.name.trim() ? doc.name.trim() : 'Untitled document',
      content: trimmedContent,
      addedAt: typeof doc.addedAt === 'string' ? doc.addedAt : new Date().toISOString(),
      wordCount:
        typeof doc.wordCount === 'number' && doc.wordCount > 0
          ? doc.wordCount
          : trimmedContent.split(/\s+/).filter(Boolean).length,
      excerpt:
        typeof doc.excerpt === 'string' && doc.excerpt
          ? doc.excerpt
          : trimmedContent.slice(0, 220),
      source: doc.source === 'file' ? 'file' : 'paste',
    }
  }

  function parseDetailValue(detail, key) {
    const text = String(detail || '')
    const pattern = new RegExp(`${key}\\s*=\\s*([^;\\n]+)`, 'i')
    const match = text.match(pattern)
    return match ? String(match[1]).trim() : ''
  }

  function normalizeYoutubeUrl(inputUrl) {
    const raw = String(inputUrl || '').trim()
    if (!raw) {
      return null
    }

    try {
      const parsed = new URL(raw)
      const host = parsed.hostname.toLowerCase()

      if (host.includes('youtube.com')) {
        const videoId = parsed.searchParams.get('v')
        if (!videoId) {
          return null
        }
        return `https://www.youtube.com/watch?v=${videoId}`
      }

      if (host === 'youtu.be') {
        const videoId = parsed.pathname.replace(/^\//, '').trim()
        if (!videoId) {
          return null
        }
        return `https://www.youtube.com/watch?v=${videoId}`
      }

      return null
    } catch {
      return null
    }
  }

  function buildYoutubeSegmentUrl(videoUrl, startMinute) {
    const startSeconds = Math.max(0, Math.floor(startMinute * 60))
    return `${videoUrl}&t=${startSeconds}s`
  }

  function normalizeAutomationSteps(rawSteps) {
    if (!Array.isArray(rawSteps)) {
      return {
        ok: false,
        reason: 'Automation steps must be an array.',
      }
    }

    if (rawSteps.length === 0 || rawSteps.length > 50) {
      return {
        ok: false,
        reason: 'Automation step count must be between 1 and 50.',
      }
    }

    const steps = []

    for (const raw of rawSteps) {
      if (!raw || typeof raw !== 'object') {
        return {
          ok: false,
          reason: 'Each automation step must be an object.',
        }
      }

      const action = String(raw.action || '').trim()
      if (!AUTOMATION_STEP_TYPE_ALLOWLIST.has(action)) {
        return {
          ok: false,
          reason: `Automation step action not allowlisted: ${action || 'unknown'}`,
        }
      }

      const selector = String(raw.selector || '').trim()
      const value = String(raw.value || '').trim()
      const waitMs = Number(raw.waitMs || 0)

      if ((action === 'fill' || action === 'click' || action === 'select' || action === 'extractText') && !selector) {
        return {
          ok: false,
          reason: `Step action ${action} requires a selector.`,
        }
      }

      if ((action === 'fill' || action === 'select') && !value) {
        return {
          ok: false,
          reason: `Step action ${action} requires a value.`,
        }
      }

      if (action === 'wait' && (waitMs < 50 || waitMs > 30000)) {
        return {
          ok: false,
          reason: 'Wait step requires waitMs between 50 and 30000.',
        }
      }

      steps.push({
        action,
        selector,
        value,
        waitMs,
      })
    }

    return {
      ok: true,
      steps,
    }
  }

  function createYoutubeSegmentPlan(input) {
    const topic = String(input?.topic || '').trim() || 'Untitled topic'
    const videoUrl = normalizeYoutubeUrl(input?.videoUrl)
    if (!videoUrl) {
      return {
        ok: false,
        reason: 'Invalid YouTube URL. Use youtube.com or youtu.be links.',
      }
    }

    const durationMinutes = Math.min(12 * 60, Math.max(1, Number(input?.durationMinutes || 60)))
    const segmentMinutes = Math.min(120, Math.max(1, Number(input?.segmentMinutes || 10)))
    const parallelSlots = Math.min(8, Math.max(1, Number(input?.parallelSlots || 3)))

    const segments = []
    let index = 1
    for (let start = 0; start < durationMinutes; start += segmentMinutes) {
      const end = Math.min(durationMinutes, start + segmentMinutes)
      segments.push({
        id: `seg-${Date.now().toString(36)}-${index}`,
        label: `${start}-${end} min`,
        startMinute: start,
        endMinute: end,
        status: 'pending',
        notes: '',
      })
      index += 1
    }

    const plan = {
      id: `yt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      topic,
      videoUrl,
      durationMinutes,
      segmentMinutes,
      parallelSlots,
      createdAt: new Date().toISOString(),
      segments,
    }

    return {
      ok: true,
      plan,
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

    if (actionId === 'workspace.runToolCommand') {
      const command = parseDetailValue(request?.detail, 'command') || String(request?.detail || '').trim()
      if (!command) {
        return {
          executed: false,
          mode: 'tool-bridge-denied',
          note: 'No tool command provided. Use detail: command=<allowed command>.',
        }
      }

      if (!TOOL_COMMAND_ALLOWLIST.has(command)) {
        return {
          executed: false,
          mode: 'tool-bridge-denied',
          note: `Command not allowlisted: ${command}`,
        }
      }

      try {
        const result = await execCommand(command, {
          cwd: process.cwd(),
          timeout: 60 * 1000,
          maxBuffer: 512 * 1024,
        })

        return {
          executed: true,
          mode: 'tool-bridge',
          note: `Executed allowlisted command: ${command}`,
          output: String(result.stdout || result.stderr || '').slice(0, 1500),
        }
      } catch (err) {
        return {
          executed: false,
          mode: 'tool-bridge-error',
          note: `Command failed: ${command}. ${String(err?.error?.message || '')}`,
          output: String(err?.stdout || err?.stderr || '').slice(0, 1500),
        }
      }
    }

    if (actionId === 'vscode.executeCommand') {
      const commandId = parseDetailValue(request?.detail, 'command') || String(request?.detail || '').trim()
      if (!commandId) {
        return {
          executed: false,
          mode: 'vscode-bridge-denied',
          note: 'No VS Code command provided. Use detail: command=<commandId>.',
        }
      }

      if (!VSCODE_COMMAND_ALLOWLIST.has(commandId)) {
        return {
          executed: false,
          mode: 'vscode-bridge-denied',
          note: `VS Code command not allowlisted: ${commandId}`,
        }
      }

      const uri = `vscode://command/${encodeURIComponent(commandId)}`
      await shell.openExternal(uri)

      return {
        executed: true,
        mode: 'tool-bridge',
        note: `Opened VS Code command URI for ${commandId}`,
        outputPath: uri,
      }
    }

    if (actionId === 'media.generateAsset') {
      const workspaceRoot = path.join(app.getPath('userData'), 'paxion-workspace')
      const baseName = `asset-${Date.now()}`
      const outputPath = path.join(workspaceRoot, 'media', `${baseName}.prompt.txt`)
      const manifestPath = path.join(workspaceRoot, 'media', `${baseName}.job.json`)
      fs.mkdirSync(path.dirname(outputPath), { recursive: true })
      const prompt = String(request?.detail || 'Generate an asset for current mission')
      fs.writeFileSync(
        outputPath,
        [
          'Paxion Media Generation Prompt',
          `Created: ${new Date().toISOString()}`,
          '',
          prompt,
          '',
          'This file is a mission artifact for downstream media tools.',
        ].join('\n'),
        'utf8',
      )

      fs.writeFileSync(
        manifestPath,
        JSON.stringify(
          {
            id: baseName,
            createdAt: new Date().toISOString(),
            prompt,
            adapters: ['image', 'video'],
            status: 'pending',
          },
          null,
          2,
        ),
        'utf8',
      )

      return {
        executed: true,
        mode: 'media-template',
        outputPath: `${outputPath};${manifestPath}`,
      }
    }

    if (actionId === 'automation.desktopAppEdit') {
      const appName = parseDetailValue(request?.detail, 'app') || 'unknown desktop app'
      const intent = parseDetailValue(request?.detail, 'intent') || String(request?.detail || '')
      const workspaceRoot = path.join(app.getPath('userData'), 'paxion-workspace')
      const safeName = slugifyName(appName, 'desktop-app')
      const outputPath = path.join(
        workspaceRoot,
        'automation',
        `desktop-${safeName}-${Date.now()}.playbook.md`,
      )
      fs.mkdirSync(path.dirname(outputPath), { recursive: true })
      fs.writeFileSync(
        outputPath,
        [
          '# Desktop App Automation Playbook',
          `Created: ${new Date().toISOString()}`,
          `App: ${appName}`,
          '',
          '## Intent',
          intent || 'No intent provided.',
          '',
          '## Execution Plan',
          '- Open target app manually with admin confirmation.',
          '- Navigate to target editor/screen.',
          '- Apply deterministic edit checklist from this playbook.',
          '- Validate output and log result in Paxion.',
        ].join('\n'),
        'utf8',
      )

      return {
        executed: true,
        mode: 'desktop-app-automation-playbook',
        note: `Generated automation playbook for ${appName}.`,
        outputPath,
      }
    }

    if (actionId === 'automation.webAppEdit') {
      const url = parseDetailValue(request?.detail, 'url')
      const intent = parseDetailValue(request?.detail, 'intent') || String(request?.detail || '')
      const workspaceRoot = path.join(app.getPath('userData'), 'paxion-workspace')
      const outputPath = path.join(
        workspaceRoot,
        'automation',
        `web-app-${Date.now()}.playbook.md`,
      )
      fs.mkdirSync(path.dirname(outputPath), { recursive: true })

      if (url) {
        try {
          await shell.openExternal(url)
        } catch {
          // Playbook generation still proceeds even if URL open fails.
        }
      }

      fs.writeFileSync(
        outputPath,
        [
          '# Web App Automation Playbook',
          `Created: ${new Date().toISOString()}`,
          `URL: ${url || 'N/A'}`,
          '',
          '## Intent',
          intent || 'No intent provided.',
          '',
          '## Execution Plan',
          '- Open web app session with user-approved credentials.',
          '- Navigate to target workspace/page.',
          '- Execute checklist edits from mission instructions.',
          '- Capture final diff/summary and log in Paxion.',
        ].join('\n'),
        'utf8',
      )

      return {
        executed: true,
        mode: 'web-app-automation-playbook',
        note: url
          ? 'Opened target URL and generated web automation playbook.'
          : 'Generated web automation playbook without launch URL.',
        outputPath,
      }
    }

    if (actionId === 'workspace.selfEvolve') {
      const workspaceRoot = path.join(app.getPath('userData'), 'paxion-workspace')
      const outputPath = path.join(workspaceRoot, 'evolution', `skill-proposal-${Date.now()}.md`)
      fs.mkdirSync(path.dirname(outputPath), { recursive: true })
      fs.writeFileSync(
        outputPath,
        [
          '# Paxion Skill Evolution Proposal',
          `Created: ${new Date().toISOString()}`,
          '',
          `Mission detail: ${String(request?.detail || 'N/A')}`,
          '',
          '## Proposed Steps',
          '- Define new capability and policy gate.',
          '- Add execution adapter in main process.',
          '- Add UI controls and logs in simple language.',
          '- Validate with lint/build and checkpoint.',
        ].join('\n'),
        'utf8',
      )

      return {
        executed: true,
        mode: 'self-evolution-proposal',
        outputPath,
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
  loadLearningState()

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

  ipcMain.handle('paxion:integrations:getStatus', () => {
    return {
      ok: true,
      ...integrationsStatus(),
    }
  })

  ipcMain.handle('paxion:learning:load', () => {
    if (!isAdminUnlocked(adminSession)) {
      return {
        ok: false,
        reason: 'Admin session required to read learning timeline.',
        skills: [],
        logs: [],
        videoPlans: [],
        updatedAt: null,
      }
    }

    return {
      ok: true,
      skills: learningState.skills,
      logs: learningState.logs,
      videoPlans: learningState.videoPlans || [],
      updatedAt: learningState.updatedAt,
    }
  })

  ipcMain.handle('paxion:learning:record', (_event, input) => {
    const entry = appendLearningLog(input)
    return {
      ok: true,
      entry,
      skills: learningState.skills,
      updatedAt: learningState.updatedAt,
      videoPlans: learningState.videoPlans || [],
    }
  })

  ipcMain.handle('paxion:automation:load', () => {
    if (!isAdminUnlocked(adminSession)) {
      return {
        ok: false,
        reason: 'Admin session required to load automation state.',
        templates: OBSERVE_LEARN_TEMPLATE_DEFS,
        profiles: AUTOMATION_ADAPTER_PROFILE_DEFS,
        records: [],
        suggestions: [],
        updatedAt: learningState.updatedAt,
      }
    }

    return {
      ok: true,
      templates: learningState.automationTemplates || OBSERVE_LEARN_TEMPLATE_DEFS,
      profiles: learningState.automationProfiles || AUTOMATION_ADAPTER_PROFILE_DEFS,
      records: learningState.executionRecords || [],
      suggestions: computeCapabilitySuggestions(),
      updatedAt: learningState.updatedAt,
    }
  })

  ipcMain.handle('paxion:automation:runAdapter', async (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return {
        ok: false,
        reason: 'Admin session required to run automation adapter.',
      }
    }

    const explicitPermission = Boolean(input?.explicitPermission)
    if (!explicitPermission) {
      return {
        ok: false,
        reason: 'Explicit permission is required to run adapter.',
      }
    }

    const adapterId = String(input?.adapterId || '').trim()
    if (!AUTOMATION_ADAPTER_ALLOWLIST.has(adapterId)) {
      return {
        ok: false,
        reason: `Adapter not allowlisted: ${adapterId || 'unknown'}`,
      }
    }

    if (adapterId.startsWith('browser.') && capabilityState.webAppAutomation === false) {
      return {
        ok: false,
        reason: 'webAppAutomation capability is disabled in Access tab.',
      }
    }

    const targetUrl = String(input?.targetUrl || '').trim()
    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      return {
        ok: false,
        reason: 'A valid http/https target URL is required.',
      }
    }

    const normalized = normalizeAutomationSteps(input?.steps)
    if (!normalized.ok) {
      return normalized
    }

    await shell.openExternal(targetUrl)

    const records = []
    for (const step of normalized.steps) {
      const intended = `${step.action}${step.selector ? ` ${step.selector}` : ''}${step.value ? `=${step.value}` : ''}`
      const performed =
        step.action === 'wait'
          ? `Timed wait for ${step.waitMs}ms in supervised browser flow.`
          : `Prepared supervised ${step.action} step in browser relay.`

      const gained = step.action === 'extractText' ? ['Web Data Extraction'] : []
      const record = appendExecutionRecord({
        domain: 'web-automation',
        adapterId,
        intendedStep: intended,
        performedStep: performed,
        result: 'queued-supervised',
        newSkills: gained,
        metadata: {
          targetUrl,
          intent: String(input?.intent || ''),
          step,
        },
        simpleLog: `Executed ${step.action} step via ${adapterId} in supervised mode.`,
      })
      records.push(record)
    }

    appendLearningLog({
      title: `Adapter run: ${adapterId}`,
      detail: `Ran ${records.length} allowlisted step(s) against supervised web target.`,
      source: 'automation-adapter',
      newSkills: ['Task-specific UI Automation'],
    })

    return {
      ok: true,
      adapterId,
      targetUrl,
      records,
      templates: learningState.automationTemplates || OBSERVE_LEARN_TEMPLATE_DEFS,
      profiles: learningState.automationProfiles || AUTOMATION_ADAPTER_PROFILE_DEFS,
      executionRecords: learningState.executionRecords || [],
      suggestions: computeCapabilitySuggestions(),
      skills: learningState.skills,
      updatedAt: learningState.updatedAt,
    }
  })

  ipcMain.handle('paxion:automation:observeLearn', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return {
        ok: false,
        reason: 'Admin session required to run observe+learn template.',
      }
    }

    const templateId = String(input?.templateId || '').trim()
    const template = (learningState.automationTemplates || OBSERVE_LEARN_TEMPLATE_DEFS).find(
      (entry) => entry.id === templateId,
    )

    if (!template) {
      return {
        ok: false,
        reason: 'Observe+learn template not found.',
      }
    }

    if (template.appType === 'cms' && capabilityState.webAppAutomation === false) {
      return {
        ok: false,
        reason: 'webAppAutomation capability is required for CMS observe+learn.',
      }
    }

    if ((template.appType === 'code-editor' || template.appType === 'design') && capabilityState.desktopAppAutomation === false) {
      return {
        ok: false,
        reason: 'desktopAppAutomation capability is required for this template.',
      }
    }

    const sourceKnowledge = String(input?.sourceKnowledge || '').trim()
    const sourceTags = sourceKnowledge
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
    const inferred = []

    if (sourceTags.includes('python')) inferred.push('Python Basics')
    if (sourceTags.includes('c')) inferred.push('C Language Syntax')
    if (sourceTags.includes('react')) inferred.push('React UI Development')
    if (sourceTags.includes('design')) inferred.push('Design Operations')

    const learnedSkills = Array.from(new Set([...(template.skillSignals || []), ...inferred]))

    const runRecords = (template.observe || []).map((item) =>
      appendExecutionRecord({
        domain: 'observe-learn',
        templateId: template.id,
        appType: template.appType,
        intendedStep: item,
        performedStep: `Observed workflow pattern: ${item}`,
        result: 'learned',
        newSkills: learnedSkills,
        simpleLog: `Learned workflow pattern in ${template.appType}: ${item}`,
      }),
    )

    appendLearningLog({
      title: `Observe+Learn completed: ${template.name}`,
      detail: `Captured ${runRecords.length} workflow observation(s) and updated skill profile.`,
      source: 'observe-learn',
      newSkills: learnedSkills,
    })

    return {
      ok: true,
      template,
      records: runRecords,
      templates: learningState.automationTemplates || OBSERVE_LEARN_TEMPLATE_DEFS,
      profiles: learningState.automationProfiles || AUTOMATION_ADAPTER_PROFILE_DEFS,
      executionRecords: learningState.executionRecords || [],
      suggestions: computeCapabilitySuggestions(),
      skills: learningState.skills,
      updatedAt: learningState.updatedAt,
    }
  })

  ipcMain.handle('paxion:automation:replayRecord', async (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return {
        ok: false,
        reason: 'Admin session required to replay execution record.',
      }
    }

    if (!Boolean(input?.explicitPermission)) {
      return {
        ok: false,
        reason: 'Explicit permission is required for replay.',
      }
    }

    const recordId = String(input?.recordId || '').trim()
    const records = Array.isArray(learningState.executionRecords) ? learningState.executionRecords : []
    const sourceRecord = records.find((entry) => entry.id === recordId)
    if (!sourceRecord) {
      return {
        ok: false,
        reason: 'Execution record not found.',
      }
    }

    const targetUrl = sourceRecord?.metadata?.targetUrl
    if (typeof targetUrl === 'string' && /^https?:\/\//i.test(targetUrl)) {
      await shell.openExternal(targetUrl)
    }

    const replayRecord = appendExecutionRecord({
      domain: sourceRecord.domain,
      adapterId: sourceRecord.adapterId,
      templateId: sourceRecord.templateId,
      appType: sourceRecord.appType,
      intendedStep: sourceRecord.intendedStep,
      performedStep: `Replay executed from record ${sourceRecord.id}.`,
      result: 'replayed',
      newSkills: [],
      metadata: {
        sourceRecordId: sourceRecord.id,
        targetUrl: typeof targetUrl === 'string' ? targetUrl : undefined,
      },
      simpleLog: `Replayed execution record ${sourceRecord.id} in supervised mode.`,
    })

    return {
      ok: true,
      replayRecord,
      executionRecords: learningState.executionRecords || [],
      suggestions: computeCapabilitySuggestions(),
      updatedAt: learningState.updatedAt,
    }
  })

  ipcMain.handle('paxion:automation:suggestions', () => {
    if (!isAdminUnlocked(adminSession)) {
      return {
        ok: false,
        reason: 'Admin session required to load suggestions.',
        suggestions: [],
      }
    }

    return {
      ok: true,
      suggestions: computeCapabilitySuggestions(),
    }
  })

  ipcMain.handle('paxion:learning:youtubePlanCreate', (_event, input) => {
    if (capabilityState.videoLearning === false) {
      return {
        ok: false,
        reason: 'Video learning capability is disabled in Access tab.',
      }
    }

    if (!isAdminUnlocked(adminSession)) {
      return {
        ok: false,
        reason: 'Admin session required for YouTube learning plans.',
      }
    }

    const explicitPermission = Boolean(input?.explicitPermission)
    if (!explicitPermission) {
      return {
        ok: false,
        reason: 'Explicit permission checkbox is required for YouTube learning.',
      }
    }

    const created = createYoutubeSegmentPlan(input)
    if (!created.ok) {
      return created
    }

    const videoPlans = Array.isArray(learningState.videoPlans) ? learningState.videoPlans : []
    learningState = {
      ...learningState,
      videoPlans: [...videoPlans, created.plan].slice(-80),
      updatedAt: new Date().toISOString(),
    }
    saveLearningState()

    appendLearningLog({
      title: `YouTube learning plan created: ${created.plan.topic}`,
      detail: `Created ${created.plan.segments.length} segment(s) at ${created.plan.segmentMinutes}-minute windows.`,
      source: 'youtube-plan',
      newSkills: ['Video Learning Workflow'],
    })

    return {
      ok: true,
      plan: created.plan,
      videoPlans: learningState.videoPlans,
    }
  })

  ipcMain.handle('paxion:learning:youtubeSegmentOpen', async (_event, input) => {
    if (capabilityState.videoLearning === false) {
      return {
        ok: false,
        reason: 'Video learning capability is disabled in Access tab.',
      }
    }

    if (!isAdminUnlocked(adminSession)) {
      return {
        ok: false,
        reason: 'Admin session required for opening video segments.',
      }
    }

    const planId = String(input?.planId || '')
    const segmentId = String(input?.segmentId || '')
    const plans = Array.isArray(learningState.videoPlans) ? learningState.videoPlans : []
    const plan = plans.find((p) => p.id === planId)
    if (!plan) {
      return {
        ok: false,
        reason: 'Video plan not found.',
      }
    }

    const segment = Array.isArray(plan.segments) ? plan.segments.find((s) => s.id === segmentId) : null
    if (!segment) {
      return {
        ok: false,
        reason: 'Video segment not found.',
      }
    }

    const url = buildYoutubeSegmentUrl(plan.videoUrl, Number(segment.startMinute || 0))
    await shell.openExternal(url)

    segment.status = 'opened'
    learningState.updatedAt = new Date().toISOString()
    saveLearningState()

    appendLearningLog({
      title: `Video segment opened: ${plan.topic}`,
      detail: `Opened segment ${segment.label} in browser for guided learning.`,
      source: 'youtube-segment-open',
      newSkills: [],
    })

    return {
      ok: true,
      url,
      videoPlans: learningState.videoPlans,
    }
  })

  ipcMain.handle('paxion:learning:youtubeSegmentComplete', (_event, input) => {
    const planId = String(input?.planId || '')
    const segmentId = String(input?.segmentId || '')
    const summary = String(input?.summary || '').trim()
    const newSkills = Array.isArray(input?.newSkills)
      ? input.newSkills.filter((x) => typeof x === 'string' && x.trim())
      : []

    const plans = Array.isArray(learningState.videoPlans) ? learningState.videoPlans : []
    const plan = plans.find((p) => p.id === planId)
    if (!plan) {
      return {
        ok: false,
        reason: 'Video plan not found.',
      }
    }

    const segment = Array.isArray(plan.segments) ? plan.segments.find((s) => s.id === segmentId) : null
    if (!segment) {
      return {
        ok: false,
        reason: 'Video segment not found.',
      }
    }

    segment.status = 'learned'
    segment.notes = summary
    learningState.updatedAt = new Date().toISOString()
    saveLearningState()

    appendLearningLog({
      title: `Video learning complete: ${plan.topic} (${segment.label})`,
      detail: summary || 'Completed segment review and stored learned notes.',
      source: 'youtube-segment-complete',
      newSkills,
    })

    return {
      ok: true,
      videoPlans: learningState.videoPlans,
      skills: learningState.skills,
      updatedAt: learningState.updatedAt,
    }
  })

  ipcMain.handle('paxion:integrations:googleSearch', async (_event, input) => {
    if (capabilityState.libraryIngestWeb === false) {
      return {
        ok: false,
        reason: 'Web ingest capability is disabled in Access tab.',
      }
    }

    if (!isAdminUnlocked(adminSession)) {
      return {
        ok: false,
        reason: 'Admin session required for desktop web search relay.',
      }
    }

    const query = String(input?.query || '').trim()
    if (!query) {
      return {
        ok: false,
        reason: 'Search query is required.',
      }
    }

    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`
    await shell.openExternal(url)

    appendAuditEntry('action_result', {
      actionId: 'integrations.googleSearch',
      status: 'allowed',
      reason: `Desktop Google search opened for query: ${query}`,
      mode: 'desktop-relay',
    })

    return {
      ok: true,
      opened: true,
      url,
      reason: 'Opened Google search in your desktop browser. Review results manually.',
    }
  })

  ipcMain.handle('paxion:integrations:gptChat', async (_event, input) => {
    if (capabilityState.chatExternalModel === false) {
      return {
        ok: false,
        reason: 'External chat model capability is disabled in Access tab.',
        reply: '',
      }
    }

    const query = String(input?.query || '').trim()
    if (!query) {
      return {
        ok: false,
        reason: 'Chat query is required.',
      }
    }

    if (!isAdminUnlocked(adminSession)) {
      return {
        ok: false,
        reason: 'Admin session required for desktop ChatGPT relay.',
      }
    }

    const url = 'https://chatgpt.com/'
    await shell.openExternal(url)

    appendAuditEntry('action_result', {
      actionId: 'integrations.gptChat',
      status: 'allowed',
      reason: 'Desktop ChatGPT opened for manual query relay.',
      mode: 'desktop-relay',
      promptPreview: query.slice(0, 180),
    })

    return {
      ok: true,
      opened: true,
      url,
      reason: 'Opened ChatGPT in your desktop browser. Submit the prompt manually and paste the response back.',
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

  ipcMain.handle('paxion:library:load', () => {
    try {
      if (!fs.existsSync(libraryStateFilePath)) {
        return {
          ok: true,
          docs: [],
          updatedAt: null,
        }
      }

      const raw = fs.readFileSync(libraryStateFilePath, 'utf8')
      const parsed = JSON.parse(raw)
      const docs = Array.isArray(parsed?.docs) ? parsed.docs.map(normalizeLibraryDoc).filter(Boolean) : []

      return {
        ok: true,
        docs,
        updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : null,
      }
    } catch (err) {
      return {
        ok: false,
        reason: `Failed to load library state: ${err.message}`,
        docs: [],
        updatedAt: null,
      }
    }
  })

  ipcMain.handle('paxion:library:save', (_event, input) => {
    try {
      const docs = Array.isArray(input?.docs)
        ? input.docs.map(normalizeLibraryDoc).filter(Boolean)
        : []
      const state = {
        docs,
        updatedAt: new Date().toISOString(),
      }

      fs.writeFileSync(libraryStateFilePath, JSON.stringify(state, null, 2), 'utf8')
      return {
        ok: true,
        updatedAt: state.updatedAt,
      }
    } catch (err) {
      return {
        ok: false,
        reason: `Failed to save library state: ${err.message}`,
      }
    }
  })

  ipcMain.handle('paxion:library:clear', () => {
    try {
      if (fs.existsSync(libraryStateFilePath)) {
        fs.unlinkSync(libraryStateFilePath)
      }
      return {
        ok: true,
      }
    } catch (err) {
      return {
        ok: false,
        reason: `Failed to clear library state: ${err.message}`,
      }
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
