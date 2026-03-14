'use strict'

const { ipcMain, dialog, app, shell, desktopCapturer } = require('electron')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const pdfParse = require('pdf-parse')
const Tesseract = require('tesseract.js')
const {
  buildCrossAppMission,
  buildLearningGraphSnapshot,
  buildReplayPreviewPayload,
  createHashChainEntry,
  getExecutionSequence,
  getExecutionSessionId,
  queryLearningGraphSnapshot,
  rankCapabilitySuggestions,
  resolveTemplateVariables,
  selectVersionedPackProfile,
} = require('./readiness-utils.cjs')
const { evaluateCompliance, buildPolicySnapshotHash } = require('./compliance-engine.cjs')
const { upsertDevice, revokeDevice } = require('./device-control-plane.cjs')
const { evolveSkills, generateHypotheses } = require('./learning-engine-v2.cjs')
const { runBacktest, placePaperOrder } = require('./trading-engine.cjs')
const { evaluateMedicationSafety, evaluateMedicalAdviceConfidence } = require('./medical-safety.cjs')
const { enqueueMediaJob } = require('./media-generation.cjs')

const ADMIN_CODEWORD = 'paro the chief'
const ADMIN_SESSION_TTL_MS = 15 * 60 * 1000
const APPROVAL_TTL_MS = 5 * 60 * 1000
const REPLAY_PREVIEW_TTL_MS = 5 * 60 * 1000

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

const OCR_LANGUAGE_ALLOWLIST = new Set(['eng'])
const NATIVE_ACTION_ALLOWLIST = new Set(['click', 'fill', 'select', 'extractText', 'command'])
const GRAPH_QUERY_MAX_LIMIT = 200
const GOVERNANCE_MIN_TESTS_FOR_REVIEW = 3
const GOVERNANCE_MIN_TESTS_FOR_DEPLOY = 5

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
    targetUrl: 'https://{{wordpressHost}}/wp-admin/post.php?post={{postId}}&action=edit',
    intent: 'Update WordPress post {{postId}} on {{wordpressHost}}, then trigger save.',
    stepTemplate: [
      'fill|#title|{{postTitle}}',
      'fill|#content|{{postContent}}',
      'click|#publish',
      'wait||1500',
    ],
    gainedSkills: ['CMS Content Editing', 'Publishing Workflow'],
    variableHints: ['wordpressHost', 'postId', 'postTitle', 'postContent'],
  },
  {
    id: 'profile.figma-export-flow',
    name: 'Figma Export Flow',
    appType: 'design',
    adapterId: 'browser.clickFlow.basic',
    targetUrl: 'https://www.figma.com/file/{{fileKey}}/{{fileName}}',
    intent: 'Open Figma file {{fileName}} and run export checklist in supervised mode.',
    stepTemplate: [
      'click|[data-testid="recent-file"]',
      'click|[data-testid="export-button"]',
      'wait||1000',
      'extractText|[data-testid="export-status"]',
    ],
    gainedSkills: ['Design Operations', 'Asset Export Workflow'],
    variableHints: ['fileKey', 'fileName'],
  },
  {
    id: 'profile.github-pr-review',
    name: 'GitHub PR Review Prep',
    appType: 'code-editor',
    adapterId: 'browser.clickFlow.basic',
    targetUrl: 'https://github.com/{{repoOwner}}/{{repoName}}/pull/{{pullNumber}}',
    intent: 'Open PR {{pullNumber}} for {{repoOwner}}/{{repoName}} and capture review context.',
    stepTemplate: [
      'click|a[href*="/pull/"]',
      'click|button[aria-label="Files changed"]',
      'wait||1200',
      'extractText|.js-file-content',
    ],
    gainedSkills: ['Code Review Workflow', 'Project Navigation'],
    variableHints: ['repoOwner', 'repoName', 'pullNumber'],
  },
]

const TARGET_WORKFLOW_PACK_DEFS = [
  {
    id: 'pack.wordpress.release',
    name: 'WordPress Editorial Release',
    surface: 'browser',
    appType: 'cms',
    requiredCapability: 'webAppAutomation',
    targetUrl: 'https://{{wordpressHost}}/wp-admin/post.php?post={{postId}}&action=edit',
    intent: 'Update post {{postId}}, verify title/content, and publish safely.',
    executionSteps: [
      'Open WordPress editor for the approved post.',
      'Apply approved title and body changes.',
      'Run preview check before publish.',
      'Publish or update post after verification.',
    ],
    verificationChecks: [
      'Title field matches approved title.',
      'Content body contains approved update block.',
      'Post status reflects expected publish state.',
    ],
    rollbackSteps: [
      'Restore previous title from mission backup.',
      'Restore previous content revision if publish verification fails.',
      'Return post status to draft if rollback is needed.',
    ],
    variableHints: ['wordpressHost', 'postId', 'postTitle', 'postContent'],
    compatibilityProfiles: [
      {
        appKey: 'wordpress',
        constraints: ['>=6.6'],
        selectors: {
          title: '#post-title-0, #title',
          content: '.block-editor-rich-text__editable, #content',
          publish: 'button.editor-post-publish-button__button, #publish',
        },
        fallbackSelectors: ['#title', '#content', '#publish'],
      },
      {
        appKey: 'wordpress',
        constraints: ['<6.6'],
        selectors: {
          title: '#title',
          content: '#content',
          publish: '#publish',
        },
        fallbackSelectors: ['#title', '#content', '#publish'],
      },
    ],
  },
  {
    id: 'pack.github.review',
    name: 'GitHub PR Review Loop',
    surface: 'browser',
    appType: 'code-review',
    requiredCapability: 'webAppAutomation',
    targetUrl: 'https://github.com/{{repoOwner}}/{{repoName}}/pull/{{pullNumber}}',
    intent: 'Review PR {{pullNumber}}, inspect diff, and capture verification notes.',
    executionSteps: [
      'Open pull request overview.',
      'Inspect files changed and extract key risk areas.',
      'Capture review notes and verification summary.',
    ],
    verificationChecks: [
      'Pull request number matches requested target.',
      'Files changed view opened successfully.',
      'Review summary references concrete changed files or risks.',
    ],
    rollbackSteps: ['Close review draft and clear temporary notes if review target is wrong.'],
    variableHints: ['repoOwner', 'repoName', 'pullNumber'],
    compatibilityProfiles: [
      {
        appKey: 'github',
        constraints: ['>=1.0'],
        selectors: {
          filesChangedTab: 'button[aria-label="Files changed"], a[href$="/files"]',
          diffContent: '.js-file-content, .diff-table',
        },
        fallbackSelectors: ['a[href$="/files"]', '.diff-table'],
      },
    ],
  },
  {
    id: 'pack.figma.export',
    name: 'Figma Export Verification',
    surface: 'design',
    appType: 'design',
    requiredCapability: 'desktopAppAutomation',
    targetUrl: 'https://www.figma.com/file/{{fileKey}}/{{fileName}}',
    intent: 'Open design file {{fileName}} and verify export readiness.',
    executionSteps: [
      'Open target design file.',
      'Check export settings and naming discipline.',
      'Prepare export manifest for approved assets.',
    ],
    verificationChecks: [
      'Export settings panel is reachable.',
      'Target frame/component names match approved asset names.',
      'Export manifest includes requested format list.',
    ],
    rollbackSteps: ['Revert export preset changes and clear generated asset manifest if verification fails.'],
    variableHints: ['fileKey', 'fileName'],
    compatibilityProfiles: [
      {
        appKey: 'figma',
        constraints: ['>=124'],
        selectors: {
          exportButton: '[data-testid="export-button"], [aria-label="Export"]',
          status: '[data-testid="export-status"], .export-panel',
        },
        fallbackSelectors: ['[aria-label="Export"]'],
      },
    ],
  },
  {
    id: 'pack.vscode.refactor',
    name: 'VS Code Refactor Cycle',
    surface: 'editor',
    appType: 'code-editor',
    requiredCapability: 'vscodeControl',
    targetUrl: '',
    intent: 'Run an approved VS Code refactor cycle for {{workspaceArea}}.',
    executionSteps: [
      'Open target workspace area.',
      'Apply approved edit/refactor checklist.',
      'Run verification command set and capture outcome.',
    ],
    verificationChecks: [
      'Correct workspace area is selected.',
      'Lint/build/test outputs are captured after edits.',
      'Rollback patch is available if verification fails.',
    ],
    rollbackSteps: ['Apply rollback patch or revert edited files from mission artifact if verification fails.'],
    variableHints: ['workspaceArea'],
    compatibilityProfiles: [
      {
        appKey: 'vscode',
        constraints: ['>=1.100'],
        selectors: {
          explorer: 'workbench.view.explorer',
          scm: 'workbench.view.scm',
          terminal: 'workbench.action.terminal.toggleTerminal',
        },
        fallbackSelectors: ['workbench.view.explorer', 'workbench.action.terminal.toggleTerminal'],
      },
    ],
  },
]

const SKILL_CAPABILITY_SUGGESTION_RULES = [
  {
    capability: 'workspaceTooling',
    anySkills: ['Workspace Automation', 'Debugging Workflow', 'Project Navigation'],
    reason: 'Frequent workflow/build patterns indicate tooling automation readiness.',
    prerequisites: ['workspaceExecution'],
  },
  {
    capability: 'webAppAutomation',
    anySkills: ['CMS Content Editing', 'Web Research', 'Form Operations'],
    reason: 'Web operation patterns suggest supervised web automation can be expanded.',
    prerequisites: ['workspaceExecution'],
  },
  {
    capability: 'desktopAppAutomation',
    anySkills: ['Design Operations', 'Code Editing Workflow', 'UI Composition'],
    reason: 'Desktop workflow skill signals indicate app automation potential.',
    prerequisites: ['workspaceExecution'],
  },
  {
    capability: 'mediaGeneration',
    anySkills: ['Media Generation Workflow', 'Asset Export Workflow'],
    reason: 'Media-oriented skills suggest enabling media generation adapters.',
    prerequisites: ['workspaceExecution'],
  },
  {
    capability: 'vscodeControl',
    anySkills: ['Code Editing Workflow', 'TypeScript Engineering', 'Project Navigation'],
    reason: 'IDE-centric skills suggest VS Code command bridge usage.',
    prerequisites: ['workspaceExecution'],
  },
  {
    capability: 'selfEvolution',
    anySkills: ['Task-specific UI Automation', 'Security Policy Design', 'Debugging Workflow'],
    reason: 'Mature automation and policy skills suggest controlled self-evolution phase.',
    prerequisites: ['workspaceTooling', 'vscodeControl'],
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

  const complianceDecision = evaluateCompliance({
    actionId: request.actionId,
    category: request.category,
    detail: request.detail,
    jurisdiction: request.jurisdiction,
  })
  if (!complianceDecision.allowed) {
    return {
      allowed: false,
      requiresApproval: false,
      ruleId: complianceDecision.ruleId,
      reason: complianceDecision.reason,
      compliance: complianceDecision,
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
      ruleId: complianceDecision.requiresReview ? 'jurisdiction-sensitive-action-gate' : 'sensitive-action-gate',
      reason: complianceDecision.requiresReview
        ? complianceDecision.reason
        : 'Sensitive action requires explicit admin verification and approval.',
      compliance: complianceDecision,
    }
  }

  return {
    allowed: true,
    requiresApproval: false,
    ruleId: 'standard-allow',
    reason: 'Action is allowed under current baseline policy.',
    compliance: complianceDecision,
  }
}

function finalizePolicyDecision(baseDecision, context) {
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

function sha256File(filePath) {
  const buffer = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(buffer).digest('hex')
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
  const attestationStateFilePath = path.join(app.getPath('userData'), 'paxion-attestation-state.json')
  const attestationChainFilePath = path.join(app.getPath('userData'), 'paxion-attestation-chain.jsonl')
  const deviceStateFilePath = path.join(app.getPath('userData'), 'paxion-devices.json')
  const learningV2StateFilePath = path.join(app.getPath('userData'), 'paxion-learning-v2.json')
  const tradingStateFilePath = path.join(app.getPath('userData'), 'paxion-trading.json')
  const medicalStateFilePath = path.join(app.getPath('userData'), 'paxion-medical.json')
  const mediaStateFilePath = path.join(app.getPath('userData'), 'paxion-media.json')
  const adminSession = buildAdminSessionState()
  const approvalTickets = new Map()
  const replayPreviewApprovals = new Map()
  let capabilityState = { ...DEFAULT_CAPABILITIES }
  let learningState = {
    skills: [],
    logs: [],
    videoPlans: [],
    automationTemplates: OBSERVE_LEARN_TEMPLATE_DEFS,
    automationProfiles: AUTOMATION_ADAPTER_PROFILE_DEFS,
    automationProfilePresets: [],
    executionSessions: [],
    observationSnapshots: [],
    crossAppMissions: [],
    evolutionPipelines: [],
    visionJobs: [],
    executionRecords: [],
    updatedAt: null,
  }
  const auditState = {
    lastHash: 'GENESIS',
    lastIndex: 0,
  }
  const attestationState = {
    privateKeyPem: '',
    publicKeyPem: '',
    publicKeyFingerprint: '',
    lastEntryHash: 'GENESIS',
    loaded: false,
  }
  let deviceState = {
    devices: [],
    updatedAt: null,
  }
  let learningV2State = {
    skills: [],
    confidence: {},
    hypotheses: [],
    updatedAt: null,
  }
  let tradingState = {
    backtests: [],
    paperOrders: [],
    updatedAt: null,
  }
  let medicalState = {
    safetyReviews: [],
    confidenceReviews: [],
    updatedAt: null,
  }
  let mediaState = {
    jobs: [],
    updatedAt: null,
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
        automationProfilePresets: [],
        executionSessions: [],
        observationSnapshots: [],
        crossAppMissions: [],
        evolutionPipelines: [],
        visionJobs: [],
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
        automationProfilePresets:
          Array.isArray(parsed?.automationProfilePresets)
            ? parsed.automationProfilePresets.filter((x) => x && typeof x === 'object')
            : [],
        executionSessions:
          Array.isArray(parsed?.executionSessions)
            ? parsed.executionSessions.filter((x) => x && typeof x === 'object')
            : [],
        observationSnapshots:
          Array.isArray(parsed?.observationSnapshots)
            ? parsed.observationSnapshots.filter((x) => x && typeof x === 'object')
            : [],
        crossAppMissions:
          Array.isArray(parsed?.crossAppMissions)
            ? parsed.crossAppMissions.filter((x) => x && typeof x === 'object')
            : [],
        evolutionPipelines:
          Array.isArray(parsed?.evolutionPipelines)
            ? parsed.evolutionPipelines.filter((x) => x && typeof x === 'object')
            : [],
        visionJobs:
          Array.isArray(parsed?.visionJobs)
            ? parsed.visionJobs.filter((x) => x && typeof x === 'object')
            : [],
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
        automationProfilePresets: [],
        executionSessions: [],
        observationSnapshots: [],
        crossAppMissions: [],
        evolutionPipelines: [],
        visionJobs: [],
        executionRecords: [],
        updatedAt: null,
      }
    }
  }

  function loadJsonState(filePath, fallback) {
    if (!fs.existsSync(filePath)) {
      return { ...fallback }
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      return {
        ...fallback,
        ...(parsed && typeof parsed === 'object' ? parsed : {}),
      }
    } catch {
      return { ...fallback }
    }
  }

  function saveJsonState(filePath, value) {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8')
  }

  function loadDomainStates() {
    deviceState = loadJsonState(deviceStateFilePath, { devices: [], updatedAt: null })
    learningV2State = loadJsonState(learningV2StateFilePath, {
      skills: [],
      confidence: {},
      hypotheses: [],
      updatedAt: null,
    })
    tradingState = loadJsonState(tradingStateFilePath, {
      backtests: [],
      paperOrders: [],
      updatedAt: null,
    })
    medicalState = loadJsonState(medicalStateFilePath, {
      safetyReviews: [],
      confidenceReviews: [],
      updatedAt: null,
    })
    mediaState = loadJsonState(mediaStateFilePath, {
      jobs: [],
      updatedAt: null,
    })
  }

  function saveDomainStates() {
    saveJsonState(deviceStateFilePath, deviceState)
    saveJsonState(learningV2StateFilePath, learningV2State)
    saveJsonState(tradingStateFilePath, tradingState)
    saveJsonState(medicalStateFilePath, medicalState)
    saveJsonState(mediaStateFilePath, mediaState)
  }

  function workspaceRootPath() {
    return path.join(app.getPath('userData'), 'paxion-workspace')
  }

  function ensureAttestationState() {
    if (attestationState.loaded) {
      return
    }

    if (fs.existsSync(attestationStateFilePath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(attestationStateFilePath, 'utf8'))
        attestationState.privateKeyPem = String(parsed?.privateKeyPem || '')
        attestationState.publicKeyPem = String(parsed?.publicKeyPem || '')
        attestationState.publicKeyFingerprint = String(parsed?.publicKeyFingerprint || '')
        attestationState.lastEntryHash = String(parsed?.lastEntryHash || 'GENESIS')
      } catch {
        // Regenerate below if file is unreadable.
      }
    }

    if (!attestationState.privateKeyPem || !attestationState.publicKeyPem) {
      const keyPair = crypto.generateKeyPairSync('ed25519')
      attestationState.privateKeyPem = keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
      attestationState.publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString()
      attestationState.publicKeyFingerprint = sha256Hex(attestationState.publicKeyPem)
      attestationState.lastEntryHash = 'GENESIS'
      fs.writeFileSync(
        attestationStateFilePath,
        JSON.stringify(
          {
            privateKeyPem: attestationState.privateKeyPem,
            publicKeyPem: attestationState.publicKeyPem,
            publicKeyFingerprint: attestationState.publicKeyFingerprint,
            lastEntryHash: attestationState.lastEntryHash,
            createdAt: new Date().toISOString(),
          },
          null,
          2,
        ),
        'utf8',
      )
    }

    if (!attestationState.publicKeyFingerprint) {
      attestationState.publicKeyFingerprint = sha256Hex(attestationState.publicKeyPem)
    }

    if (fs.existsSync(attestationChainFilePath)) {
      try {
        const rows = fs
          .readFileSync(attestationChainFilePath, 'utf8')
          .split('\n')
          .filter(Boolean)
        if (rows.length > 0) {
          const last = JSON.parse(rows[rows.length - 1])
          if (typeof last?.entryHash === 'string' && last.entryHash) {
            attestationState.lastEntryHash = last.entryHash
          }
        }
      } catch {
        // Keep previous known hash if chain file has unreadable lines.
      }
    }

    attestationState.loaded = true
  }

  function appendAttestationRecord(input) {
    ensureAttestationState()
    const payload = {
      payloadHash: String(input?.payloadHash || ''),
      scope: String(input?.scope || 'session-step'),
      sessionId: String(input?.sessionId || ''),
      stepId: String(input?.stepId || ''),
      metadata: input?.metadata && typeof input.metadata === 'object' ? input.metadata : {},
    }
    const baseEntry = createHashChainEntry(payload, attestationState.lastEntryHash)
    const sign = crypto.createSign('SHA256')
    sign.update(baseEntry.entryHash)
    sign.end()
    const signature = sign.sign(attestationState.privateKeyPem, 'base64')
    const entry = {
      ...baseEntry,
      signer: 'paxion-attestor',
      signature,
      publicKeyFingerprint: attestationState.publicKeyFingerprint,
    }

    fs.appendFileSync(attestationChainFilePath, JSON.stringify(entry) + '\n', 'utf8')
    attestationState.lastEntryHash = entry.entryHash
    fs.writeFileSync(
      attestationStateFilePath,
      JSON.stringify(
        {
          privateKeyPem: attestationState.privateKeyPem,
          publicKeyPem: attestationState.publicKeyPem,
          publicKeyFingerprint: attestationState.publicKeyFingerprint,
          lastEntryHash: attestationState.lastEntryHash,
          updatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      'utf8',
    )
    return entry
  }

  function attestationPublicStatus() {
    ensureAttestationState()
    return {
      publicKeyFingerprint: attestationState.publicKeyFingerprint,
      lastEntryHash: attestationState.lastEntryHash,
      hasChain: fs.existsSync(attestationChainFilePath),
    }
  }

  function rotateAttestationKey(input) {
    ensureAttestationState()
    const keyPair = crypto.generateKeyPairSync('ed25519')
    const previousFingerprint = attestationState.publicKeyFingerprint
    attestationState.privateKeyPem = keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    attestationState.publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString()
    attestationState.publicKeyFingerprint = sha256Hex(attestationState.publicKeyPem)
    attestationState.loaded = true

    const rotationAnchor = createHashChainEntry(
      {
        scope: 'attestation-key-rotation',
        reason: String(input?.reason || 'manual-rotation'),
        previousFingerprint,
        nextFingerprint: attestationState.publicKeyFingerprint,
      },
      attestationState.lastEntryHash,
    )
    attestationState.lastEntryHash = rotationAnchor.entryHash
    fs.appendFileSync(
      attestationChainFilePath,
      JSON.stringify({
        ...rotationAnchor,
        signer: 'paxion-attestor',
        signature: null,
        publicKeyFingerprint: attestationState.publicKeyFingerprint,
      }) + '\n',
      'utf8',
    )

    fs.writeFileSync(
      attestationStateFilePath,
      JSON.stringify(
        {
          privateKeyPem: attestationState.privateKeyPem,
          publicKeyPem: attestationState.publicKeyPem,
          publicKeyFingerprint: attestationState.publicKeyFingerprint,
          lastEntryHash: attestationState.lastEntryHash,
          updatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      'utf8',
    )

    return {
      previousFingerprint,
      currentFingerprint: attestationState.publicKeyFingerprint,
      lastEntryHash: attestationState.lastEntryHash,
    }
  }

  async function autoExtractDomSnapshotFromSession(session) {
    const targetUrl = String(session?.targetUrl || '').trim()
    if (!/^https?:\/\//i.test(targetUrl)) {
      return ''
    }
    try {
      const response = await fetch(targetUrl, { method: 'GET' })
      if (!response.ok) {
        return ''
      }
      const html = await response.text()
      return String(html)
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 12000)
    } catch {
      return ''
    }
  }

  async function captureDesktopScreenshot(sessionId, stepId) {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 },
      })
      const source = sources && sources.length > 0 ? sources[0] : null
      if (!source || source.thumbnail.isEmpty()) {
        return ''
      }

      const dir = path.join(workspaceRootPath(), 'evidence-auto', sanitizeRelativePath(sessionId || 'session'))
      fs.mkdirSync(dir, { recursive: true })
      const filename = `screen-${slugifyName(stepId || 'step', 'step')}-${Date.now()}.png`
      const screenshotPath = path.join(dir, filename)
      fs.writeFileSync(screenshotPath, source.thumbnail.toPNG())
      return screenshotPath
    } catch {
      return ''
    }
  }

  async function captureSessionStepEvidence(input) {
    const sessionId = String(input?.sessionId || '').trim()
    if (!sessionId) {
      return { ok: false, reason: 'Session ID is required for step evidence capture.' }
    }

    const stepId = String(input?.stepId || 'step').trim() || 'step'
    const sessions = Array.isArray(learningState.executionSessions) ? learningState.executionSessions : []
    const session = sessions.find((entry) => entry.id === sessionId)
    if (!session) {
      return { ok: false, reason: 'Execution session not found for step evidence capture.' }
    }

    const autoScreenshot = input?.autoScreenshot !== false
    const now = new Date().toISOString()
    const sessionDir = path.join(workspaceRootPath(), 'evidence-auto', sanitizeRelativePath(sessionId))
    fs.mkdirSync(sessionDir, { recursive: true })

    const suppliedDomSnapshot = String(input?.domSnapshot || '').trim()
    const domSnapshot = suppliedDomSnapshot || (await autoExtractDomSnapshotFromSession(session))
    const commandOutput = String(input?.commandOutput || '').trim()
    const stateSnapshot = {
      capturedAt: now,
      reason: String(input?.reason || 'step-evidence'),
      status: session.status,
      targetUrl: session.targetUrl,
      stepId,
      metadata: input?.metadata && typeof input.metadata === 'object' ? input.metadata : {},
    }
    const statePath = path.join(sessionDir, `state-${slugifyName(stepId, 'step')}-${Date.now()}.json`)
    fs.writeFileSync(statePath, JSON.stringify(stateSnapshot, null, 2), 'utf8')

    let domPath = ''
    if (domSnapshot) {
      domPath = path.join(sessionDir, `dom-${slugifyName(stepId, 'step')}-${Date.now()}.txt`)
      fs.writeFileSync(domPath, domSnapshot, 'utf8')
    }

    let commandPath = ''
    if (commandOutput) {
      commandPath = path.join(sessionDir, `command-${slugifyName(stepId, 'step')}-${Date.now()}.log`)
      fs.writeFileSync(commandPath, commandOutput, 'utf8')
    }

    const screenshotPath = String(input?.screenshotPath || '').trim() || (autoScreenshot ? await captureDesktopScreenshot(sessionId, stepId) : '')
    const screenshotHash = screenshotPath && fs.existsSync(screenshotPath) ? sha256File(screenshotPath) : null

    const evidenceRefs = [statePath, domPath, commandPath, screenshotPath].filter(Boolean)
    const evidencePayload = {
      sessionId,
      stepId,
      capturedAt: now,
      reason: String(input?.reason || 'step-evidence'),
      evidenceRefs,
      screenshotHash,
      metadata: input?.metadata && typeof input.metadata === 'object' ? input.metadata : {},
    }
    const payloadHash = sha256Hex(stableStringify(evidencePayload))
    const attestation = appendAttestationRecord({
      payloadHash,
      scope: 'session-step',
      sessionId,
      stepId,
      metadata: evidencePayload.metadata,
    })

    const updatedSession = updateExecutionSession(sessionId, (current) => {
      const stepStates = Array.isArray(current.stepStates) ? current.stepStates : []
      const nextStepStates = stepStates.map((step) => {
        if (step.id !== stepId) {
          return step
        }
        return {
          ...step,
          status: 'evidence-captured',
          evidenceRefs: [...(Array.isArray(step.evidenceRefs) ? step.evidenceRefs : []), ...evidenceRefs].slice(-40),
          attestationHash: attestation.entryHash,
          updatedAt: now,
        }
      })
      return {
        evidence: [...(Array.isArray(current.evidence) ? current.evidence : []), ...evidenceRefs.map((ref) => `auto:${ref}`)].slice(-80),
        stepStates: nextStepStates,
      }
    })

    return {
      ok: true,
      session: updatedSession,
      evidence: {
        payloadHash,
        evidenceRefs,
        screenshotHash,
        attestation,
      },
    }
  }

  function cleanupExpiredReplayPreviewApprovals() {
    const now = Date.now()
    for (const [token, approval] of replayPreviewApprovals.entries()) {
      if (!approval || approval.expiresAt < now) {
        replayPreviewApprovals.delete(token)
      }
    }
  }

  function issueReplayPreviewApproval(recordId, sessionId) {
    cleanupExpiredReplayPreviewApprovals()
    const createdAt = Date.now()
    const token = makeId()
    replayPreviewApprovals.set(token, {
      token,
      recordId,
      sessionId: typeof sessionId === 'string' ? sessionId : null,
      createdAt,
      expiresAt: createdAt + REPLAY_PREVIEW_TTL_MS,
    })
    return token
  }

  function consumeReplayPreviewApproval(token, recordId) {
    cleanupExpiredReplayPreviewApprovals()
    const approval = replayPreviewApprovals.get(token)
    if (!approval) {
      return false
    }

    replayPreviewApprovals.delete(token)
    if (approval.recordId !== recordId) {
      return false
    }

    return Date.now() <= approval.expiresAt
  }

  function getExecutionSessionId(record) {
    return typeof record?.metadata?.sessionId === 'string' ? record.metadata.sessionId : null
  }

  function getExecutionSequence(records, sourceRecord) {
    const sessionId = getExecutionSessionId(sourceRecord)
    const sequence = sessionId
      ? records.filter((entry) => getExecutionSessionId(entry) === sessionId)
      : [sourceRecord]

    return [...sequence].sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')))
  }

  function computeCapabilitySuggestions() {
    const skills = Array.isArray(learningState.skills) ? learningState.skills : []
    const lowerSkills = skills.map((s) => s.toLowerCase())

    return SKILL_CAPABILITY_SUGGESTION_RULES.map((rule) => {
      const matchedSkills = rule.anySkills.filter((skill) => lowerSkills.includes(String(skill).toLowerCase()))
      if (capabilityState[rule.capability] === true || matchedSkills.length === 0) {
        return null
      }

      const unmetPrerequisites = Array.isArray(rule.prerequisites)
        ? rule.prerequisites.filter((capability) => capabilityState[capability] !== true)
        : []
      const confidence = Math.max(
        5,
        Math.min(
          100,
          Math.round((matchedSkills.length / rule.anySkills.length) * 75 + (unmetPrerequisites.length === 0 ? 25 : 10)),
        ),
      )

      return {
        capability: rule.capability,
        reason: rule.reason,
        recommendedAction:
          unmetPrerequisites.length === 0
            ? `Ready to enable capability \"${rule.capability}\" from the workspace suggestion panel.`
            : `Enable prerequisite capabilities first: ${unmetPrerequisites.join(', ')}.`,
        confidence,
        matchedSkills,
        unmetPrerequisites,
        readyToEnable: unmetPrerequisites.length === 0,
      }
    })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.readyToEnable !== b.readyToEnable) {
          return a.readyToEnable ? -1 : 1
        }
        return b.confidence - a.confidence
      })
  }

  function buildReplayPreview(sourceRecord) {
    const records = Array.isArray(learningState.executionRecords) ? learningState.executionRecords : []
    const relatedRecords = getExecutionSequence(records, sourceRecord)
    const targetUrl =
      typeof sourceRecord?.metadata?.targetUrl === 'string' ? sourceRecord.metadata.targetUrl : null
    const intent = typeof sourceRecord?.metadata?.intent === 'string' ? sourceRecord.metadata.intent : null
    const sessionId = getExecutionSessionId(sourceRecord)
    const previewToken = issueReplayPreviewApproval(sourceRecord.id, sessionId)

    return {
      previewToken,
      sourceRecord,
      relatedRecords,
      targetUrl,
      intent,
      stepDiffs: relatedRecords.map((record) => ({
        recordId: record.id,
        originalIntendedStep: record.intendedStep,
        replayIntendedStep: record.intendedStep,
        originalPerformedStep: record.performedStep,
        replayPerformedStep: `Replay executed from record ${record.id}.`,
        originalResult: record.result,
        replayResult: 'replayed',
      })),
      expiresAt: Date.now() + REPLAY_PREVIEW_TTL_MS,
    }
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

  function buildLearningGraph() {
    return buildLearningGraphSnapshot({
      skills: learningState.skills,
      logs: learningState.logs,
      executionRecords: learningState.executionRecords,
      observations: learningState.observationSnapshots,
      visionJobs: learningState.visionJobs,
    })
  }

  function appendExecutionSession(input) {
    const ts = new Date().toISOString()
    const executionSteps = Array.isArray(input?.executionSteps) ? input.executionSteps : []
    const stepStates = executionSteps.map((title, index) => ({
      id: `step-${index + 1}`,
      index,
      title: String(title || `Step ${index + 1}`),
      status: 'pending',
      evidenceRefs: [],
      attestationHash: null,
      updatedAt: ts,
    }))
    const session = {
      id: `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: ts,
      updatedAt: ts,
      status: typeof input?.status === 'string' ? input.status : 'prepared',
      packId: typeof input?.packId === 'string' ? input.packId : '',
      packName: typeof input?.packName === 'string' ? input.packName : '',
      surface: typeof input?.surface === 'string' ? input.surface : 'workspace',
      appType: typeof input?.appType === 'string' ? input.appType : 'unknown',
      appKey: typeof input?.appKey === 'string' ? input.appKey : '',
      appVersion: typeof input?.appVersion === 'string' ? input.appVersion : '',
      targetUrl: typeof input?.targetUrl === 'string' ? input.targetUrl : '',
      intent: typeof input?.intent === 'string' ? input.intent : '',
      executionSteps,
      verificationChecks: Array.isArray(input?.verificationChecks) ? input.verificationChecks : [],
      rollbackSteps: Array.isArray(input?.rollbackSteps) ? input.rollbackSteps : [],
      compatibilityProfile: input?.compatibilityProfile && typeof input.compatibilityProfile === 'object' ? input.compatibilityProfile : null,
      variables: input?.variables && typeof input.variables === 'object' ? input.variables : {},
      evidence: Array.isArray(input?.evidence) ? input.evidence : [],
      verificationNotes: typeof input?.verificationNotes === 'string' ? input.verificationNotes : '',
      rollbackNotes: typeof input?.rollbackNotes === 'string' ? input.rollbackNotes : '',
      artifactPath: typeof input?.artifactPath === 'string' ? input.artifactPath : '',
      stepStates,
      rollbackTransactions: [],
      latestAttestationHash: null,
    }

    learningState = {
      ...learningState,
      executionSessions: [...(learningState.executionSessions || []), session].slice(-200),
      updatedAt: session.updatedAt,
    }
    saveLearningState()
    return session
  }

  function updateExecutionSession(sessionId, updater) {
    const sessions = Array.isArray(learningState.executionSessions) ? learningState.executionSessions : []
    let updatedSession = null
    const nextSessions = sessions.map((session) => {
      if (session.id !== sessionId) {
        return session
      }
      updatedSession = {
        ...session,
        ...updater(session),
        updatedAt: new Date().toISOString(),
      }
      return updatedSession
    })

    if (!updatedSession) {
      return null
    }

    learningState = {
      ...learningState,
      executionSessions: nextSessions,
      updatedAt: updatedSession.updatedAt,
    }
    saveLearningState()
    return updatedSession
  }

  function appendObservationSnapshot(input) {
    const snapshot = {
      id: `obs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      title: typeof input?.title === 'string' ? input.title : 'Observation capture',
      appType: typeof input?.appType === 'string' ? input.appType : 'unknown',
      visibleText: typeof input?.visibleText === 'string' ? input.visibleText : '',
      notes: typeof input?.notes === 'string' ? input.notes : '',
      screenshotPath: typeof input?.screenshotPath === 'string' ? input.screenshotPath : '',
      inferredSkills: Array.isArray(input?.inferredSkills) ? input.inferredSkills : [],
    }

    learningState = {
      ...learningState,
      observationSnapshots: [...(learningState.observationSnapshots || []), snapshot].slice(-240),
      updatedAt: snapshot.createdAt,
    }
    saveLearningState()
    return snapshot
  }

  function appendCrossAppMission(input) {
    learningState = {
      ...learningState,
      crossAppMissions: [...(learningState.crossAppMissions || []), input].slice(-120),
      updatedAt: input.createdAt,
    }
    saveLearningState()
    return input
  }

  function appendEvolutionPipeline(input) {
    const pipeline = {
      id: `evo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      title: typeof input?.title === 'string' ? input.title : 'Evolution pipeline',
      objective: typeof input?.objective === 'string' ? input.objective : '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentStage: 'proposal',
      stages: ['proposal', 'scaffold', 'test', 'review', 'deploy'],
      history: [
        {
          stage: 'proposal',
          note: typeof input?.note === 'string' ? input.note : 'Pipeline created.',
          timestamp: new Date().toISOString(),
        },
      ],
      artifactPath: typeof input?.artifactPath === 'string' ? input.artifactPath : '',
      governance: {
        minTestsForReview: GOVERNANCE_MIN_TESTS_FOR_REVIEW,
        minTestsForDeploy: GOVERNANCE_MIN_TESTS_FOR_DEPLOY,
        requiredPolicySignatures: 1,
        signatures: [],
        metrics: {
          testsPassed: 0,
          lintPassed: false,
          buildPassed: false,
        },
      },
    }

    learningState = {
      ...learningState,
      evolutionPipelines: [...(learningState.evolutionPipelines || []), pipeline].slice(-80),
      updatedAt: pipeline.updatedAt,
    }
    saveLearningState()
    return pipeline
  }

  function updateEvolutionPipeline(pipelineId, updater) {
    const pipelines = Array.isArray(learningState.evolutionPipelines) ? learningState.evolutionPipelines : []
    let updated = null
    const nextPipelines = pipelines.map((pipeline) => {
      if (pipeline.id !== pipelineId) {
        return pipeline
      }
      updated = {
        ...pipeline,
        ...updater(pipeline),
        updatedAt: new Date().toISOString(),
      }
      return updated
    })

    if (!updated) {
      return null
    }

    learningState = {
      ...learningState,
      evolutionPipelines: nextPipelines,
      updatedAt: updated.updatedAt,
    }
    saveLearningState()
    return updated
  }

  function updateEvolutionPipelineGovernance(pipelineId, input) {
    return updateEvolutionPipeline(pipelineId, (current) => {
      const governance = current?.governance && typeof current.governance === 'object' ? current.governance : {}
      const signatures = Array.isArray(governance.signatures) ? governance.signatures : []
      const nextSignatures = [...signatures]
      if (typeof input?.signature === 'string' && input.signature.trim()) {
        nextSignatures.push({
          signature: input.signature,
          signer: String(input?.signer || 'admin'),
          signedAt: new Date().toISOString(),
          note: String(input?.note || ''),
        })
      }

      return {
        governance: {
          minTestsForReview: Number(governance.minTestsForReview || GOVERNANCE_MIN_TESTS_FOR_REVIEW),
          minTestsForDeploy: Number(governance.minTestsForDeploy || GOVERNANCE_MIN_TESTS_FOR_DEPLOY),
          requiredPolicySignatures: Number(governance.requiredPolicySignatures || 1),
          signatures: nextSignatures.slice(-12),
          metrics: {
            testsPassed: Number(input?.testsPassed ?? governance?.metrics?.testsPassed ?? 0),
            lintPassed: Boolean(input?.lintPassed ?? governance?.metrics?.lintPassed ?? false),
            buildPassed: Boolean(input?.buildPassed ?? governance?.metrics?.buildPassed ?? false),
          },
        },
      }
    })
  }

  function appendVisionJob(input) {
    const job = {
      id: `vision-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      objective: typeof input?.objective === 'string' ? input.objective : 'Vision/OCR review',
      screenshotPath: typeof input?.screenshotPath === 'string' ? input.screenshotPath : '',
      extractedText: typeof input?.extractedText === 'string' ? input.extractedText : '',
      notes: typeof input?.notes === 'string' ? input.notes : '',
      status: typeof input?.status === 'string' ? input.status : 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      inferredSkills: Array.isArray(input?.inferredSkills) ? input.inferredSkills : [],
    }

    learningState = {
      ...learningState,
      visionJobs: [...(learningState.visionJobs || []), job].slice(-160),
      updatedAt: job.updatedAt,
    }
    saveLearningState()
    return job
  }

  function updateVisionJob(jobId, updater) {
    const jobs = Array.isArray(learningState.visionJobs) ? learningState.visionJobs : []
    let updated = null
    const nextJobs = jobs.map((job) => {
      if (job.id !== jobId) {
        return job
      }
      updated = {
        ...job,
        ...updater(job),
        updatedAt: new Date().toISOString(),
      }
      return updated
    })

    if (!updated) {
      return null
    }

    learningState = {
      ...learningState,
      visionJobs: nextJobs,
      updatedAt: updated.updatedAt,
    }
    saveLearningState()
    return updated
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
  function inferSkills(text) {
    const content = String(text || '')
    const rules = [
      { skill: 'React UI Development', pattern: /react|tsx|component|jsx/i },
      { skill: 'TypeScript Engineering', pattern: /typescript|type|interface|refactor/i },
      { skill: 'Design Operations', pattern: /design|figma|frame|export/i },
      { skill: 'CMS Content Editing', pattern: /wordpress|cms|publish|content/i },
      { skill: 'Project Navigation', pattern: /repo|workspace|file|navigation/i },
      { skill: 'Vision Workflow', pattern: /ocr|vision|screenshot|screen/i },
      { skill: 'Verification Workflow', pattern: /verify|validation|evidence|check/i },
    ]

    return Array.from(new Set(rules.filter((entry) => entry.pattern.test(content)).map((entry) => entry.skill)))
  }

  function normalizeOcrLanguage(input) {
    const lang = String(input || 'eng').trim().toLowerCase()
    return OCR_LANGUAGE_ALLOWLIST.has(lang) ? lang : 'eng'
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
  loadDomainStates()
  ensureAttestationState()

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
        presets: [],
        records: [],
        suggestions: [],
        updatedAt: learningState.updatedAt,
      }
    }

    return {
      ok: true,
      templates: learningState.automationTemplates || OBSERVE_LEARN_TEMPLATE_DEFS,
      profiles: learningState.automationProfiles || AUTOMATION_ADAPTER_PROFILE_DEFS,
      presets: learningState.automationProfilePresets || [],
      records: learningState.executionRecords || [],
      suggestions: computeCapabilitySuggestions(),
      updatedAt: learningState.updatedAt,
    }
  })

  ipcMain.handle('paxion:automation:savePreset', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return {
        ok: false,
        reason: 'Admin session required to save automation preset.',
      }
    }

    const profileId = String(input?.profileId || '').trim()
    const name = String(input?.name || '').trim()
    const profile = (learningState.automationProfiles || AUTOMATION_ADAPTER_PROFILE_DEFS).find(
      (entry) => entry.id === profileId,
    )

    if (!profile) {
      return {
        ok: false,
        reason: 'Automation profile not found for preset save.',
      }
    }

    if (!name) {
      return {
        ok: false,
        reason: 'Preset name is required.',
      }
    }

    const variables =
      input?.variables && typeof input.variables === 'object'
        ? Object.fromEntries(
            Object.entries(input.variables)
              .filter(([key, value]) => typeof key === 'string' && key.trim() && typeof value === 'string')
              .map(([key, value]) => [String(key).trim(), String(value)]),
          )
        : {}

    const existing = Array.isArray(learningState.automationProfilePresets)
      ? learningState.automationProfilePresets
      : []
    const now = new Date().toISOString()
    const normalizedName = name.toLowerCase()
    const existingIndex = existing.findIndex(
      (preset) =>
        String(preset?.profileId || '') === profileId &&
        String(preset?.name || '').trim().toLowerCase() === normalizedName,
    )

    const preset = {
      id: existingIndex >= 0 ? existing[existingIndex].id : `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      profileId,
      name,
      variables,
      updatedAt: now,
    }

    const nextPresets = existing.filter((presetEntry, index) => index !== existingIndex)
    nextPresets.push(preset)

    learningState = {
      ...learningState,
      automationProfilePresets: nextPresets
        .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
        .slice(0, 150),
      updatedAt: now,
    }
    saveLearningState()

    appendLearningLog({
      title: `Automation preset saved: ${name}`,
      detail: `Saved preset for profile ${profile.name}.`,
      source: 'automation-preset',
      newSkills: [],
    })

    return {
      ok: true,
      preset,
      presets: learningState.automationProfilePresets || [],
    }
  })

  ipcMain.handle('paxion:automation:deletePreset', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return {
        ok: false,
        reason: 'Admin session required to delete automation preset.',
      }
    }

    const presetId = String(input?.presetId || '').trim()
    const existing = Array.isArray(learningState.automationProfilePresets)
      ? learningState.automationProfilePresets
      : []
    const nextPresets = existing.filter((preset) => String(preset?.id || '') !== presetId)

    if (nextPresets.length === existing.length) {
      return {
        ok: false,
        reason: 'Automation preset not found.',
      }
    }

    learningState = {
      ...learningState,
      automationProfilePresets: nextPresets,
      updatedAt: new Date().toISOString(),
    }
    saveLearningState()

    return {
      ok: true,
      presets: learningState.automationProfilePresets || [],
    }
  })

  ipcMain.handle('paxion:automation:previewReplay', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return {
        ok: false,
        reason: 'Admin session required to preview replay.',
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

    return {
      ok: true,
      preview: buildReplayPreview(sourceRecord),
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

    const sessionId = `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

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
          sessionId,
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
      presets: learningState.automationProfilePresets || [],
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
    const sessionId = `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

    const runRecords = (template.observe || []).map((item) =>
      appendExecutionRecord({
        domain: 'observe-learn',
        templateId: template.id,
        appType: template.appType,
        intendedStep: item,
        performedStep: `Observed workflow pattern: ${item}`,
        result: 'learned',
        newSkills: learnedSkills,
        metadata: {
          sessionId,
          templateId: template.id,
          appType: template.appType,
        },
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
      presets: learningState.automationProfilePresets || [],
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
    const previewToken = String(input?.previewToken || '').trim()
    const records = Array.isArray(learningState.executionRecords) ? learningState.executionRecords : []
    const sourceRecord = records.find((entry) => entry.id === recordId)
    if (!sourceRecord) {
      return {
        ok: false,
        reason: 'Execution record not found.',
      }
    }

    if (!previewToken || !consumeReplayPreviewApproval(previewToken, recordId)) {
      return {
        ok: false,
        reason: 'Replay preview approval is required or has expired. Preview the replay again.',
      }
    }

    const sourceRecords = getExecutionSequence(records, sourceRecord)

    const targetUrl = sourceRecord?.metadata?.targetUrl
    if (typeof targetUrl === 'string' && /^https?:\/\//i.test(targetUrl)) {
      await shell.openExternal(targetUrl)
    }

    const replaySessionId = `replay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    const replayRecords = sourceRecords.map((record) =>
      appendExecutionRecord({
        domain: record.domain,
        adapterId: record.adapterId,
        templateId: record.templateId,
        appType: record.appType,
        intendedStep: record.intendedStep,
        performedStep: `Replay executed from record ${record.id}.`,
        result: 'replayed',
        newSkills: [],
        metadata: {
          sessionId: replaySessionId,
          sourceRecordId: record.id,
          sourceSessionId: getExecutionSessionId(sourceRecord),
          targetUrl: typeof targetUrl === 'string' ? targetUrl : undefined,
          intent: typeof sourceRecord?.metadata?.intent === 'string' ? sourceRecord.metadata.intent : undefined,
          step: record?.metadata?.step,
        },
        simpleLog: `Replayed execution record ${record.id} in supervised mode.`,
      }),
    )

    const replayRecord = replayRecords.at(-1) || null

    return {
      ok: true,
      replayRecord,
      replayRecords,
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

  ipcMain.handle('paxion:readiness:load', () => {
    if (!isAdminUnlocked(adminSession)) {
      return {
        ok: false,
        reason: 'Admin session required to load readiness systems.',
        targetPacks: TARGET_WORKFLOW_PACK_DEFS,
        executionSessions: [],
        observations: [],
        missions: [],
        learningGraph: { nodes: [], edges: [], updatedAt: null },
        evolutionPipelines: [],
        visionJobs: [],
      }
    }

    return {
      ok: true,
      targetPacks: TARGET_WORKFLOW_PACK_DEFS,
      executionSessions: learningState.executionSessions || [],
      observations: learningState.observationSnapshots || [],
      missions: learningState.crossAppMissions || [],
      learningGraph: buildLearningGraph(),
      evolutionPipelines: learningState.evolutionPipelines || [],
      visionJobs: learningState.visionJobs || [],
    }
  })

  ipcMain.handle('paxion:readiness:runTargetPack', async (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to run target workflow pack.' }
    }

    if (!Boolean(input?.explicitPermission)) {
      return { ok: false, reason: 'Explicit permission is required to run target workflow pack.' }
    }

    const packId = String(input?.packId || '').trim()
    const pack = TARGET_WORKFLOW_PACK_DEFS.find((entry) => entry.id === packId)
    if (!pack) {
      return { ok: false, reason: 'Target workflow pack not found.' }
    }

    if (pack.requiredCapability && capabilityState[pack.requiredCapability] === false) {
      return { ok: false, reason: `Required capability disabled: ${pack.requiredCapability}` }
    }

    const variables =
      input?.variables && typeof input.variables === 'object'
        ? Object.fromEntries(
            Object.entries(input.variables)
              .filter(([key, value]) => typeof key === 'string' && typeof value === 'string')
              .map(([key, value]) => [String(key).trim(), String(value)]),
          )
        : {}
    const appKey = String(input?.appKey || pack.appType || '').trim().toLowerCase()
    const appVersion = String(input?.appVersion || '').trim()
    const compatibilityProfile = selectVersionedPackProfile(pack.compatibilityProfiles, appVersion)
    if (appVersion && Array.isArray(pack.compatibilityProfiles) && pack.compatibilityProfiles.length > 0 && !compatibilityProfile) {
      return {
        ok: false,
        reason: `No compatible ${pack.name} profile for app version ${appVersion}.`,
      }
    }
    const resolvedTargetUrl = resolveTemplateVariables(pack.targetUrl || '', variables)
    const resolvedIntent = resolveTemplateVariables(pack.intent || '', variables)
    const resolvedSteps = (pack.executionSteps || []).map((step) => resolveTemplateVariables(step, variables))
    const resolvedVerification = (pack.verificationChecks || []).map((step) => resolveTemplateVariables(step, variables))
    const resolvedRollback = (pack.rollbackSteps || []).map((step) => resolveTemplateVariables(step, variables))

    const workspaceRoot = workspaceRootPath()
    const artifactPath = path.join(
      workspaceRoot,
      'readiness-sessions',
      `${slugifyName(pack.name, 'pack')}-${Date.now()}.json`,
    )
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true })
    fs.writeFileSync(
      artifactPath,
      JSON.stringify(
        {
          packId: pack.id,
          name: pack.name,
          surface: pack.surface,
          appType: pack.appType,
          targetUrl: resolvedTargetUrl,
          intent: resolvedIntent,
          executionSteps: resolvedSteps,
          verificationChecks: resolvedVerification,
          rollbackSteps: resolvedRollback,
          variables,
          appKey,
          appVersion,
          compatibilityProfile,
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      'utf8',
    )

    if (resolvedTargetUrl && /^https?:\/\//i.test(resolvedTargetUrl)) {
      await shell.openExternal(resolvedTargetUrl)
    }

    const session = appendExecutionSession({
      packId: pack.id,
      packName: pack.name,
      surface: pack.surface,
      appType: pack.appType,
      targetUrl: resolvedTargetUrl,
      intent: resolvedIntent,
      executionSteps: resolvedSteps,
      verificationChecks: resolvedVerification,
      rollbackSteps: resolvedRollback,
      variables,
      artifactPath,
      status: 'prepared',
      appKey,
      appVersion,
      compatibilityProfile,
    })

    for (let index = 0; index < resolvedSteps.length; index += 1) {
      const stepId = `step-${index + 1}`
      await captureSessionStepEvidence({
        sessionId: session.id,
        stepId,
        reason: 'session-prepared',
        metadata: {
          packId: pack.id,
          appKey,
          appVersion,
          compatibilityProfile: compatibilityProfile ? compatibilityProfile.constraints : [],
        },
      })
    }

    appendLearningLog({
      title: `Target workflow prepared: ${pack.name}`,
      detail: `Prepared deterministic workflow pack with verification and rollback checklist.`,
      source: 'target-pack',
      newSkills: pack.appType === 'design' ? ['Design Operations'] : ['Task-specific UI Automation'],
    })

    return {
      ok: true,
      session,
      executionSessions: learningState.executionSessions || [],
      learningGraph: buildLearningGraph(),
    }
  })

  ipcMain.handle('paxion:readiness:verifySession', async (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to verify execution session.' }
    }

    const sessionId = String(input?.sessionId || '').trim()
    const evidence = Array.isArray(input?.evidence)
      ? input.evidence.filter((entry) => typeof entry === 'string' && entry.trim()).map((entry) => entry.trim())
      : []
    const notes = String(input?.notes || '').trim()
    const outcome = String(input?.outcome || 'verified').trim()

    const session = updateExecutionSession(sessionId, (current) => ({
      status: outcome === 'failed' ? 'verification-failed' : 'verified',
      evidence: [...(Array.isArray(current.evidence) ? current.evidence : []), ...evidence].slice(-20),
      verificationNotes: notes || current.verificationNotes || '',
    }))

    if (!session) {
      return { ok: false, reason: 'Execution session not found.' }
    }

    appendLearningLog({
      title: `Session verification: ${session.packName}`,
      detail: notes || `Verification outcome recorded as ${session.status}.`,
      source: 'verification',
      newSkills: outcome === 'verified' ? ['Verification Workflow'] : [],
    })

    await captureSessionStepEvidence({
      sessionId,
      stepId: 'verification',
      reason: 'session-verification',
      domSnapshot: notes,
      metadata: {
        outcome,
      },
    })

    return { ok: true, session, executionSessions: learningState.executionSessions || [], learningGraph: buildLearningGraph() }
  })

  ipcMain.handle('paxion:readiness:rollbackSession', async (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to rollback execution session.' }
    }

    const sessionId = String(input?.sessionId || '').trim()
    const notes = String(input?.notes || '').trim()
    const session = updateExecutionSession(sessionId, (current) => ({
      status: 'rolled-back',
      rollbackNotes: notes || current.rollbackNotes || 'Rollback triggered by admin.',
    }))
    if (!session) {
      return { ok: false, reason: 'Execution session not found.' }
    }

    appendLearningLog({
      title: `Rollback prepared: ${session.packName}`,
      detail: session.rollbackNotes,
      source: 'rollback',
      newSkills: ['Rollback Planning'],
    })

    await captureSessionStepEvidence({
      sessionId,
      stepId: 'rollback',
      reason: 'session-rollback',
      domSnapshot: session.rollbackNotes,
      metadata: {
        rollbackSteps: session.rollbackSteps,
      },
    })

    return { ok: true, session, executionSessions: learningState.executionSessions || [], learningGraph: buildLearningGraph() }
  })

  ipcMain.handle('paxion:readiness:captureStepEvidence', async (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to capture step evidence.' }
    }

    const result = await captureSessionStepEvidence(input)
    if (!result.ok) {
      return result
    }

    return {
      ok: true,
      session: result.session,
      evidence: result.evidence,
      executionSessions: learningState.executionSessions || [],
      learningGraph: buildLearningGraph(),
    }
  })

  ipcMain.handle('paxion:readiness:executeNativeAction', async (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required for native action execution.' }
    }

    if (!Boolean(input?.explicitPermission)) {
      return { ok: false, reason: 'Explicit permission is required for native action execution.' }
    }

    const action = String(input?.action || '').trim()
    if (!NATIVE_ACTION_ALLOWLIST.has(action)) {
      return { ok: false, reason: 'Action type is not allowed by native execution policy.' }
    }

    const sessionId = String(input?.sessionId || '').trim()
    const stepId = String(input?.stepId || '').trim() || 'native-action'
    const selector = String(input?.selector || '').trim()
    const fallbackSelectors = Array.isArray(input?.fallbackSelectors)
      ? input.fallbackSelectors.filter((entry) => typeof entry === 'string' && entry.trim()).map((entry) => entry.trim())
      : []
    const deterministicSelectors = selector ? [selector, ...fallbackSelectors] : fallbackSelectors

    let commandOutput = ''
    if (action === 'command') {
      const command = String(input?.command || '').trim()
      if (!TOOL_COMMAND_ALLOWLIST.has(command)) {
        return { ok: false, reason: 'Command is outside native execution allowlist.' }
      }
      if (capabilityState.workspaceTooling === false) {
        return { ok: false, reason: 'workspaceTooling capability is required for command actions.' }
      }

      const commandResult = await execCommand(command, { cwd: process.cwd() }).catch((errorResult) => errorResult)
      const stdout = String(commandResult?.stdout || '')
      const stderr = String(commandResult?.stderr || '')
      commandOutput = [stdout, stderr].filter(Boolean).join('\n').trim()
    }

    const performedStep =
      action === 'command'
        ? `Executed allowlisted command: ${String(input?.command || '').trim()}`
        : `Resolved selector path (${deterministicSelectors.join(' -> ') || 'no selector'}) with deterministic recovery.`

    const record = appendExecutionRecord({
      domain: 'native-executor',
      adapterId: 'native.execution.v1',
      appType: String(input?.appType || 'native-surface'),
      intendedStep: String(input?.intendedStep || `Native ${action}`),
      performedStep,
      result: 'executed-supervised',
      newSkills: ['Deterministic Action Execution'],
      metadata: {
        sessionId: sessionId || undefined,
        stepId,
        action,
        selector,
        fallbackSelectors,
        appKey: String(input?.appKey || ''),
        appVersion: String(input?.appVersion || ''),
      },
      simpleLog: `Native action executed (${action}) with selector recovery path length ${Math.max(1, deterministicSelectors.length)}.`,
    })

    let captureResult = null
    if (sessionId) {
      captureResult = await captureSessionStepEvidence({
        sessionId,
        stepId,
        reason: 'native-action',
        domSnapshot: String(input?.domSnapshot || '').trim(),
        commandOutput,
        metadata: {
          action,
          selector,
          fallbackSelectors,
        },
      })
    }

    return {
      ok: true,
      record,
      commandOutput,
      executionSessions: learningState.executionSessions || [],
      learningGraph: buildLearningGraph(),
      evidence: captureResult && captureResult.ok ? captureResult.evidence : null,
      warnings: captureResult && !captureResult.ok ? [captureResult.reason] : [],
    }
  })

  ipcMain.handle('paxion:readiness:executeRollback', async (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required for rollback execution.' }
    }

    const sessionId = String(input?.sessionId || '').trim()
    if (!sessionId) {
      return { ok: false, reason: 'Session ID is required.' }
    }

    const sessions = Array.isArray(learningState.executionSessions) ? learningState.executionSessions : []
    const session = sessions.find((entry) => entry.id === sessionId)
    if (!session) {
      return { ok: false, reason: 'Execution session not found.' }
    }

    const rollbackSteps = Array.isArray(session.rollbackSteps) ? session.rollbackSteps : []
    const transactionId = `rollback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const stepResults = []

    for (let index = 0; index < rollbackSteps.length; index += 1) {
      const stepText = String(rollbackSteps[index] || '').trim()
      let status = 'executed'
      let output = ''
      if (/^command:/i.test(stepText)) {
        const command = stepText.replace(/^command:/i, '').trim()
        if (TOOL_COMMAND_ALLOWLIST.has(command) && capabilityState.workspaceTooling === true) {
          const commandResult = await execCommand(command, { cwd: process.cwd() }).catch((errorResult) => errorResult)
          output = [String(commandResult?.stdout || ''), String(commandResult?.stderr || '')].filter(Boolean).join('\n').trim()
        } else {
          status = 'blocked'
          output = 'Rollback command blocked by allowlist or missing workspaceTooling capability.'
        }
      } else {
        output = `Supervised rollback note executed: ${stepText}`
      }

      const stepId = `rollback-step-${index + 1}`
      stepResults.push({ stepId, step: stepText, status, output })
      await captureSessionStepEvidence({
        sessionId,
        stepId,
        reason: 'rollback-execution',
        commandOutput: output,
        metadata: { transactionId, status },
      })
    }

    const failed = stepResults.some((entry) => entry.status !== 'executed')
    const updatedSession = updateExecutionSession(sessionId, (current) => ({
      status: failed ? 'rollback-failed' : 'rolled-back',
      rollbackNotes: String(input?.notes || '').trim() || current.rollbackNotes || 'Rollback transaction executed.',
      rollbackTransactions: [
        ...(Array.isArray(current.rollbackTransactions) ? current.rollbackTransactions : []),
        {
          id: transactionId,
          createdAt: new Date().toISOString(),
          status: failed ? 'failed' : 'completed',
          steps: stepResults,
        },
      ].slice(-30),
    }))

    return {
      ok: true,
      session: updatedSession,
      transaction: {
        id: transactionId,
        status: failed ? 'failed' : 'completed',
        stepResults,
      },
      executionSessions: learningState.executionSessions || [],
      learningGraph: buildLearningGraph(),
    }
  })

  ipcMain.handle('paxion:readiness:captureObservation', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to capture observation.' }
    }

    const appType = String(input?.appType || '').trim() || 'unknown'
    const visibleText = String(input?.visibleText || '').trim()
    const notes = String(input?.notes || '').trim()
    const inferredSkills = inferSkills(`${appType}\n${visibleText}\n${notes}`)
    const snapshot = appendObservationSnapshot({
      title: String(input?.title || `Observation in ${appType}`),
      appType,
      visibleText,
      notes,
      screenshotPath: String(input?.screenshotPath || ''),
      inferredSkills,
    })

    appendLearningLog({
      title: `Observation captured: ${snapshot.title}`,
      detail: notes || 'Captured visible workflow state for later learning.',
      source: 'observation',
      newSkills: inferredSkills,
    })

    return { ok: true, snapshot, observations: learningState.observationSnapshots || [], learningGraph: buildLearningGraph(), skills: learningState.skills }
  })

  ipcMain.handle('paxion:readiness:planMission', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to plan cross-app mission.' }
    }

    const surfaces = Array.isArray(input?.surfaces)
      ? input.surfaces.filter((entry) => typeof entry === 'string' && entry.trim()).map((entry) => entry.trim())
      : []
    const mission = buildCrossAppMission(String(input?.goal || ''), surfaces, TARGET_WORKFLOW_PACK_DEFS)
    appendCrossAppMission(mission)

    return { ok: true, mission, missions: learningState.crossAppMissions || [] }
  })

  ipcMain.handle('paxion:readiness:graph', () => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to inspect learning graph.', learningGraph: { nodes: [], edges: [], updatedAt: null } }
    }

    return { ok: true, learningGraph: buildLearningGraph() }
  })

  ipcMain.handle('paxion:readiness:queryGraph', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return {
        ok: false,
        reason: 'Admin session required to query learning graph.',
        learningGraph: { nodes: [], edges: [], updatedAt: null },
        page: { cursor: 0, nextCursor: null, limit: 0, totalNodes: 0, totalEdges: 0 },
        indexStats: { totalSourceNodes: 0, totalSourceEdges: 0, distinctKinds: 0 },
      }
    }

    const baseGraph = buildLearningGraph()
    const result = queryLearningGraphSnapshot(baseGraph, {
      text: String(input?.text || ''),
      kinds: Array.isArray(input?.kinds) ? input.kinds : [],
      nodeId: String(input?.nodeId || ''),
      edgeKind: String(input?.edgeKind || ''),
      cursor: Math.max(0, Number(input?.cursor || 0)),
      limit: Math.max(1, Math.min(GRAPH_QUERY_MAX_LIMIT, Number(input?.limit || 40))),
    })

    return {
      ok: true,
      learningGraph: {
        nodes: result.nodes,
        edges: result.edges,
        updatedAt: baseGraph.updatedAt,
      },
      page: result.page,
      indexStats: result.indexStats,
    }
  })

  ipcMain.handle('paxion:readiness:createEvolutionPipeline', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to create evolution pipeline.' }
    }

    if (capabilityState.selfEvolution === false) {
      return { ok: false, reason: 'selfEvolution capability is disabled in Access tab.' }
    }

    const workspaceRoot = path.join(app.getPath('userData'), 'paxion-workspace')
    const artifactPath = path.join(workspaceRoot, 'evolution', `pipeline-${Date.now()}.md`)
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true })
    fs.writeFileSync(
      artifactPath,
      [
        '# Paxion Evolution Pipeline',
        `Title: ${String(input?.title || 'Evolution pipeline')}`,
        '',
        'Stages:',
        '- proposal',
        '- scaffold',
        '- test',
        '- review',
        '- deploy',
        '',
        `Objective: ${String(input?.objective || '')}`,
      ].join('\n'),
      'utf8',
    )

    const pipeline = appendEvolutionPipeline({
      title: String(input?.title || 'Evolution pipeline'),
      objective: String(input?.objective || ''),
      note: String(input?.note || 'Pipeline created by admin.'),
      artifactPath,
    })

    return { ok: true, pipeline, evolutionPipelines: learningState.evolutionPipelines || [] }
  })

  ipcMain.handle('paxion:readiness:advanceEvolutionPipeline', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to advance evolution pipeline.' }
    }

    const pipelineId = String(input?.pipelineId || '').trim()
    const note = String(input?.note || '').trim()
    const pipeline = updateEvolutionPipeline(pipelineId, (current) => {
      const stages = Array.isArray(current.stages) ? current.stages : []
      const currentIndex = Math.max(0, stages.indexOf(current.currentStage))
      const nextStage = stages[Math.min(stages.length - 1, currentIndex + 1)] || current.currentStage
      const governance = current?.governance && typeof current.governance === 'object' ? current.governance : {}
      const metrics = governance?.metrics && typeof governance.metrics === 'object' ? governance.metrics : {}
      const signatures = Array.isArray(governance.signatures) ? governance.signatures : []
      const requiredSignatures = Number(governance.requiredPolicySignatures || 1)
      const testsPassed = Number(input?.testsPassed ?? metrics.testsPassed ?? 0)
      const lintPassed = Boolean(input?.lintPassed ?? metrics.lintPassed ?? false)
      const buildPassed = Boolean(input?.buildPassed ?? metrics.buildPassed ?? false)

      if (nextStage === 'review' && testsPassed < Number(governance.minTestsForReview || GOVERNANCE_MIN_TESTS_FOR_REVIEW)) {
        return {
          currentStage: current.currentStage,
          history: [...(Array.isArray(current.history) ? current.history : []), { stage: current.currentStage, note: 'Blocked: minimum test gate not met for review stage.', timestamp: new Date().toISOString() }],
          governance: {
            ...governance,
            metrics: { testsPassed, lintPassed, buildPassed },
          },
        }
      }

      if (
        nextStage === 'deploy' &&
        (testsPassed < Number(governance.minTestsForDeploy || GOVERNANCE_MIN_TESTS_FOR_DEPLOY) ||
          !lintPassed ||
          !buildPassed ||
          signatures.length < requiredSignatures)
      ) {
        return {
          currentStage: current.currentStage,
          history: [...(Array.isArray(current.history) ? current.history : []), { stage: current.currentStage, note: 'Blocked: deploy gates require tests, lint/build pass, and governance signature.', timestamp: new Date().toISOString() }],
          governance: {
            ...governance,
            metrics: { testsPassed, lintPassed, buildPassed },
          },
        }
      }

      return {
        currentStage: nextStage,
        history: [...(Array.isArray(current.history) ? current.history : []), { stage: nextStage, note, timestamp: new Date().toISOString() }],
        governance: {
          ...governance,
          metrics: { testsPassed, lintPassed, buildPassed },
        },
      }
    })

    if (!pipeline) {
      return { ok: false, reason: 'Evolution pipeline not found.' }
    }

    return { ok: true, pipeline, evolutionPipelines: learningState.evolutionPipelines || [] }
  })

  ipcMain.handle('paxion:readiness:signGovernancePolicy', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to sign governance policy.' }
    }

    const pipelineId = String(input?.pipelineId || '').trim()
    const note = String(input?.note || '').trim()
    if (!pipelineId) {
      return { ok: false, reason: 'Pipeline ID is required.' }
    }

    const payloadHash = sha256Hex(
      stableStringify({
        pipelineId,
        note,
        signedAt: new Date().toISOString(),
      }),
    )
    const attestation = appendAttestationRecord({
      payloadHash,
      scope: 'governance-policy',
      metadata: { pipelineId, note },
    })

    const pipeline = updateEvolutionPipelineGovernance(pipelineId, {
      signature: attestation.signature,
      signer: 'admin-session',
      note,
      testsPassed: Number(input?.testsPassed || 0),
      lintPassed: Boolean(input?.lintPassed),
      buildPassed: Boolean(input?.buildPassed),
    })
    if (!pipeline) {
      return { ok: false, reason: 'Evolution pipeline not found.' }
    }

    return {
      ok: true,
      pipeline,
      attestation: {
        entryHash: attestation.entryHash,
        publicKeyFingerprint: attestation.publicKeyFingerprint,
      },
      evolutionPipelines: learningState.evolutionPipelines || [],
    }
  })

  ipcMain.handle('paxion:readiness:attestationStatus', () => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to inspect attestation status.' }
    }
    return {
      ok: true,
      status: attestationPublicStatus(),
    }
  })

  ipcMain.handle('paxion:readiness:rotateAttestationKey', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to rotate attestation key.' }
    }
    const result = rotateAttestationKey(input)
    appendAuditEntry('action_result', {
      actionId: 'readiness.rotateAttestationKey',
      status: 'allowed',
      previousFingerprint: result.previousFingerprint,
      currentFingerprint: result.currentFingerprint,
      reason: String(input?.reason || 'manual-rotation'),
    })
    return {
      ok: true,
      rotation: result,
    }
  })

  ipcMain.handle('paxion:readiness:createVisionJob', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to create vision/OCR job.' }
    }

    if (capabilityState.desktopAppAutomation === false) {
      return { ok: false, reason: 'desktopAppAutomation capability is required for vision/OCR jobs.' }
    }

    const objective = String(input?.objective || '').trim() || 'Review UI screenshot'
    const extractedText = String(input?.extractedText || '').trim()
    const notes = String(input?.notes || '').trim()
    const inferredSkills = inferSkills(`${objective}\n${extractedText}\n${notes}`)
    const job = appendVisionJob({
      objective,
      screenshotPath: String(input?.screenshotPath || ''),
      extractedText,
      notes,
      status: 'queued',
      inferredSkills,
    })

    appendLearningLog({
      title: `Vision/OCR job created: ${objective}`,
      detail: extractedText ? 'Queued screenshot review with extracted text context.' : 'Queued screenshot review for later OCR analysis.',
      source: 'vision-job',
      newSkills: inferredSkills,
    })

    return { ok: true, job, visionJobs: learningState.visionJobs || [], learningGraph: buildLearningGraph() }
  })

  ipcMain.handle('paxion:readiness:reviewVisionJob', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to review vision/OCR job.' }
    }

    const jobId = String(input?.jobId || '').trim()
    const notes = String(input?.notes || '').trim()
    const job = updateVisionJob(jobId, (current) => ({
      status: 'reviewed',
      notes: notes || current.notes || 'Vision job reviewed by admin.',
    }))

    if (!job) {
      return { ok: false, reason: 'Vision/OCR job not found.' }
    }

    return { ok: true, job, visionJobs: learningState.visionJobs || [], learningGraph: buildLearningGraph() }
  })

  ipcMain.handle('paxion:readiness:runOcr', async (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to run OCR.' }
    }

    if (capabilityState.desktopAppAutomation === false) {
      return { ok: false, reason: 'desktopAppAutomation capability is required for OCR runs.' }
    }

    const requestedJobId = String(input?.jobId || '').trim()
    const jobs = Array.isArray(learningState.visionJobs) ? learningState.visionJobs : []
    const existingJob = requestedJobId ? jobs.find((entry) => entry.id === requestedJobId) : null
    const imagePath = String(input?.imagePath || existingJob?.screenshotPath || '').trim()
    if (!imagePath) {
      return { ok: false, reason: 'Image path is required for OCR.' }
    }

    if (!fs.existsSync(imagePath)) {
      return { ok: false, reason: 'Image path does not exist.' }
    }

    const language = normalizeOcrLanguage(input?.language)
    const ocrResult = await Tesseract.recognize(imagePath, language).catch((err) => {
      return {
        error: err,
      }
    })

    if (!ocrResult || ocrResult.error) {
      return {
        ok: false,
        reason: `OCR failed: ${String(ocrResult?.error?.message || 'unknown error')}`,
      }
    }

    const extractedText = String(ocrResult?.data?.text || '').trim()
    const confidence = Number(ocrResult?.data?.confidence || 0)
    const inferredSkills = inferSkills(extractedText)
    const notes = String(input?.notes || '').trim()

    let job = null
    if (existingJob) {
      job = updateVisionJob(existingJob.id, (current) => ({
        status: 'processed',
        extractedText,
        notes: notes || current.notes || '',
        inferredSkills: Array.from(new Set([...(current.inferredSkills || []), ...inferredSkills])),
      }))
    } else {
      job = appendVisionJob({
        objective: String(input?.objective || 'OCR extraction'),
        screenshotPath: imagePath,
        extractedText,
        notes,
        status: 'processed',
        inferredSkills,
      })
    }

    appendLearningLog({
      title: `OCR processed: ${job?.objective || 'Vision job'}`,
      detail: extractedText
        ? `OCR extracted ${extractedText.split(/\s+/).filter(Boolean).length} words with confidence ${confidence.toFixed(1)}.`
        : 'OCR completed with no readable text output.',
      source: 'ocr',
      newSkills: inferredSkills,
    })

    const linkedSessionId = String(input?.sessionId || '').trim()
    if (linkedSessionId) {
      await captureSessionStepEvidence({
        sessionId: linkedSessionId,
        stepId: 'ocr-processing',
        reason: 'ocr-processing',
        domSnapshot: extractedText,
        screenshotPath: imagePath,
        metadata: {
          language,
          confidence,
          jobId: job?.id || null,
        },
      })
    }

    return {
      ok: true,
      job,
      extractedText,
      confidence,
      language,
      visionJobs: learningState.visionJobs || [],
      learningGraph: buildLearningGraph(),
      skills: learningState.skills,
    }
  })

  ipcMain.handle('paxion:readiness:createEvidenceArtifact', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to create evidence artifact.' }
    }

    const sessionId = String(input?.sessionId || '').trim()
    if (!sessionId) {
      return { ok: false, reason: 'Session ID is required.' }
    }

    const sessions = Array.isArray(learningState.executionSessions) ? learningState.executionSessions : []
    const session = sessions.find((entry) => entry.id === sessionId)
    if (!session) {
      return { ok: false, reason: 'Execution session not found.' }
    }

    const summary = String(input?.summary || '').trim() || 'No summary provided.'
    const domSnapshot = String(input?.domSnapshot || '').trim()
    const commandOutput = String(input?.commandOutput || '').trim()
    const notes = String(input?.notes || '').trim()
    const screenshotPath = String(input?.screenshotPath || '').trim()

    const workspaceRoot = workspaceRootPath()
    const artifactDir = path.join(workspaceRoot, 'evidence', sessionId, `${Date.now()}`)
    fs.mkdirSync(artifactDir, { recursive: true })

    const screenshotHash = screenshotPath && fs.existsSync(screenshotPath) ? sha256File(screenshotPath) : null
    const payload = {
      sessionId,
      packId: session.packId,
      packName: session.packName,
      status: session.status,
      targetUrl: session.targetUrl,
      intent: session.intent,
      summary,
      notes,
      verificationChecks: session.verificationChecks,
      executionSteps: session.executionSteps,
      rollbackSteps: session.rollbackSteps,
      evidenceItems: Array.isArray(input?.evidence) ? input.evidence : [],
      domSnapshot,
      commandOutput,
      screenshotPath,
      screenshotHash,
      generatedAt: new Date().toISOString(),
    }
    const payloadHash = sha256Hex(stableStringify(payload))
    const attestation = appendAttestationRecord({
      payloadHash,
      scope: 'evidence-artifact',
      sessionId,
      stepId: 'artifact',
      metadata: {
        status: session.status,
      },
    })

    const jsonPath = path.join(artifactDir, 'evidence.json')
    const mdPath = path.join(artifactDir, 'evidence.md')
    fs.writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          ...payload,
          payloadHash,
          attestation: {
            entryHash: attestation.entryHash,
            signature: attestation.signature,
            publicKeyFingerprint: attestation.publicKeyFingerprint,
            prevHash: attestation.prevHash,
          },
        },
        null,
        2,
      ),
      'utf8',
    )
    fs.writeFileSync(
      mdPath,
      [
        '# Paxion Evidence Artifact',
        `Session ID: ${sessionId}`,
        `Pack: ${session.packName}`,
        `Status: ${session.status}`,
        `Generated: ${payload.generatedAt}`,
        `Payload hash: ${payloadHash}`,
        `Attestation hash: ${attestation.entryHash}`,
        `Signer fingerprint: ${attestation.publicKeyFingerprint.slice(0, 24)}...`,
        '',
        '## Summary',
        summary,
        '',
        '## Notes',
        notes || 'None',
        '',
        '## Verification Checks',
        ...(session.verificationChecks || []).map((item) => `- ${item}`),
        '',
        '## Rollback Steps',
        ...(session.rollbackSteps || []).map((item) => `- ${item}`),
      ].join('\n'),
      'utf8',
    )

    const updatedSession = updateExecutionSession(sessionId, (current) => ({
      status: current.status === 'prepared' ? 'evidence-captured' : current.status,
      evidence: [...(Array.isArray(current.evidence) ? current.evidence : []), `artifact:${jsonPath}`].slice(-40),
      verificationNotes: notes || current.verificationNotes || '',
      latestAttestationHash: attestation.entryHash,
    }))

    appendAuditEntry('action_result', {
      actionId: 'readiness.createEvidenceArtifact',
      status: 'allowed',
      sessionId,
      artifactPath: jsonPath,
      payloadHash,
    })

    appendLearningLog({
      title: `Evidence artifact created: ${session.packName}`,
      detail: `Stored evidence bundle with integrity hash ${payloadHash.slice(0, 16)}...`,
      source: 'evidence-artifact',
      newSkills: ['Evidence Packaging'],
    })

    return {
      ok: true,
      artifact: {
        sessionId,
        payloadHash,
        jsonPath,
        markdownPath: mdPath,
        screenshotHash,
        attestationHash: attestation.entryHash,
        signerFingerprint: attestation.publicKeyFingerprint,
      },
      session: updatedSession,
      executionSessions: learningState.executionSessions || [],
      learningGraph: buildLearningGraph(),
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

  ipcMain.handle('paxion:program:status', () => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to inspect program status.' }
    }

    return {
      ok: true,
      policySnapshotHash: buildPolicySnapshotHash(),
      complianceMode: 'strict-safe',
      domains: {
        compliance: true,
        devices: true,
        learningV2: true,
        trading: true,
        medical: true,
        media: true,
      },
      updatedAt: new Date().toISOString(),
    }
  })

  ipcMain.handle('paxion:devices:list', () => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to list devices.', devices: [] }
    }
    return { ok: true, devices: Array.isArray(deviceState.devices) ? deviceState.devices : [] }
  })

  ipcMain.handle('paxion:devices:register', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to register device.' }
    }
    const result = upsertDevice(deviceState.devices, input)
    if (!result.ok) {
      return result
    }
    deviceState = {
      devices: result.devices,
      updatedAt: new Date().toISOString(),
    }
    saveDomainStates()
    appendAuditEntry('action_result', {
      actionId: 'devices.register',
      status: 'allowed',
      deviceId: result.device.id,
      platform: result.device.platform,
    })
    return { ok: true, device: result.device, devices: deviceState.devices }
  })

  ipcMain.handle('paxion:devices:revoke', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to revoke device.' }
    }
    const result = revokeDevice(deviceState.devices, input?.deviceId)
    if (!result.ok) {
      return result
    }
    deviceState = {
      devices: result.devices,
      updatedAt: new Date().toISOString(),
    }
    saveDomainStates()
    appendAuditEntry('action_result', {
      actionId: 'devices.revoke',
      status: 'allowed',
      deviceId: result.device.id,
    })
    return { ok: true, device: result.device, devices: deviceState.devices }
  })

  ipcMain.handle('paxion:learning:v2:update', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to update learning v2.' }
    }

    const evolved = evolveSkills(learningV2State, {
      newSkills: input?.newSkills,
      successful: Boolean(input?.successful),
    })
    const hypotheses = generateHypotheses(evolved, { goal: input?.goal })
    learningV2State = {
      ...evolved,
      hypotheses,
    }
    saveDomainStates()

    return {
      ok: true,
      learningV2: learningV2State,
    }
  })

  ipcMain.handle('paxion:trading:backtest', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to run trading backtest.' }
    }

    const backtest = runBacktest({ prices: input?.prices })
    tradingState = {
      ...tradingState,
      backtests: [...(Array.isArray(tradingState.backtests) ? tradingState.backtests : []), { ...backtest, createdAt: new Date().toISOString() }].slice(-120),
      updatedAt: new Date().toISOString(),
    }
    saveDomainStates()
    appendAuditEntry('action_result', {
      actionId: 'trading.backtest',
      status: 'allowed',
      totalReturn: backtest.totalReturn,
    })

    return { ok: true, backtest, tradingState }
  })

  ipcMain.handle('paxion:trading:paperOrder', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to place paper order.' }
    }

    const order = placePaperOrder(input)
    tradingState = {
      ...tradingState,
      paperOrders: [...(Array.isArray(tradingState.paperOrders) ? tradingState.paperOrders : []), order].slice(-240),
      updatedAt: new Date().toISOString(),
    }
    saveDomainStates()
    appendAuditEntry('action_result', {
      actionId: 'trading.paperOrder',
      status: 'allowed',
      symbol: order.symbol,
      side: order.side,
      notional: order.notional,
    })

    return { ok: true, order, tradingState }
  })

  ipcMain.handle('paxion:medical:review', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to run medical review.' }
    }

    const safety = evaluateMedicationSafety({ medications: input?.medications })
    const confidence = evaluateMedicalAdviceConfidence({
      confidence: input?.confidence,
      threshold: input?.threshold,
    })

    medicalState = {
      ...medicalState,
      safetyReviews: [...(Array.isArray(medicalState.safetyReviews) ? medicalState.safetyReviews : []), safety].slice(-240),
      confidenceReviews: [...(Array.isArray(medicalState.confidenceReviews) ? medicalState.confidenceReviews : []), confidence].slice(-240),
      updatedAt: new Date().toISOString(),
    }
    saveDomainStates()

    appendAuditEntry('action_result', {
      actionId: 'medical.review',
      status: 'allowed',
      safe: safety.safe,
      confidenceAllowed: confidence.allowed,
    })

    return { ok: true, safety, confidence, medicalState }
  })

  ipcMain.handle('paxion:media:generate', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to generate media.' }
    }

    if (capabilityState.mediaGeneration === false) {
      return { ok: false, reason: 'mediaGeneration capability is disabled in Access tab.' }
    }

    const result = enqueueMediaJob(mediaState, input)
    mediaState = {
      ...result.queue,
      updatedAt: new Date().toISOString(),
    }
    saveDomainStates()

    appendAuditEntry('action_result', {
      actionId: 'media.generate',
      status: 'allowed',
      jobId: result.job.id,
      type: result.job.type,
    })

    return { ok: true, job: result.job, mediaState }
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
