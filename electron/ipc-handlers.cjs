'use strict'

const { ipcMain, dialog, app, shell, desktopCapturer, safeStorage } = require('electron')
const crypto = require('crypto')
const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')
const { exec, spawn } = require('child_process')
const { PDFParse } = require('pdf-parse')
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
const {
  isBoundaryProtectedPath,
  isMasterGatedAction,
  isAdminCodewordValid,
  isMasterCodewordValid,
  SENSITIVE_CATEGORIES,
} = require('../boundary/policy-boundary.cjs')
const { evaluateCompliance, buildPolicySnapshotHash } = require('./compliance-engine.cjs')
const { upsertDevice, revokeDevice } = require('./device-control-plane.cjs')
const { evolveSkills, generateHypotheses } = require('./learning-engine-v2.cjs')
const { runBacktest, placePaperOrder } = require('./trading-engine.cjs')
const { evaluateMedicationSafety, evaluateMedicalAdviceConfidence } = require('./medical-safety.cjs')
const { enqueueMediaJob } = require('./media-generation.cjs')
const { callViaTwilio, normalizePhoneNumber } = require('./telephony-adapter.cjs')
const { generateWorkflow } = require('./workflow-engine.cjs')
const { assessTerminalCommand, buildCommandPlan } = require('./terminal-agent.cjs')
const { generateCreativeHypotheses } = require('./creative-lab.cjs')
const { simulatePolicyDiff, buildCanaryPlan, detectAnomalyRollback } = require('./governance-advanced.cjs')
const { configureBroker, previewLiveOrder, executeBrokerOrder } = require('./broker-live.cjs')
const { buildClinicalEvidence, validateExternalEvidence } = require('./clinical-validation.cjs')
const { buildTheoremPlan, buildSimulationPlan, synthesizeResearchProgram } = require('./science-toolchain.cjs')
const { updateVoiceQuality, evaluateDuplexSession } = require('./voice-quality-stack.cjs')
const { buildRelayEnvelope, issueOneTimeToken, consumeOneTimeToken } = require('./secure-relay-service.cjs')
const { submitRelayRequest, listPendingRelayRequests, completeRelayRequest } = require('./relay-client.cjs')
const { configureWakewordAdapter, getNativeWakewordStatus } = require('./wakeword-native.cjs')
const { createLongHorizonPlan, advanceValidationLoop } = require('./planner-executor.cjs')
const { registerEcosystemAdapter, planDeviceAction } = require('./device-ecosystem.cjs')
const { registerActuator, buildActuationPlan } = require('./robotics-control.cjs')
const { summarizeVaultProviders, configureVaultProvider } = require('./secret-vault.cjs')
const { buildSceneGraph, groundPerceptionFrame } = require('./multimodal-perception.cjs')
const { runWeeklyOptimization } = require('./weekly-optimizer.cjs')

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
  libraryIngestWeb: true,
  chatExternalModel: false,
  voiceInput: true,
  voiceOutput: true,
  emergencyCallRelay: true,
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

function enforcePolicy(request) {
  if (!request || typeof request.actionId !== 'string') {
    return {
      allowed: false,
      requiresApproval: false,
      ruleId: 'invalid-request',
      reason: 'Malformed action request rejected by main-process policy.',
    }
  }

  if (isMasterGatedAction(request)) {
    if (!isMasterCodewordValid(request.masterCodeword)) {
      return {
        allowed: false,
        requiresApproval: false,
        ruleId: 'master-codeword-required',
        reason: 'This action requires the master codeword "paro the master" to proceed.',
      }
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
    if (isBoundaryProtectedPath(target)) {
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

const MAX_REMOTE_BYTES = 2 * 1024 * 1024
const MAX_INGEST_TEXT_CHARS = 260000

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function extractHtmlTitle(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!match?.[1]) return ''
  return decodeHtmlEntities(match[1]).replace(/\s+/g, ' ').trim()
}

function htmlToPlainText(html) {
  const withoutScripts = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
  const text = withoutScripts
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return decodeHtmlEntities(text)
}

function fetchRemoteText(targetUrl, redirectsLeft = 4) {
  return new Promise((resolve, reject) => {
    let parsed
    try {
      parsed = new URL(targetUrl)
    } catch {
      reject(new Error('Invalid URL.'))
      return
    }

    const protocol = parsed.protocol.toLowerCase()
    if (protocol !== 'http:' && protocol !== 'https:') {
      reject(new Error('Only http/https URLs are supported.'))
      return
    }

    const client = protocol === 'https:' ? https : http
    const req = client.get(
      targetUrl,
      {
        headers: {
          'User-Agent': 'Paxion/0.22 LibraryIngest',
          Accept: 'text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.4',
        },
      },
      (res) => {
        const statusCode = Number(res.statusCode || 0)
        const location = typeof res.headers.location === 'string' ? res.headers.location : ''

        if ([301, 302, 303, 307, 308].includes(statusCode) && location) {
          if (redirectsLeft <= 0) {
            reject(new Error('Too many redirects while fetching URL.'))
            return
          }
          const nextUrl = new URL(location, targetUrl).toString()
          res.resume()
          fetchRemoteText(nextUrl, redirectsLeft - 1).then(resolve).catch(reject)
          return
        }

        if (statusCode < 200 || statusCode >= 300) {
          reject(new Error(`Remote server returned HTTP ${statusCode}.`))
          return
        }

        const contentType = String(res.headers['content-type'] || '').toLowerCase()
        const likelyText = !contentType
          || contentType.includes('text/')
          || contentType.includes('json')
          || contentType.includes('xml')
          || contentType.includes('html')

        if (!likelyText) {
          reject(new Error(`Unsupported content type: ${contentType || 'unknown'}`))
          return
        }

        let raw = ''
        let bytes = 0

        res.on('data', (chunk) => {
          bytes += chunk.length
          if (bytes > MAX_REMOTE_BYTES) {
            req.destroy(new Error('Remote content too large. Limit is 2 MB.'))
            return
          }
          raw += chunk.toString('utf8')
        })

        res.on('end', () => {
          resolve({
            finalUrl: targetUrl,
            contentType,
            raw,
          })
        })
      },
    )

    req.setTimeout(12000, () => {
      req.destroy(new Error('Remote request timed out after 12 seconds.'))
    })

    req.on('error', (err) => {
      reject(err)
    })
  })
}

function normalizeIngestedText(text) {
  return String(text || '')
    .replace(/\u0000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_INGEST_TEXT_CHARS)
}

function extractYoutubeVideoId(inputUrl) {
  try {
    const u = new URL(String(inputUrl || ''))
    const host = u.hostname.toLowerCase()
    if (host === 'youtu.be') {
      return u.pathname.replace(/^\//, '').split('/')[0] || null
    }
    if (host.includes('youtube.com')) {
      if (u.pathname === '/watch') {
        return u.searchParams.get('v')
      }
      const shortsMatch = u.pathname.match(/^\/shorts\/([^/?#]+)/)
      if (shortsMatch?.[1]) return shortsMatch[1]
      const embedMatch = u.pathname.match(/^\/embed\/([^/?#]+)/)
      if (embedMatch?.[1]) return embedMatch[1]
    }
  } catch {
    return null
  }
  return null
}

function parseXmlTranscript(xml) {
  const rows = []
  const pattern = /<text\s+start="([\d.]+)"\s+dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/gi
  let match
  while ((match = pattern.exec(xml)) !== null) {
    const start = Number(match[1] || 0)
    const text = decodeHtmlEntities(String(match[3] || ''))
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (text) {
      rows.push({ start, text })
    }
  }
  return rows
}

function fetchTextUrl(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Paxion/0.22 LibraryIngest',
      },
    }, (res) => {
      const status = Number(res.statusCode || 0)
      if (status < 200 || status >= 300) {
        reject(new Error(`HTTP ${status} while fetching transcript.`))
        return
      }

      let raw = ''
      res.on('data', (chunk) => {
        raw += chunk.toString('utf8')
      })
      res.on('end', () => resolve(raw))
    })

    req.setTimeout(timeoutMs, () => req.destroy(new Error('Transcript request timed out.')))
    req.on('error', (err) => reject(err))
  })
}

async function fetchYoutubeTranscriptRows(videoId) {
  const candidates = [
    `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=en`,
    `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=en-US`,
    `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=en&kind=asr`,
    `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=en-US&kind=asr`,
  ]

  for (const url of candidates) {
    try {
      const xml = await fetchTextUrl(url)
      const rows = parseXmlTranscript(xml)
      if (rows.length > 0) {
        return rows
      }
    } catch {
      // Try next endpoint candidate.
    }
  }

  throw new Error('No public transcript was found for this video. Try a video with captions enabled.')
}

function buildTranscriptSegments(rows, segmentSeconds = 360) {
  const groups = new Map()
  for (const row of rows) {
    const index = Math.floor((Number(row.start) || 0) / segmentSeconds)
    if (!groups.has(index)) {
      groups.set(index, [])
    }
    groups.get(index).push(row)
  }

  return Array.from(groups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([index, entries]) => {
      const start = index * segmentSeconds
      const end = start + segmentSeconds
      const text = entries.map((x) => x.text).join(' ')
      return {
        index,
        start,
        end,
        text: normalizeIngestedText(text),
      }
    })
    .filter((seg) => seg.text.length >= 80)
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
  const callProviderStateFilePath = path.join(app.getPath('userData'), 'paxion-call-provider.json')
  const voiceSecretsFilePath = path.join(app.getPath('userData'), 'paxion-voice-secrets.json')
  const relaySecretsFilePath = path.join(app.getPath('userData'), 'paxion-relay-secrets.json')
  const terminalPackStateFilePath = path.join(app.getPath('userData'), 'paxion-terminal-command-packs.json')
  const bridgeStateFilePath = path.join(app.getPath('userData'), 'paxion-bridge-state.json')
  const advancedStateFilePath = path.join(app.getPath('userData'), 'paxion-advanced-domains.json')
  const polyglotCoreDirPath = path.join(app.getAppPath(), 'polyglot-core')
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
  let callProviderState = {
    provider: 'desktop-relay',
    fromNumber: '',
    updatedAt: null,
  }
  let voiceSecretState = {
    ciphertext: '',
    updatedAt: null,
  }
  let relaySecretState = {
    ciphertext: '',
    updatedAt: null,
  }
  let terminalPackState = {
    packs: [],
    updatedAt: null,
  }
  let bridgeState = {
    enabled: false,
    host: '0.0.0.0',
    port: 8731,
    secret: '',
    pendingRequests: [],
    updatedAt: null,
  }
  let bridgeServer = null
  let advancedState = {
    governance: { policySimulations: [], canaries: [], anomalies: [], updatedAt: null },
    broker: { broker: null, orders: [], updatedAt: null },
    clinical: { evidence: [], validations: [], updatedAt: null },
    science: { theoremPlans: [], simulationPlans: [], programs: [], updatedAt: null },
    voiceQuality: { profile: null, sessions: [], updatedAt: null },
    relay: {
      config: { mode: 'disabled', endpoint: '', deviceId: 'paxion-primary', pollingEnabled: false },
      oneTimeTokens: [],
      envelopes: [],
      requests: [],
      updatedAt: null,
      lastCloudSyncAt: null,
    },
    wakeword: { adapter: null, updatedAt: null },
    planner: { plans: [], cycles: [], updatedAt: null },
    deviceEcosystem: { adapters: [], actions: [], updatedAt: null },
    robotics: { actuators: [], plans: [], updatedAt: null },
    vault: { activeProvider: 'local-safeStorage', providers: [], updatedAt: null },
    perception: { sceneGraphs: [], frames: [], updatedAt: null },
    optimization: { reports: [], lastRunAt: null, autoTune: true, updatedAt: null },
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
    return isAdminCodewordValid(codeword)
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

  function encryptAtRest(plainText) {
    if (!safeStorage.isEncryptionAvailable()) {
      return { ok: false, reason: 'OS secure storage is unavailable for encrypted-at-rest secrets.' }
    }
    try {
      const encrypted = safeStorage.encryptString(String(plainText || ''))
      return {
        ok: true,
        payload: encrypted.toString('base64'),
      }
    } catch (err) {
      return {
        ok: false,
        reason: `Failed to encrypt secret payload: ${String(err?.message || err)}`,
      }
    }
  }

  function decryptAtRest(payload) {
    if (!payload) {
      return { ok: true, plainText: '' }
    }
    if (!safeStorage.isEncryptionAvailable()) {
      return { ok: false, reason: 'OS secure storage is unavailable for decrypting secrets.' }
    }
    try {
      const decrypted = safeStorage.decryptString(Buffer.from(String(payload), 'base64'))
      return { ok: true, plainText: decrypted }
    } catch (err) {
      return {
        ok: false,
        reason: `Failed to decrypt secret payload: ${String(err?.message || err)}`,
      }
    }
  }

  function loadVoiceSecrets() {
    const decoded = decryptAtRest(voiceSecretState.ciphertext)
    if (!decoded.ok || !decoded.plainText) {
      return {
        twilioAccountSid: '',
        twilioAuthToken: '',
        twilioFromNumber: '',
        sipUri: '',
        sipUsername: '',
        sipPassword: '',
      }
    }

    try {
      const parsed = JSON.parse(decoded.plainText)
      return {
        twilioAccountSid: String(parsed?.twilioAccountSid || ''),
        twilioAuthToken: String(parsed?.twilioAuthToken || ''),
        twilioFromNumber: String(parsed?.twilioFromNumber || ''),
        sipUri: String(parsed?.sipUri || ''),
        sipUsername: String(parsed?.sipUsername || ''),
        sipPassword: String(parsed?.sipPassword || ''),
      }
    } catch {
      return {
        twilioAccountSid: '',
        twilioAuthToken: '',
        twilioFromNumber: '',
        sipUri: '',
        sipUsername: '',
        sipPassword: '',
      }
    }
  }

  function loadRelaySecrets() {
    const decoded = decryptAtRest(relaySecretState.ciphertext)
    if (!decoded.ok || !decoded.plainText) {
      return {
        cloudToken: '',
      }
    }

    try {
      const parsed = JSON.parse(decoded.plainText)
      return {
        cloudToken: String(parsed?.cloudToken || ''),
      }
    } catch {
      return {
        cloudToken: '',
      }
    }
  }

  function getTerminalPackSigningPayload(pack) {
    return stableStringify({
      id: String(pack?.id || ''),
      name: String(pack?.name || ''),
      commands: Array.isArray(pack?.commands) ? pack.commands.map((x) => String(x)) : [],
      policySnapshotHash: String(pack?.policySnapshotHash || ''),
      createdAt: String(pack?.createdAt || ''),
    })
  }

  function verifyTerminalPackSignature(pack) {
    ensureAttestationState()
    const signature = String(pack?.signature || '')
    if (!signature) {
      return false
    }
    try {
      return crypto.verify(
        null,
        Buffer.from(getTerminalPackSigningPayload(pack), 'utf8'),
        attestationState.publicKeyPem,
        Buffer.from(signature, 'base64'),
      )
    } catch {
      return false
    }
  }

  function isCommandAllowedBySignedPacks(command) {
    const packs = Array.isArray(terminalPackState.packs) ? terminalPackState.packs : []
    const normalized = String(command || '').trim()
    for (const pack of packs) {
      if (!pack || pack.active !== true) {
        continue
      }
      if (!verifyTerminalPackSignature(pack)) {
        continue
      }
      const commands = Array.isArray(pack.commands) ? pack.commands : []
      if (commands.includes(normalized)) {
        return true
      }
    }
    return false
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
    callProviderState = loadJsonState(callProviderStateFilePath, {
      provider: 'desktop-relay',
      fromNumber: '',
      updatedAt: null,
    })
    voiceSecretState = loadJsonState(voiceSecretsFilePath, {
      ciphertext: '',
      updatedAt: null,
    })
    relaySecretState = loadJsonState(relaySecretsFilePath, {
      ciphertext: '',
      updatedAt: null,
    })
    terminalPackState = loadJsonState(terminalPackStateFilePath, {
      packs: [],
      updatedAt: null,
    })
    bridgeState = loadJsonState(bridgeStateFilePath, {
      enabled: false,
      host: '0.0.0.0',
      port: 8731,
      secret: '',
      pendingRequests: [],
      updatedAt: null,
    })
    advancedState = loadJsonState(advancedStateFilePath, advancedState)
    advancedState = {
      ...advancedState,
      relay: {
        config: {
          mode: String(advancedState?.relay?.config?.mode || 'disabled'),
          endpoint: String(advancedState?.relay?.config?.endpoint || ''),
          deviceId: String(advancedState?.relay?.config?.deviceId || 'paxion-primary'),
          pollingEnabled: Boolean(advancedState?.relay?.config?.pollingEnabled),
        },
        oneTimeTokens: Array.isArray(advancedState?.relay?.oneTimeTokens) ? advancedState.relay.oneTimeTokens : [],
        envelopes: Array.isArray(advancedState?.relay?.envelopes) ? advancedState.relay.envelopes : [],
        requests: Array.isArray(advancedState?.relay?.requests) ? advancedState.relay.requests : [],
        updatedAt: advancedState?.relay?.updatedAt || null,
        lastCloudSyncAt: advancedState?.relay?.lastCloudSyncAt || null,
      },
      optimization: {
        reports: Array.isArray(advancedState?.optimization?.reports) ? advancedState.optimization.reports : [],
        lastRunAt: advancedState?.optimization?.lastRunAt || null,
        autoTune: advancedState?.optimization?.autoTune !== false,
        updatedAt: advancedState?.optimization?.updatedAt || null,
      },
    }
  }

  function saveDomainStates() {
    saveJsonState(deviceStateFilePath, deviceState)
    saveJsonState(learningV2StateFilePath, learningV2State)
    saveJsonState(tradingStateFilePath, tradingState)
    saveJsonState(medicalStateFilePath, medicalState)
    saveJsonState(mediaStateFilePath, mediaState)
    saveJsonState(callProviderStateFilePath, callProviderState)
    saveJsonState(voiceSecretsFilePath, voiceSecretState)
    saveJsonState(relaySecretsFilePath, relaySecretState)
    saveJsonState(terminalPackStateFilePath, terminalPackState)
    saveJsonState(bridgeStateFilePath, bridgeState)
    saveJsonState(advancedStateFilePath, advancedState)
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

  function buildThreatDashboard(input) {
    const request = input?.request && typeof input.request === 'object' ? input.request : null
    const baseDecision = request ? enforcePolicy(request) : null
    const activeCapabilities = Object.entries(capabilityState || {}).filter(([, enabled]) => enabled === true).length
    const activeBridge = bridgeState.enabled ? 12 : 0
    const pendingBridge = Array.isArray(bridgeState.pendingRequests) ? bridgeState.pendingRequests.filter((x) => String(x?.status || '') === 'pending').length : 0
    const activePacks = Array.isArray(terminalPackState.packs) ? terminalPackState.packs.filter((x) => x?.active === true).length : 0
    const requestRisk = !request
      ? 0
      : baseDecision && baseDecision.allowed === false
        ? 85
        : baseDecision && baseDecision.requiresApproval
          ? 55
          : 18
    const score = Math.min(100, requestRisk + activeBridge + pendingBridge * 5 + activePacks * 3 + Math.max(0, activeCapabilities - 8) * 2)
    return {
      ok: true,
      dashboard: {
        score,
        level: score >= 75 ? 'high' : score >= 40 ? 'medium' : 'low',
        requestRisk,
        activeCapabilities,
        bridgeEnabled: Boolean(bridgeState.enabled),
        pendingBridgeRequests: pendingBridge,
        activeSignedCommandPacks: activePacks,
        latestPolicyDecision: baseDecision,
        generatedAt: new Date().toISOString(),
      },
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

  function normalizePolyglotLanguage(value) {
    const raw = String(value || '').trim().toLowerCase()
    if (raw === 'js') return 'javascript'
    if (raw === 'c#') return 'csharp'
    return raw
  }

  function normalizePolyglotArgs(raw) {
    if (!Array.isArray(raw)) return []
    return raw
      .filter((item) => typeof item === 'string' || typeof item === 'number')
      .map((item) => String(item).trim())
      .filter(Boolean)
      .slice(0, 24)
  }

  function firstMeaningfulLine(text) {
    return String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) || ''
  }

  function buildPolyglotTempDir() {
    return fs.mkdtempSync(path.join(app.getPath('temp'), 'paxion-polyglot-'))
  }

  function executeSpawn(command, args, options = {}) {
    return new Promise((resolve) => {
      let stdout = ''
      let stderr = ''
      let finished = false
      let timedOut = false
      const child = spawn(command, Array.isArray(args) ? args : [], {
        cwd: options.cwd || app.getPath('userData'),
        env: { ...process.env, ...(options.env || {}) },
        shell: false,
        windowsHide: true,
      })

      const timeoutMs = Math.max(500, Number(options.timeoutMs || 15000))
      const timeout = setTimeout(() => {
        timedOut = true
        try {
          child.kill()
        } catch (_err) {
          // Ignore kill failures; close/error handlers resolve below.
        }
      }, timeoutMs)

      const finish = (payload) => {
        if (finished) return
        finished = true
        clearTimeout(timeout)
        resolve({
          stdout,
          stderr,
          timedOut,
          ...payload,
        })
      }

      child.on('error', (err) => {
        finish({
          ok: false,
          exitCode: null,
          spawnError: err.message,
        })
      })

      if (child.stdout) {
        child.stdout.on('data', (chunk) => {
          stdout += String(chunk)
        })
      }

      if (child.stderr) {
        child.stderr.on('data', (chunk) => {
          stderr += String(chunk)
        })
      }

      child.on('close', (code) => {
        finish({
          ok: !timedOut && code === 0,
          exitCode: typeof code === 'number' ? code : null,
          spawnError: null,
        })
      })

      if (typeof options.stdin === 'string' && child.stdin) {
        child.stdin.write(options.stdin)
      }
      if (child.stdin) {
        child.stdin.end()
      }
    })
  }

  async function detectCommandCandidate(candidates) {
    for (const candidate of candidates) {
      const probe = await executeSpawn(candidate.command, candidate.probeArgs || ['--version'], {
        timeoutMs: 4000,
      })

      if (!probe.spawnError && (probe.exitCode === 0 || probe.stdout || probe.stderr)) {
        return {
          command: candidate.command,
          prefixArgs: Array.isArray(candidate.prefixArgs) ? candidate.prefixArgs : [],
          displayCommand: [candidate.command, ...(candidate.prefixArgs || [])].join(' '),
          detail: firstMeaningfulLine(probe.stdout || probe.stderr) || 'available',
        }
      }
    }

    return null
  }

  async function resolvePolyglotRuntime(language) {
    switch (language) {
      case 'python':
        return detectCommandCandidate([
          { command: 'python', probeArgs: ['--version'], prefixArgs: [] },
          { command: 'py', probeArgs: ['-3', '--version'], prefixArgs: ['-3'] },
        ])
      case 'javascript':
        return detectCommandCandidate([{ command: 'node', probeArgs: ['--version'], prefixArgs: [] }])
      case 'julia':
        return detectCommandCandidate([{ command: 'julia', probeArgs: ['--version'], prefixArgs: [] }])
      case 'r':
        return detectCommandCandidate([{ command: 'Rscript', probeArgs: ['--version'], prefixArgs: [] }])
      case 'c':
        return detectCommandCandidate([
          { command: 'gcc', probeArgs: ['--version'], prefixArgs: [] },
          { command: 'clang', probeArgs: ['--version'], prefixArgs: [] },
        ])
      case 'cpp':
        return detectCommandCandidate([
          { command: 'g++', probeArgs: ['--version'], prefixArgs: [] },
          { command: 'clang++', probeArgs: ['--version'], prefixArgs: [] },
        ])
      case 'java': {
        const compiler = await detectCommandCandidate([
          { command: 'javac', probeArgs: ['-version'], prefixArgs: [] },
        ])
        const runtime = await detectCommandCandidate([
          { command: 'java', probeArgs: ['-version'], prefixArgs: [] },
        ])

        if (!compiler || !runtime) {
          return null
        }

        return {
          compile: compiler,
          run: runtime,
          detail: `${compiler.detail} | ${runtime.detail}`,
        }
      }
      default:
        return null
    }
  }

  function resolveJavaClassName(code) {
    const publicClass = String(code || '').match(/\bpublic\s+class\s+([A-Za-z_][A-Za-z0-9_]*)/)
    if (publicClass?.[1]) return publicClass[1]
    const anyClass = String(code || '').match(/\bclass\s+([A-Za-z_][A-Za-z0-9_]*)/)
    if (anyClass?.[1]) return anyClass[1]
    return 'Main'
  }

  function buildPolyglotSkill(language) {
    const map = {
      python: 'Python Runtime Execution',
      javascript: 'JavaScript Runtime Execution',
      c: 'C Runtime Compilation',
      cpp: 'C++ Runtime Compilation',
      java: 'Java Runtime Execution',
      julia: 'Julia Runtime Execution',
      r: 'R Runtime Execution',
    }

    return map[language] || 'Polyglot Runtime Execution'
  }

  async function buildPolyglotStatus() {
    const languages = ['python', 'c', 'cpp', 'java', 'julia', 'r', 'javascript']
    const rows = []

    for (const language of languages) {
      const runtime = await resolvePolyglotRuntime(language)
      if (!runtime) {
        rows.push({
          language,
          available: false,
          command: null,
          detail: 'Runtime or compiler not found on this machine.',
        })
        continue
      }

      if (language === 'java') {
        rows.push({
          language,
          available: true,
          command: `${runtime.compile.displayCommand} + ${runtime.run.displayCommand}`,
          detail: runtime.detail,
        })
        continue
      }

      rows.push({
        language,
        available: true,
        command: runtime.displayCommand,
        detail: runtime.detail,
      })
    }

    return rows
  }

  async function runPolyglotProgram(input) {
    const language = normalizePolyglotLanguage(input?.language)
    const allowedLanguages = new Set(['python', 'c', 'cpp', 'java', 'julia', 'r', 'javascript'])
    if (!allowedLanguages.has(language)) {
      return {
        ok: false,
        reason: 'Unsupported language requested.',
        language,
        stage: 'setup',
        stdout: '',
        stderr: '',
        exitCode: null,
        timedOut: false,
        commands: [],
        artifactPath: null,
      }
    }

    const runtime = await resolvePolyglotRuntime(language)
    if (!runtime) {
      return {
        ok: false,
        reason: `${language} runtime is not installed or not available in PATH.`,
        language,
        stage: 'setup',
        stdout: '',
        stderr: '',
        exitCode: null,
        timedOut: false,
        commands: [],
        artifactPath: null,
      }
    }

    const code = String(input?.code || '')
    if (!code.trim()) {
      return {
        ok: false,
        reason: 'Code is empty.',
        language,
        stage: 'setup',
        stdout: '',
        stderr: '',
        exitCode: null,
        timedOut: false,
        commands: [],
        artifactPath: null,
      }
    }

    const stdin = typeof input?.stdin === 'string' ? input.stdin : ''
    const args = normalizePolyglotArgs(input?.args)
    const timeoutMs = Math.min(120000, Math.max(1000, Number(input?.timeoutMs || 20000)))
    const tempDir = buildPolyglotTempDir()
    const commands = []

    if (language === 'python') {
      const sourcePath = path.join(tempDir, 'main.py')
      fs.writeFileSync(sourcePath, code, 'utf8')
      commands.push(`${runtime.displayCommand} ${path.basename(sourcePath)} ${args.join(' ')}`.trim())
      const result = await executeSpawn(runtime.command, [...runtime.prefixArgs, sourcePath, ...args], {
        cwd: tempDir,
        stdin,
        timeoutMs,
      })
      return {
        ok: result.ok,
        reason: result.ok ? 'Python program executed.' : result.spawnError || 'Python program failed.',
        language,
        stage: 'run',
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        commands,
        artifactPath: sourcePath,
      }
    }

    if (language === 'javascript') {
      const sourcePath = path.join(tempDir, 'main.js')
      fs.writeFileSync(sourcePath, code, 'utf8')
      commands.push(`${runtime.displayCommand} ${path.basename(sourcePath)} ${args.join(' ')}`.trim())
      const result = await executeSpawn(runtime.command, [...runtime.prefixArgs, sourcePath, ...args], {
        cwd: tempDir,
        stdin,
        timeoutMs,
      })
      return {
        ok: result.ok,
        reason: result.ok ? 'JavaScript program executed.' : result.spawnError || 'JavaScript program failed.',
        language,
        stage: 'run',
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        commands,
        artifactPath: sourcePath,
      }
    }

    if (language === 'julia') {
      const sourcePath = path.join(tempDir, 'main.jl')
      fs.writeFileSync(sourcePath, code, 'utf8')
      commands.push(`${runtime.displayCommand} ${path.basename(sourcePath)} ${args.join(' ')}`.trim())
      const result = await executeSpawn(runtime.command, [...runtime.prefixArgs, sourcePath, ...args], {
        cwd: tempDir,
        stdin,
        timeoutMs,
      })
      return {
        ok: result.ok,
        reason: result.ok ? 'Julia program executed.' : result.spawnError || 'Julia program failed.',
        language,
        stage: 'run',
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        commands,
        artifactPath: sourcePath,
      }
    }

    if (language === 'r') {
      const sourcePath = path.join(tempDir, 'main.R')
      fs.writeFileSync(sourcePath, code, 'utf8')
      commands.push(`${runtime.displayCommand} ${path.basename(sourcePath)} ${args.join(' ')}`.trim())
      const result = await executeSpawn(runtime.command, [...runtime.prefixArgs, sourcePath, ...args], {
        cwd: tempDir,
        stdin,
        timeoutMs,
      })
      return {
        ok: result.ok,
        reason: result.ok ? 'R program executed.' : result.spawnError || 'R program failed.',
        language,
        stage: 'run',
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        commands,
        artifactPath: sourcePath,
      }
    }

    if (language === 'c' || language === 'cpp') {
      const ext = language === 'c' ? 'c' : 'cpp'
      const sourcePath = path.join(tempDir, `main.${ext}`)
      const binaryPath = path.join(tempDir, process.platform === 'win32' ? 'program.exe' : 'program')
      fs.writeFileSync(sourcePath, code, 'utf8')

      const compileArgs = language === 'c'
        ? [sourcePath, '-O2', '-o', binaryPath]
        : [sourcePath, '-std=c++17', '-O2', '-o', binaryPath]
      commands.push(`${runtime.displayCommand} ${compileArgs.map((item) => path.basename(item) === item ? item : `"${item}"`).join(' ')}`)
      const compile = await executeSpawn(runtime.command, [...runtime.prefixArgs, ...compileArgs], {
        cwd: tempDir,
        timeoutMs: Math.min(timeoutMs, 30000),
      })

      if (!compile.ok) {
        return {
          ok: false,
          reason: compile.spawnError || `${language === 'c' ? 'C' : 'C++'} compilation failed.`,
          language,
          stage: 'compile',
          stdout: compile.stdout,
          stderr: compile.stderr,
          exitCode: compile.exitCode,
          timedOut: compile.timedOut,
          commands,
          artifactPath: sourcePath,
        }
      }

      commands.push(`${binaryPath} ${args.join(' ')}`.trim())
      const run = await executeSpawn(binaryPath, args, {
        cwd: tempDir,
        stdin,
        timeoutMs,
      })

      return {
        ok: run.ok,
        reason: run.ok ? `${language === 'c' ? 'C' : 'C++'} program executed.` : run.spawnError || `${language === 'c' ? 'C' : 'C++'} program failed.`,
        language,
        stage: 'run',
        stdout: `${compile.stdout}${compile.stderr ? `\n${compile.stderr}` : ''}${run.stdout ? `${compile.stdout || compile.stderr ? '\n' : ''}${run.stdout}` : ''}`,
        stderr: run.stderr,
        exitCode: run.exitCode,
        timedOut: run.timedOut,
        commands,
        artifactPath: binaryPath,
      }
    }

    if (language === 'java') {
      const className = resolveJavaClassName(code)
      const sourcePath = path.join(tempDir, `${className}.java`)
      fs.writeFileSync(sourcePath, code, 'utf8')

      const compileArgs = [...runtime.compile.prefixArgs, sourcePath]
      commands.push(`${runtime.compile.displayCommand} ${path.basename(sourcePath)}`)
      const compile = await executeSpawn(runtime.compile.command, compileArgs, {
        cwd: tempDir,
        timeoutMs: Math.min(timeoutMs, 30000),
      })

      if (!compile.ok) {
        return {
          ok: false,
          reason: compile.spawnError || 'Java compilation failed.',
          language,
          stage: 'compile',
          stdout: compile.stdout,
          stderr: compile.stderr,
          exitCode: compile.exitCode,
          timedOut: compile.timedOut,
          commands,
          artifactPath: sourcePath,
        }
      }

      const runArgs = [...runtime.run.prefixArgs, '-cp', tempDir, className, ...args]
      commands.push(`${runtime.run.displayCommand} -cp "${tempDir}" ${className} ${args.join(' ')}`.trim())
      const run = await executeSpawn(runtime.run.command, runArgs, {
        cwd: tempDir,
        stdin,
        timeoutMs,
      })

      return {
        ok: run.ok,
        reason: run.ok ? 'Java program executed.' : run.spawnError || 'Java program failed.',
        language,
        stage: 'run',
        stdout: `${compile.stdout}${compile.stderr ? `\n${compile.stderr}` : ''}${run.stdout ? `${compile.stdout || compile.stderr ? '\n' : ''}${run.stdout}` : ''}`,
        stderr: run.stderr,
        exitCode: run.exitCode,
        timedOut: run.timedOut,
        commands,
        artifactPath: sourcePath,
      }
    }

    return {
      ok: false,
      reason: 'Language runner is not yet implemented.',
      language,
      stage: 'setup',
      stdout: '',
      stderr: '',
      exitCode: null,
      timedOut: false,
      commands: [],
      artifactPath: null,
    }
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

  function resolvePolyglotStarterSpec(language) {
    const normalized = normalizePolyglotLanguage(language)
    const fileMap = {
      python: ['python', 'starter.py'],
      c: ['c', 'starter.c'],
      cpp: ['cpp', 'starter.cpp'],
      java: ['java', 'Main.java'],
      julia: ['julia', 'starter.jl'],
      r: ['r', 'starter.R'],
      javascript: ['javascript', 'starter.js'],
    }

    const parts = fileMap[normalized]
    if (!parts) return null

    return {
      language: normalized,
      filePath: path.join(polyglotCoreDirPath, ...parts),
      fileName: parts[1],
    }
  }

  function loadPolyglotStarterSource(language) {
    const spec = resolvePolyglotStarterSpec(language)
    if (!spec) {
      return {
        ok: false,
        reason: 'Unsupported starter language.',
        language: normalizePolyglotLanguage(language),
      }
    }

    if (!fs.existsSync(spec.filePath)) {
      return {
        ok: false,
        reason: `Starter file not found for ${spec.language}.`,
        language: spec.language,
      }
    }

    return {
      ok: true,
      language: spec.language,
      name: spec.fileName,
      content: fs.readFileSync(spec.filePath, 'utf8'),
      sourcePath: spec.filePath,
    }
  }

  function resolvePolyglotBrainSpec(language) {
    const normalized = normalizePolyglotLanguage(language)
    const fileMap = {
      python: ['python', 'brain_module.py'],
      c: ['c', 'brain_module.c'],
      cpp: ['cpp', 'brain_module.cpp'],
      java: ['java', 'BrainModule.java'],
      julia: ['julia', 'brain_module.jl'],
      r: ['r', 'brain_module.R'],
      javascript: ['javascript', 'brain_module.js'],
    }

    const parts = fileMap[normalized]
    if (!parts) return null

    return {
      language: normalized,
      filePath: path.join(polyglotCoreDirPath, ...parts),
      fileName: parts[1],
    }
  }

  function tryParseJsonObject(text) {
    try {
      return JSON.parse(String(text || '').trim())
    } catch (_err) {
      return null
    }
  }

  async function executePolyglotFile(language, filePath, stdin, timeoutMs = 12000) {
    const runtime = await resolvePolyglotRuntime(language)
    if (!runtime) {
      return {
        ok: false,
        reason: `${language} runtime is not installed or not available in PATH.`,
        language,
        stage: 'setup',
        stdout: '',
        stderr: '',
        exitCode: null,
        timedOut: false,
        commands: [],
        artifactPath: null,
      }
    }

    if (!fs.existsSync(filePath)) {
      return {
        ok: false,
        reason: `Source file not found: ${filePath}`,
        language,
        stage: 'setup',
        stdout: '',
        stderr: '',
        exitCode: null,
        timedOut: false,
        commands: [],
        artifactPath: null,
      }
    }

    const tempDir = buildPolyglotTempDir()
    const commands = []

    if (language === 'python' || language === 'javascript' || language === 'julia' || language === 'r') {
      const commandLabel = language === 'java' ? runtime.run.displayCommand : runtime.displayCommand
      commands.push(`${commandLabel} ${path.basename(filePath)}`)
      const result = await executeSpawn(runtime.command, [...runtime.prefixArgs, filePath], {
        cwd: tempDir,
        stdin,
        timeoutMs,
      })
      return {
        ok: result.ok,
        reason: result.ok ? `${language} module executed.` : result.spawnError || `${language} module failed.`,
        language,
        stage: 'run',
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        commands,
        artifactPath: filePath,
      }
    }

    if (language === 'c' || language === 'cpp') {
      const binaryPath = path.join(tempDir, process.platform === 'win32' ? 'brain.exe' : 'brain')
      const compileArgs = language === 'c'
        ? [filePath, '-O2', '-o', binaryPath]
        : [filePath, '-std=c++17', '-O2', '-o', binaryPath]
      commands.push(`${runtime.displayCommand} ${compileArgs.join(' ')}`)
      const compile = await executeSpawn(runtime.command, [...runtime.prefixArgs, ...compileArgs], {
        cwd: tempDir,
        timeoutMs: Math.min(timeoutMs, 30000),
      })
      if (!compile.ok) {
        return {
          ok: false,
          reason: compile.spawnError || `${language} module compilation failed.`,
          language,
          stage: 'compile',
          stdout: compile.stdout,
          stderr: compile.stderr,
          exitCode: compile.exitCode,
          timedOut: compile.timedOut,
          commands,
          artifactPath: filePath,
        }
      }
      commands.push(binaryPath)
      const run = await executeSpawn(binaryPath, [], {
        cwd: tempDir,
        stdin,
        timeoutMs,
      })
      return {
        ok: run.ok,
        reason: run.ok ? `${language} module executed.` : run.spawnError || `${language} module failed.`,
        language,
        stage: 'run',
        stdout: run.stdout,
        stderr: run.stderr,
        exitCode: run.exitCode,
        timedOut: run.timedOut,
        commands,
        artifactPath: filePath,
      }
    }

    if (language === 'java') {
      const className = 'BrainModule'
      const stagedFilePath = path.join(tempDir, `${className}.java`)
      fs.copyFileSync(filePath, stagedFilePath)
      const compileArgs = [...runtime.compile.prefixArgs, stagedFilePath]
      commands.push(`${runtime.compile.displayCommand} ${className}.java`)
      const compile = await executeSpawn(runtime.compile.command, compileArgs, {
        cwd: tempDir,
        timeoutMs: Math.min(timeoutMs, 30000),
      })
      if (!compile.ok) {
        return {
          ok: false,
          reason: compile.spawnError || 'java module compilation failed.',
          language,
          stage: 'compile',
          stdout: compile.stdout,
          stderr: compile.stderr,
          exitCode: compile.exitCode,
          timedOut: compile.timedOut,
          commands,
          artifactPath: filePath,
        }
      }
      const runArgs = [...runtime.run.prefixArgs, '-cp', tempDir, className]
      commands.push(`${runtime.run.displayCommand} -cp ${tempDir} ${className}`)
      const run = await executeSpawn(runtime.run.command, runArgs, {
        cwd: tempDir,
        stdin,
        timeoutMs,
      })
      return {
        ok: run.ok,
        reason: run.ok ? 'java module executed.' : run.spawnError || 'java module failed.',
        language,
        stage: 'run',
        stdout: run.stdout,
        stderr: run.stderr,
        exitCode: run.exitCode,
        timedOut: run.timedOut,
        commands,
        artifactPath: filePath,
      }
    }

    return {
      ok: false,
      reason: 'Unsupported polyglot module language.',
      language,
      stage: 'setup',
      stdout: '',
      stderr: '',
      exitCode: null,
      timedOut: false,
      commands: [],
      artifactPath: null,
    }
  }

  async function runPolyglotBrainMesh(input) {
    const requested = Array.isArray(input?.languages) ? input.languages : ['python', 'c', 'cpp', 'java', 'julia', 'r', 'javascript']
    const objective = String(input?.objective || 'Strengthen Paxion architecture').trim()
    const languages = Array.from(new Set(requested.map((language) => normalizePolyglotLanguage(language)).filter(Boolean)))
    const results = []

    for (const language of languages) {
      const spec = resolvePolyglotBrainSpec(language)
      if (!spec) {
        results.push({
          language,
          ok: false,
          reason: 'Unsupported language requested for brain mesh.',
          detail: null,
          commands: [],
        })
        continue
      }

      const execution = await executePolyglotFile(language, spec.filePath, JSON.stringify({ objective }), 12000)
      const parsed = execution.ok ? tryParseJsonObject(execution.stdout) : null
      results.push({
        language,
        ok: execution.ok,
        reason: execution.reason,
        detail: parsed,
        stdout: execution.stdout,
        stderr: execution.stderr,
        commands: execution.commands,
        timedOut: execution.timedOut,
        artifactPath: execution.artifactPath,
      })
    }

    const successful = results.filter((item) => item.ok && item.detail)
    const summary = successful.length === 0
      ? 'No brain modules executed successfully. Install the local runtimes you want to use.'
      : successful
          .map((item) => `${String(item.detail.language || item.language)}: ${String(item.detail.recommendation || 'No recommendation provided.')}`)
          .join(' | ')

    return {
      ok: successful.length > 0,
      objective,
      results,
      summary,
      completedCount: successful.length,
      attemptedCount: results.length,
    }
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

      if (!TOOL_COMMAND_ALLOWLIST.has(command) && !isCommandAllowedBySignedPacks(command)) {
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
  if (bridgeState.enabled) {
    try {
      startBridgeServer()
    } catch {
      bridgeState.enabled = false
      bridgeState.updatedAt = new Date().toISOString()
      saveDomainStates()
    }
  }

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
    const valid = isAdminCodewordValid(codeword)
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

  ipcMain.handle('paxion:learning:sttStatus', async () => {
    const toolchain = await detectSttToolchain()
    const ytDlp = toolchain.ytDlp
    const ffmpeg = toolchain.ffmpeg
    const whisper = toolchain.whisper

    return {
      ok: true,
      ready: toolchain.ready,
      tools: {
        ytDlp: ytDlp
          ? { available: true, command: ytDlp.displayCommand, detail: ytDlp.detail }
          : { available: false, command: null, detail: 'yt-dlp not found' },
        ffmpeg: ffmpeg
          ? { available: true, command: ffmpeg.displayCommand, detail: ffmpeg.detail }
          : { available: false, command: null, detail: 'ffmpeg not found' },
        whisper: whisper
          ? { available: true, command: whisper.displayCommand, detail: whisper.detail }
          : { available: false, command: null, detail: 'whisper not found' },
      },
      updatedAt: new Date().toISOString(),
    }
  })

  ipcMain.handle('paxion:learning:youtubeSegmentOpen', async (_event, input) => {
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

  function cleanupTempDirSafe(dirPath) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true })
    } catch {
      // Ignore cleanup failures for temp directory.
    }
  }

  function findTranscriptFileInDir(dirPath) {
    try {
      const entries = fs.readdirSync(dirPath)
      const txt = entries.find((name) => String(name || '').toLowerCase().endsWith('.txt'))
      return txt ? path.join(dirPath, txt) : null
    } catch {
      return null
    }
  }

  function buildSttPythonCandidates() {
    const candidates = []
    const seen = new Set()

    const pushIfExists = (exePath) => {
      const normalized = String(exePath || '').trim()
      if (!normalized || seen.has(normalized)) return
      if (fs.existsSync(normalized)) {
        seen.add(normalized)
        candidates.push({ command: normalized, prefixArgs: [] })
      }
    }

    // Preferred: development venvs near current app/workspace runtime.
    pushIfExists(path.resolve(__dirname, '..', '.venv', 'Scripts', 'python.exe'))
    pushIfExists(path.join(app.getAppPath(), '.venv', 'Scripts', 'python.exe'))
    pushIfExists(path.join(process.cwd(), '.venv', 'Scripts', 'python.exe'))

    // Preferred: common per-user Windows Python installs.
    const home = app.getPath('home')
    const commonVersions = ['Python311', 'Python312', 'Python310', 'Python39']
    for (const versionDir of commonVersions) {
      pushIfExists(path.join(home, 'AppData', 'Local', 'Programs', 'Python', versionDir, 'python.exe'))
    }

    // Finally try PATH-based launchers.
    candidates.push({ command: 'python', prefixArgs: [] })
    candidates.push({ command: 'py', prefixArgs: ['-3'] })

    return candidates
  }

  async function detectBinaryCandidateStrict(candidates) {
    for (const candidate of candidates) {
      const probe = await executeSpawn(candidate.command, candidate.probeArgs || ['--version'], {
        timeoutMs: 5000,
      })
      if (probe.spawnError || probe.exitCode !== 0) {
        continue
      }
      return {
        command: candidate.command,
        prefixArgs: Array.isArray(candidate.prefixArgs) ? candidate.prefixArgs : [],
        displayCommand: [candidate.command, ...(candidate.prefixArgs || [])].join(' '),
        detail: firstMeaningfulLine(probe.stdout || probe.stderr) || 'available',
      }
    }
    return null
  }

  async function detectPythonModuleCandidateStrict(moduleName) {
    const pythonCandidates = buildSttPythonCandidates()
    for (const candidate of pythonCandidates) {
      const probe = await executeSpawn(candidate.command, [...candidate.prefixArgs, '-c', `import ${moduleName}; print('ok')`], {
        timeoutMs: 5000,
      })
      if (probe.spawnError || probe.exitCode !== 0) {
        continue
      }
      return {
        command: candidate.command,
        prefixArgs: [...candidate.prefixArgs, '-m', moduleName],
        displayCommand: [candidate.command, ...candidate.prefixArgs, '-m', moduleName].join(' '),
        detail: `python module ${moduleName} available`,
      }
    }
    return null
  }

  async function detectSttToolchain() {
    const ytDlpBinary = await detectBinaryCandidateStrict([
      { command: 'yt-dlp', probeArgs: ['--version'], prefixArgs: [] },
    ])
    const ytDlpModule = ytDlpBinary ? null : await detectPythonModuleCandidateStrict('yt_dlp')
    const ytDlp = ytDlpBinary || ytDlpModule

    const ffmpeg = await detectBinaryCandidateStrict([
      { command: 'ffmpeg', probeArgs: ['-version'], prefixArgs: [] },
    ])

    const whisperBinary = await detectBinaryCandidateStrict([
      { command: 'whisper', probeArgs: ['--version'], prefixArgs: [] },
    ])
    const whisperModule = whisperBinary ? null : await detectPythonModuleCandidateStrict('whisper')
    const whisper = whisperBinary || whisperModule

    return {
      ytDlp,
      ffmpeg,
      whisper,
      ready: Boolean(ytDlp && ffmpeg && whisper),
    }
  }

  async function transcribeYoutubeWithLocalStt(videoUrl, options = {}) {
    const toolchain = await detectSttToolchain()
    const ytdlp = toolchain.ytDlp
    if (!ytdlp) {
      return {
        ok: false,
        reason: 'Local STT fallback requires yt-dlp. Install yt-dlp to enable captionless YouTube learning.',
      }
    }

    const ffmpeg = toolchain.ffmpeg
    if (!ffmpeg) {
      return {
        ok: false,
        reason: 'Local STT fallback requires ffmpeg in PATH.',
      }
    }

    const whisper = toolchain.whisper
    if (!whisper) {
      return {
        ok: false,
        reason: 'Local STT fallback requires whisper CLI (`whisper` or `python -m whisper`).',
      }
    }

    const tmpDir = fs.mkdtempSync(path.join(app.getPath('temp'), 'paxion-yt-stt-'))
    try {
      const outputTemplate = path.join(tmpDir, 'audio.%(ext)s')
      const downloadArgs = [
        ...ytdlp.prefixArgs,
        '--no-playlist',
        '-f',
        'bestaudio/best',
        '-o',
        outputTemplate,
      ]

      const startSec = Number(options.startSec)
      const endSec = Number(options.endSec)
      if (Number.isFinite(startSec) && Number.isFinite(endSec) && endSec > startSec) {
        downloadArgs.push('--download-sections', `*${Math.max(0, Math.floor(startSec))}-${Math.max(1, Math.ceil(endSec))}`)
      }

      downloadArgs.push(videoUrl)

      const download = await executeSpawn(ytdlp.command, downloadArgs, {
        cwd: tmpDir,
        timeoutMs: 240000,
      })
      if (!download.ok) {
        return {
          ok: false,
          reason: firstMeaningfulLine(download.stderr || download.stdout)
            || 'yt-dlp failed while downloading audio for transcription.',
        }
      }

      const sourceAudio = (() => {
        try {
          const files = fs.readdirSync(tmpDir)
          const found = files.find((name) => /^audio\./i.test(String(name || '')) && !String(name).endsWith('.part'))
          return found ? path.join(tmpDir, found) : null
        } catch {
          return null
        }
      })()

      if (!sourceAudio) {
        return {
          ok: false,
          reason: 'Audio download completed but output file was not found.',
        }
      }

      const wavPath = path.join(tmpDir, 'audio.wav')
      const convert = await executeSpawn(ffmpeg.command, [
        ...ffmpeg.prefixArgs,
        '-y',
        '-i',
        sourceAudio,
        '-vn',
        '-ac',
        '1',
        '-ar',
        '16000',
        wavPath,
      ], {
        cwd: tmpDir,
        timeoutMs: 180000,
      })
      if (!convert.ok) {
        return {
          ok: false,
          reason: firstMeaningfulLine(convert.stderr || convert.stdout)
            || 'ffmpeg failed while converting audio for transcription.',
        }
      }

      const transcribe = await executeSpawn(whisper.command, [
        ...whisper.prefixArgs,
        wavPath,
        '--task',
        'transcribe',
        '--model',
        'base',
        '--language',
        'en',
        '--output_format',
        'txt',
        '--output_dir',
        tmpDir,
        '--verbose',
        'False',
      ], {
        cwd: tmpDir,
        timeoutMs: 420000,
      })
      if (!transcribe.ok) {
        return {
          ok: false,
          reason: firstMeaningfulLine(transcribe.stderr || transcribe.stdout)
            || 'Whisper failed while transcribing downloaded audio.',
        }
      }

      const transcriptPath = findTranscriptFileInDir(tmpDir)
      if (!transcriptPath) {
        return {
          ok: false,
          reason: 'Whisper completed but no transcript file was produced.',
        }
      }

      const text = normalizeIngestedText(fs.readFileSync(transcriptPath, 'utf8'))
      if (text.length < 120) {
        return {
          ok: false,
          reason: 'Local STT transcript is too short for reliable learning.',
        }
      }

      return {
        ok: true,
        mode: 'local-stt',
        text,
      }
    } finally {
      cleanupTempDirSafe(tmpDir)
    }
  }

  ipcMain.handle('paxion:learning:youtubeSegmentAutoLearn', async (_event, input) => {
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

    const videoId = extractYoutubeVideoId(plan.videoUrl)
    if (!videoId) {
      return {
        ok: false,
        reason: 'Invalid YouTube URL for this plan.',
      }
    }

    let learnedText = ''
    let learnMode = 'caption-transcript'
    try {
      const rows = await fetchYoutubeTranscriptRows(videoId)
      const startSec = Math.max(0, Math.floor(Number(segment.startMinute || 0) * 60))
      const endSec = Math.max(startSec + 1, Math.ceil(Number(segment.endMinute || 0) * 60))

      const segmentRows = rows.filter((row) => {
        const sec = Number(row?.start || 0)
        return sec >= startSec && sec < endSec
      })

      const text = normalizeIngestedText(segmentRows.map((row) => String(row?.text || '').trim()).join(' '))
      if (text.length < 120) {
        const sttFallback = await transcribeYoutubeWithLocalStt(plan.videoUrl, { startSec, endSec })
        if (!sttFallback.ok) {
          return {
            ok: false,
            reason: `Transcript content too short, and STT fallback failed: ${sttFallback.reason}`,
          }
        }
        learnedText = sttFallback.text
        learnMode = 'local-stt'
      } else {
        learnedText = text
      }

      const docName = `YouTube AI Learned: ${plan.topic} [${segment.label}]`
      const content = [
        `Source URL: ${plan.videoUrl}`,
        `Video ID: ${videoId}`,
        `Segment: ${segment.label} (${startSec}s-${endSec}s)`,
        `Learning mode: ${learnMode}`,
        '',
        learnedText,
      ].join('\n')

      segment.status = 'learned'
      segment.notes = `AI auto-learned via ${learnMode} (${Math.ceil(learnedText.length / 5)} chars processed).`
      learningState.updatedAt = new Date().toISOString()
      saveLearningState()

      const inferred = inferSkills(`${plan.topic}\n${segment.label}\n${learnedText}`)
      appendLearningLog({
        title: `AI auto-learned YouTube segment: ${plan.topic} (${segment.label})`,
        detail: `Segment consumed by AI using ${learnMode} and queued into Library knowledge memory.`,
        source: 'youtube-segment-auto-learn',
        newSkills: ['Video Transcript Learning', 'Speech-to-Text Learning', ...inferred],
      })

      return {
        ok: true,
        segmentLabel: segment.label,
        docName,
        content,
        videoPlans: learningState.videoPlans,
        skills: learningState.skills,
        updatedAt: learningState.updatedAt,
      }
    } catch (err) {
      const startSec = Math.max(0, Math.floor(Number(segment.startMinute || 0) * 60))
      const endSec = Math.max(startSec + 1, Math.ceil(Number(segment.endMinute || 0) * 60))
      const sttFallback = await transcribeYoutubeWithLocalStt(plan.videoUrl, { startSec, endSec })
      if (!sttFallback.ok) {
        return {
          ok: false,
          reason: `Could not auto-learn this segment: ${err.message}. STT fallback failed: ${sttFallback.reason}`,
        }
      }

      const docName = `YouTube AI Learned: ${plan.topic} [${segment.label}]`
      const content = [
        `Source URL: ${plan.videoUrl}`,
        `Video ID: ${videoId}`,
        `Segment: ${segment.label} (${startSec}s-${endSec}s)`,
        'Learning mode: local-stt',
        '',
        sttFallback.text,
      ].join('\n')

      segment.status = 'learned'
      segment.notes = `AI auto-learned via local-stt (${Math.ceil(sttFallback.text.length / 5)} chars processed).`
      learningState.updatedAt = new Date().toISOString()
      saveLearningState()

      const inferred = inferSkills(`${plan.topic}\n${segment.label}\n${sttFallback.text}`)
      appendLearningLog({
        title: `AI auto-learned YouTube segment: ${plan.topic} (${segment.label})`,
        detail: 'Segment consumed by AI using local speech-to-text fallback.',
        source: 'youtube-segment-auto-learn',
        newSkills: ['Video Transcript Learning', 'Speech-to-Text Learning', ...inferred],
      })

      return {
        ok: true,
        segmentLabel: segment.label,
        docName,
        content,
        videoPlans: learningState.videoPlans,
        skills: learningState.skills,
        updatedAt: learningState.updatedAt,
      }
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
    const query = String(input?.query || '').trim()
    if (!query) {
      return {
        ok: false,
        reason: 'Chat query is required.',
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

  ipcMain.handle('paxion:voice:call', async (_event, input) => {
    if (capabilityState.emergencyCallRelay === false) {
      return {
        ok: false,
        reason: 'Emergency call relay capability is disabled in Access tab.',
      }
    }

    const number = String(input?.number || '').trim()
    const contact = String(input?.contact || '').trim()
    const emergency = Boolean(input?.emergency)

    if (!number && !contact) {
      return {
        ok: false,
        reason: 'Provide a phone number or contact name.',
      }
    }

    const adminActive = isAdminUnlocked(adminSession)
    if (!adminActive && !emergency) {
      return {
        ok: false,
        reason: 'Admin session required for non-emergency call relay.',
      }
    }

    const provider = String(input?.provider || callProviderState.provider || 'desktop-relay').trim()
    let providerResult = null

    if (provider === 'twilio' && number) {
      const secrets = loadVoiceSecrets()
      providerResult = await callViaTwilio({
        toNumber: number,
        fromNumber: String(input?.fromNumber || callProviderState.fromNumber || secrets.twilioFromNumber || ''),
        accountSid: secrets.twilioAccountSid,
        authToken: secrets.twilioAuthToken,
        message: String(input?.message || (emergency ? 'Emergency call initiated by Paxion.' : 'Paxion call initiated.')),
      })
      if (!providerResult?.ok) {
        return {
          ok: false,
          reason: providerResult?.reason || 'Twilio call could not be placed.',
        }
      }
    } else if (provider === 'sip' && number) {
      const normalizedSip = normalizePhoneNumber(number)
      if (!normalizedSip) {
        return {
          ok: false,
          reason: 'Phone number format is invalid for SIP call.',
        }
      }
      const sipUrl = `sip:${normalizedSip.replace(/^\+/, '')}`
      await shell.openExternal(sipUrl)
      providerResult = {
        ok: true,
        provider: 'sip',
        status: 'initiated',
        url: sipUrl,
      }
    } else {
      let url = ''
      if (number) {
        const normalized = normalizePhoneNumber(number)
        if (!normalized) {
          return {
            ok: false,
            reason: 'Phone number format is invalid.',
          }
        }
        url = `tel:${normalized}`
      } else {
        const query = encodeURIComponent(`call ${contact} phone number`)
        url = `https://www.google.com/search?q=${query}`
      }
      await shell.openExternal(url)
      providerResult = {
        ok: true,
        provider: 'desktop-relay',
        status: 'initiated',
        url,
      }
    }

    appendAuditEntry('action_result', {
      actionId: 'voice.callRelay',
      status: 'allowed',
      reason: emergency ? 'Emergency voice relay initiated.' : 'Voice call relay initiated.',
      target: number || contact,
      emergency,
      provider,
      providerResult,
    })

    return {
      ok: true,
      emergency,
      provider,
      providerResult,
      reason: number
        ? provider === 'twilio'
          ? 'Placed provider-backed voice call via Twilio.'
          : provider === 'sip'
            ? 'Opened SIP dial target in your system client.'
            : 'Opened your system dialer with the requested number.'
        : 'Opened contact call lookup in browser (desktop relay mode).',
    }
  })

  ipcMain.handle('paxion:voice:provider:get', () => {
    return {
      ok: true,
      provider: callProviderState.provider,
      fromNumber: callProviderState.fromNumber,
      updatedAt: callProviderState.updatedAt,
    }
  })

  ipcMain.handle('paxion:voice:provider:set', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to update call provider.' }
    }
    const provider = String(input?.provider || '').trim().toLowerCase()
    if (!['desktop-relay', 'twilio', 'sip'].includes(provider)) {
      return { ok: false, reason: 'Provider must be desktop-relay, twilio, or sip.' }
    }
    callProviderState = {
      provider,
      fromNumber: normalizePhoneNumber(input?.fromNumber || ''),
      updatedAt: new Date().toISOString(),
    }
    saveDomainStates()
    return { ok: true, provider: callProviderState.provider, fromNumber: callProviderState.fromNumber, updatedAt: callProviderState.updatedAt }
  })

  ipcMain.handle('paxion:voice:secrets:get', () => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to read provider secret status.' }
    }
    const secrets = loadVoiceSecrets()
    return {
      ok: true,
      hasTwilioSid: Boolean(secrets.twilioAccountSid),
      hasTwilioToken: Boolean(secrets.twilioAuthToken),
      hasTwilioFromNumber: Boolean(secrets.twilioFromNumber),
      hasSipUri: Boolean(secrets.sipUri),
      hasSipUsername: Boolean(secrets.sipUsername),
      hasSipPassword: Boolean(secrets.sipPassword),
      twilioFromNumber: secrets.twilioFromNumber,
      sipUri: secrets.sipUri,
      sipUsername: secrets.sipUsername,
      updatedAt: voiceSecretState.updatedAt,
    }
  })

  ipcMain.handle('paxion:voice:secrets:set', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to update provider secrets.' }
    }

    const nextSecrets = {
      twilioAccountSid: String(input?.twilioAccountSid || ''),
      twilioAuthToken: String(input?.twilioAuthToken || ''),
      twilioFromNumber: normalizePhoneNumber(input?.twilioFromNumber || ''),
      sipUri: String(input?.sipUri || ''),
      sipUsername: String(input?.sipUsername || ''),
      sipPassword: String(input?.sipPassword || ''),
    }
    const encrypted = encryptAtRest(JSON.stringify(nextSecrets))
    if (!encrypted.ok) {
      return { ok: false, reason: encrypted.reason }
    }

    voiceSecretState = {
      ciphertext: encrypted.payload,
      updatedAt: new Date().toISOString(),
    }
    saveDomainStates()
    return {
      ok: true,
      updatedAt: voiceSecretState.updatedAt,
      twilioFromNumber: nextSecrets.twilioFromNumber,
      sipUri: nextSecrets.sipUri,
      sipUsername: nextSecrets.sipUsername,
    }
  })

  ipcMain.handle('paxion:terminal:pack:list', () => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to view terminal command packs.', packs: [] }
    }
    return {
      ok: true,
      packs: Array.isArray(terminalPackState.packs) ? terminalPackState.packs : [],
      updatedAt: terminalPackState.updatedAt,
    }
  })

  ipcMain.handle('paxion:terminal:pack:create', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to create command packs.' }
    }

    ensureAttestationState()
    const commands = Array.isArray(input?.commands)
      ? input.commands.map((x) => String(x || '').trim()).filter(Boolean)
      : []
    if (commands.length === 0) {
      return { ok: false, reason: 'At least one command is required.' }
    }

    const pack = {
      id: `pack-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: String(input?.name || 'Custom Command Pack').trim() || 'Custom Command Pack',
      commands: Array.from(new Set(commands)),
      active: Boolean(input?.active),
      createdAt: new Date().toISOString(),
      policySnapshotHash: buildPolicySnapshotHash(),
      signature: '',
      signerFingerprint: attestationState.publicKeyFingerprint,
    }

    const signature = crypto.sign(
      null,
      Buffer.from(getTerminalPackSigningPayload(pack), 'utf8'),
      attestationState.privateKeyPem,
    )
    pack.signature = signature.toString('base64')

    terminalPackState = {
      packs: [...(Array.isArray(terminalPackState.packs) ? terminalPackState.packs : []), pack].slice(-80),
      updatedAt: new Date().toISOString(),
    }
    saveDomainStates()

    appendAuditEntry('action_result', {
      actionId: 'terminal.pack.create',
      status: 'allowed',
      reason: `Created signed terminal command pack ${pack.name}.`,
      packId: pack.id,
      commandCount: pack.commands.length,
    })

    return { ok: true, pack, packs: terminalPackState.packs, updatedAt: terminalPackState.updatedAt }
  })

  ipcMain.handle('paxion:terminal:pack:simulate', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to simulate command pack policy.' }
    }
    const commands = Array.isArray(input?.commands)
      ? input.commands.map((x) => String(x || '').trim()).filter(Boolean)
      : []
    const simulation = commands.map((command) => ({
      command,
      allowedByStaticPolicy: TOOL_COMMAND_ALLOWLIST.has(command),
      requiresSignedPack: !TOOL_COMMAND_ALLOWLIST.has(command),
      assessed: assessTerminalCommand(command),
    }))
    const riskScore = simulation.reduce((acc, item) => acc + (item.allowedByStaticPolicy ? 4 : item.assessed.allowed ? 18 : 35), 0)
    return {
      ok: true,
      simulation: {
        commands: simulation,
        riskScore: Math.min(100, riskScore),
        recommendation: riskScore > 70 ? 'needs-review' : 'can-sign',
      },
    }
  })

  ipcMain.handle('paxion:terminal:pack:activate', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to change command pack activation.' }
    }
    const packId = String(input?.packId || '').trim()
    const active = Boolean(input?.active)
    let changed = null
    const packs = (Array.isArray(terminalPackState.packs) ? terminalPackState.packs : []).map((pack) => {
      if (pack.id !== packId) {
        return pack
      }
      changed = {
        ...pack,
        active,
      }
      return changed
    })

    if (!changed) {
      return { ok: false, reason: 'Command pack not found.', packs: terminalPackState.packs }
    }

    terminalPackState = {
      packs,
      updatedAt: new Date().toISOString(),
    }
    saveDomainStates()
    return { ok: true, pack: changed, packs: terminalPackState.packs, updatedAt: terminalPackState.updatedAt }
  })

  function cleanupBridgePendingRequests() {
    const now = Date.now()
    const rows = Array.isArray(bridgeState.pendingRequests) ? bridgeState.pendingRequests : []
    bridgeState.pendingRequests = rows.filter((row) => Number(row?.expiresAt || 0) > now)
  }

  function cleanupBridgeOneTimeTokens() {
    const rows = Array.isArray(advancedState.relay?.oneTimeTokens) ? advancedState.relay.oneTimeTokens : []
    const now = Date.now()
    advancedState = {
      ...advancedState,
      relay: {
        ...(advancedState.relay || {}),
        oneTimeTokens: rows.filter((row) => !row.used && Number(row.expiresAt || 0) > now),
        updatedAt: new Date().toISOString(),
      },
    }
  }

  function readBridgeBody(req) {
    return new Promise((resolve) => {
      let raw = ''
      req.on('data', (chunk) => {
        raw += String(chunk || '')
      })
      req.on('end', () => {
        try {
          resolve(JSON.parse(raw || '{}'))
        } catch {
          resolve({})
        }
      })
      req.on('error', () => resolve({}))
    })
  }

  function writeBridgeJson(res, statusCode, payload) {
    res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(payload))
  }

  function stopBridgeServer() {
    if (bridgeServer) {
      try {
        bridgeServer.close()
      } catch {
        // noop
      }
      bridgeServer = null
    }
  }

  function startBridgeServer() {
    stopBridgeServer()
    bridgeServer = http.createServer(async (req, res) => {
      const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
      if (req.method === 'GET' && urlObj.pathname === '/api/bridge/ping') {
        writeBridgeJson(res, 200, { ok: true, name: 'paxion-bridge' })
        return
      }

      if (req.method === 'POST' && urlObj.pathname === '/api/bridge/command') {
        const body = await readBridgeBody(req)
        if (String(body?.secret || '') !== String(bridgeState.secret || '')) {
          const oneTimeToken = String(body?.oneTimeToken || '')
          if (!oneTimeToken) {
            writeBridgeJson(res, 401, { ok: false, reason: 'Invalid bridge secret.' })
            return
          }
          cleanupBridgeOneTimeTokens()
          const consumed = consumeOneTimeToken(advancedState.relay || {}, oneTimeToken)
          advancedState = {
            ...advancedState,
            relay: consumed.state,
          }
          saveDomainStates()
          if (!consumed.valid) {
            writeBridgeJson(res, 401, { ok: false, reason: 'Bridge one-time token invalid or expired.' })
            return
          }
        }
        const remoteRequest = body?.request
        if (!remoteRequest || typeof remoteRequest.actionId !== 'string') {
          writeBridgeJson(res, 400, { ok: false, reason: 'Invalid action request payload.' })
          return
        }
        const ticket = issueApprovalTicket(remoteRequest.actionId)
        const pending = {
          id: `bridge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          createdAt: Date.now(),
          expiresAt: Date.now() + APPROVAL_TTL_MS,
          status: 'pending',
          source: {
            ip: String(req.socket?.remoteAddress || ''),
            userAgent: String(req.headers['user-agent'] || ''),
          },
          request: remoteRequest,
          approvalTicketId: ticket.id,
          result: null,
        }
        cleanupBridgePendingRequests()
        bridgeState.pendingRequests = [...(bridgeState.pendingRequests || []), pending].slice(-120)
        bridgeState.updatedAt = new Date().toISOString()
        saveDomainStates()
        writeBridgeJson(res, 200, {
          ok: true,
          requestId: pending.id,
          status: pending.status,
          expiresAt: pending.expiresAt,
        })
        return
      }

      if (req.method === 'GET' && urlObj.pathname === '/api/bridge/request') {
        const secret = String(urlObj.searchParams.get('secret') || '')
        const requestId = String(urlObj.searchParams.get('id') || '')
        if (secret !== String(bridgeState.secret || '')) {
          writeBridgeJson(res, 401, { ok: false, reason: 'Invalid bridge secret.' })
          return
        }
        cleanupBridgePendingRequests()
        const row = (bridgeState.pendingRequests || []).find((x) => x.id === requestId)
        if (!row) {
          writeBridgeJson(res, 404, { ok: false, reason: 'Request not found.' })
          return
        }
        writeBridgeJson(res, 200, {
          ok: true,
          request: {
            id: row.id,
            status: row.status,
            createdAt: row.createdAt,
            expiresAt: row.expiresAt,
            result: row.result,
          },
        })
        return
      }

      writeBridgeJson(res, 404, { ok: false, reason: 'Bridge route not found.' })
    })

    bridgeServer.listen(Number(bridgeState.port || 8731), String(bridgeState.host || '0.0.0.0'))
  }

  ipcMain.handle('paxion:bridge:status', () => {
    cleanupBridgePendingRequests()
    return {
      ok: true,
      enabled: Boolean(bridgeState.enabled),
      host: bridgeState.host,
      port: bridgeState.port,
      hasSecret: Boolean(bridgeState.secret),
      pendingRequests: bridgeState.pendingRequests || [],
      updatedAt: bridgeState.updatedAt,
    }
  })

  ipcMain.handle('paxion:bridge:start', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to start mobile bridge.' }
    }
    const host = String(input?.host || '0.0.0.0').trim() || '0.0.0.0'
    const port = Math.max(1024, Math.min(65535, Number(input?.port || 8731)))
    const secret = String(input?.secret || '').trim() || crypto.randomBytes(16).toString('hex')
    bridgeState = {
      ...bridgeState,
      enabled: true,
      host,
      port,
      secret,
      updatedAt: new Date().toISOString(),
    }
    startBridgeServer()
    saveDomainStates()
    return {
      ok: true,
      enabled: bridgeState.enabled,
      host: bridgeState.host,
      port: bridgeState.port,
      secret: bridgeState.secret,
      updatedAt: bridgeState.updatedAt,
    }
  })

  ipcMain.handle('paxion:bridge:rotateSecret', () => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to rotate bridge secret.' }
    }
    bridgeState = {
      ...bridgeState,
      secret: crypto.randomBytes(16).toString('hex'),
      updatedAt: new Date().toISOString(),
    }
    saveDomainStates()
    return {
      ok: true,
      secret: bridgeState.secret,
      updatedAt: bridgeState.updatedAt,
    }
  })

  ipcMain.handle('paxion:bridge:issueToken', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to issue one-time bridge token.' }
    }
    const issued = issueOneTimeToken(advancedState.relay || {}, input)
    advancedState = {
      ...advancedState,
      relay: issued.state,
    }
    saveDomainStates()
    return {
      ok: true,
      token: issued.token,
    }
  })

  ipcMain.handle('paxion:bridge:stop', () => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to stop mobile bridge.' }
    }
    stopBridgeServer()
    bridgeState = {
      ...bridgeState,
      enabled: false,
      updatedAt: new Date().toISOString(),
    }
    saveDomainStates()
    return {
      ok: true,
      enabled: bridgeState.enabled,
      updatedAt: bridgeState.updatedAt,
    }
  })

  ipcMain.handle('paxion:bridge:approve', async (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to approve bridge command.' }
    }
    const requestId = String(input?.requestId || '').trim()
    const approved = Boolean(input?.approved)
    const adminCodeword = String(input?.adminCodeword || '')
    if (!isCodewordValid(adminCodeword)) {
      return { ok: false, reason: 'Invalid admin codeword for bridge approval.' }
    }

    const rows = Array.isArray(bridgeState.pendingRequests) ? bridgeState.pendingRequests : []
    const idx = rows.findIndex((row) => row.id === requestId)
    if (idx < 0) {
      return { ok: false, reason: 'Bridge request not found.' }
    }
    const row = rows[idx]
    if (!consumeApprovalTicket(row.approvalTicketId, row.request?.actionId)) {
      return { ok: false, reason: 'Bridge approval ticket expired or invalid.' }
    }

    if (!approved) {
      row.status = 'rejected'
      row.result = { ok: false, reason: 'Rejected by admin.' }
      bridgeState.pendingRequests[idx] = row
      bridgeState.updatedAt = new Date().toISOString()
      saveDomainStates()
      return { ok: true, request: row }
    }

    const decision = decideRequest(row.request, adminCodeword)
    if (!decision?.finalDecision?.allowed) {
      row.status = 'denied'
      row.result = {
        ok: false,
        reason: decision?.finalDecision?.reason || 'Denied by policy.',
        decision,
      }
      bridgeState.pendingRequests[idx] = row
      bridgeState.updatedAt = new Date().toISOString()
      saveDomainStates()
      return { ok: true, request: row }
    }

    const execution = await executeAllowedAction(row.request)
    row.status = execution?.executed ? 'executed' : 'failed'
    row.result = {
      ok: Boolean(execution?.executed),
      execution,
      decision,
    }
    bridgeState.pendingRequests[idx] = row
    bridgeState.updatedAt = new Date().toISOString()
    saveDomainStates()
    return { ok: true, request: row }
  })

  ipcMain.handle('paxion:security:threatDashboard', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to view threat dashboard.' }
    }
    return buildThreatDashboard(input)
  })

  ipcMain.handle('paxion:governance:simulatePolicyDiff', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required for policy diff simulation.' }
    }
    const result = simulatePolicyDiff(input)
    advancedState.governance.policySimulations = [...advancedState.governance.policySimulations, result.simulation].slice(-60)
    advancedState.governance.updatedAt = new Date().toISOString()
    saveDomainStates()
    return result
  })

  ipcMain.handle('paxion:governance:buildCanaryPlan', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required for canary planning.' }
    }
    const result = buildCanaryPlan(input)
    advancedState.governance.canaries = [...advancedState.governance.canaries, result.canary].slice(-60)
    advancedState.governance.updatedAt = new Date().toISOString()
    saveDomainStates()
    return result
  })

  ipcMain.handle('paxion:governance:checkAnomalies', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required for anomaly analysis.' }
    }
    const result = detectAnomalyRollback(input)
    advancedState.governance.anomalies = [...advancedState.governance.anomalies, result.anomaly].slice(-120)
    advancedState.governance.updatedAt = new Date().toISOString()
    saveDomainStates()
    return result
  })

  ipcMain.handle('paxion:broker:configure', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to configure live broker.' }
    }
    const result = configureBroker(advancedState.broker, input)
    advancedState.broker = result.state
    saveDomainStates()
    return result
  })

  ipcMain.handle('paxion:broker:previewOrder', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to preview live order.' }
    }
    return previewLiveOrder(input)
  })

  ipcMain.handle('paxion:broker:executeOrder', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to execute live order.' }
    }
    const result = executeBrokerOrder(advancedState.broker, input)
    advancedState.broker = result.state
    saveDomainStates()
    return result
  })

  ipcMain.handle('paxion:clinical:buildEvidence', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required for clinical evidence generation.' }
    }
    const result = buildClinicalEvidence(input)
    advancedState.clinical.evidence = [...advancedState.clinical.evidence, result.evidence].slice(-120)
    advancedState.clinical.updatedAt = new Date().toISOString()
    saveDomainStates()
    return result
  })

  ipcMain.handle('paxion:clinical:validateEvidence', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required for clinical evidence validation.' }
    }
    const result = validateExternalEvidence(input)
    advancedState.clinical.validations = [...advancedState.clinical.validations, result.validation].slice(-120)
    advancedState.clinical.updatedAt = new Date().toISOString()
    saveDomainStates()
    return result
  })

  ipcMain.handle('paxion:science:theoremPlan', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required for theorem planning.' }
    }
    const result = buildTheoremPlan(input)
    advancedState.science.theoremPlans = [...advancedState.science.theoremPlans, result.theoremPlan].slice(-120)
    advancedState.science.updatedAt = new Date().toISOString()
    saveDomainStates()
    return result
  })

  ipcMain.handle('paxion:science:simulationPlan', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required for simulation planning.' }
    }
    const result = buildSimulationPlan(input)
    advancedState.science.simulationPlans = [...advancedState.science.simulationPlans, result.simulationPlan].slice(-120)
    advancedState.science.updatedAt = new Date().toISOString()
    saveDomainStates()
    return result
  })

  ipcMain.handle('paxion:science:researchProgram', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required for research program synthesis.' }
    }
    const result = synthesizeResearchProgram(input)
    advancedState.science.programs = [...advancedState.science.programs, result.program].slice(-120)
    advancedState.science.updatedAt = new Date().toISOString()
    saveDomainStates()
    return result
  })

  ipcMain.handle('paxion:voiceQuality:status', () => {
    return { ok: true, state: advancedState.voiceQuality }
  })

  ipcMain.handle('paxion:voiceQuality:update', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to update voice quality profile.' }
    }
    const result = updateVoiceQuality(advancedState.voiceQuality, input)
    advancedState.voiceQuality = result.state
    saveDomainStates()
    return result
  })

  ipcMain.handle('paxion:voiceQuality:evaluate', (_event, input) => {
    return evaluateDuplexSession(input)
  })

  ipcMain.handle('paxion:optimization:status', () => {
    return {
      ok: true,
      optimization: advancedState.optimization || {
        reports: [],
        lastRunAt: null,
        autoTune: true,
        updatedAt: null,
      },
    }
  })

  ipcMain.handle('paxion:optimization:run', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to run weekly optimization.' }
    }
    const result = runWeeklyOptimization(advancedState, {
      autoTune: input?.autoTune,
      falseWakeCount: input?.falseWakeCount,
      missedWakeCount: input?.missedWakeCount,
    })
    advancedState = result.state
    saveDomainStates()
    return {
      ok: true,
      report: result.report,
      optimization: advancedState.optimization,
      state: {
        voiceQuality: advancedState.voiceQuality,
        wakeword: advancedState.wakeword,
        relay: advancedState.relay,
      },
    }
  })

  ipcMain.handle('paxion:relay:status', () => {
    const relaySecrets = loadRelaySecrets()
    return {
      ok: true,
      relay: {
        ...(advancedState.relay || {}),
        config: {
          ...(advancedState.relay?.config || {}),
          tokenConfigured: Boolean(relaySecrets.cloudToken),
        },
      },
    }
  })

  ipcMain.handle('paxion:relay:configure', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to configure secure relay.' }
    }
    if (Object.prototype.hasOwnProperty.call(input || {}, 'token') || input?.clearToken) {
      const encrypted = encryptAtRest(
        JSON.stringify({
          cloudToken: input?.clearToken ? '' : String(input?.token || ''),
        }),
      )
      if (!encrypted.ok) {
        return { ok: false, reason: encrypted.reason }
      }
      relaySecretState = {
        ciphertext: encrypted.payload,
        updatedAt: new Date().toISOString(),
      }
    }
    advancedState.relay = {
      ...(advancedState.relay || {}),
      config: {
        mode: String(input?.mode || 'disabled').trim() || 'disabled',
        endpoint: String(input?.endpoint || '').trim(),
        deviceId: String(input?.deviceId || advancedState?.relay?.config?.deviceId || 'paxion-primary').trim() || 'paxion-primary',
        pollingEnabled: Boolean(input?.pollingEnabled),
      },
      updatedAt: new Date().toISOString(),
    }
    saveDomainStates()
    return {
      ok: true,
      relay: {
        ...advancedState.relay,
        config: {
          ...advancedState.relay.config,
          tokenConfigured: Boolean(loadRelaySecrets().cloudToken),
        },
      },
    }
  })

  ipcMain.handle('paxion:relay:submit', async (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to submit cloud relay request.' }
    }
    const relayConfig = advancedState?.relay?.config || {}
    const relaySecrets = loadRelaySecrets()
    if (String(relayConfig.mode || 'disabled') !== 'cloud') {
      return { ok: false, reason: 'Cloud relay mode is not enabled.' }
    }
    const result = await submitRelayRequest({
      endpoint: relayConfig.endpoint,
      token: relaySecrets.cloudToken,
      deviceId: relayConfig.deviceId,
      request: input?.request || null,
    }).catch((err) => ({ ok: false, reason: String(err?.message || err) }))
    if (!result?.ok) {
      return result
    }
    const requestRow = {
      id: String(result.requestId || ''),
      state: String(result.state || 'queued'),
      request: input?.request || null,
      createdAt: new Date().toISOString(),
      source: 'desktop-submit',
    }
    advancedState.relay = {
      ...(advancedState.relay || {}),
      requests: [...(advancedState.relay?.requests || []), requestRow].slice(-120),
      lastCloudSyncAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    saveDomainStates()
    return { ok: true, relay: advancedState.relay, request: requestRow }
  })

  ipcMain.handle('paxion:relay:sync', async () => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to sync cloud relay queue.' }
    }
    const relayConfig = advancedState?.relay?.config || {}
    const relaySecrets = loadRelaySecrets()
    if (String(relayConfig.mode || 'disabled') !== 'cloud') {
      return { ok: false, reason: 'Cloud relay mode is not enabled.' }
    }
    const result = await listPendingRelayRequests({
      endpoint: relayConfig.endpoint,
      token: relaySecrets.cloudToken,
      deviceId: relayConfig.deviceId,
    }).catch((err) => ({ ok: false, reason: String(err?.message || err) }))
    if (!result?.ok) {
      return result
    }
    advancedState.relay = {
      ...(advancedState.relay || {}),
      requests: Array.isArray(result.requests) ? result.requests.slice(-120) : [],
      lastCloudSyncAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    saveDomainStates()
    return { ok: true, relay: advancedState.relay }
  })

  ipcMain.handle('paxion:relay:complete', async (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to resolve cloud relay request.' }
    }
    const relayConfig = advancedState?.relay?.config || {}
    const relaySecrets = loadRelaySecrets()
    if (String(relayConfig.mode || 'disabled') !== 'cloud') {
      return { ok: false, reason: 'Cloud relay mode is not enabled.' }
    }
    const result = await completeRelayRequest({
      endpoint: relayConfig.endpoint,
      token: relaySecrets.cloudToken,
      requestId: input?.requestId,
      state: input?.state,
      result: input?.result,
    }).catch((err) => ({ ok: false, reason: String(err?.message || err) }))
    if (!result?.ok) {
      return result
    }
    const completedRequest = result.request || null
    const existingRows = Array.isArray(advancedState?.relay?.requests) ? advancedState.relay.requests : []
    const nextRows = existingRows
      .filter((row) => String(row?.id || '') !== String(input?.requestId || ''))
      .concat(completedRequest ? [completedRequest] : [])
      .slice(-120)
    advancedState.relay = {
      ...(advancedState.relay || {}),
      requests: nextRows,
      lastCloudSyncAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    saveDomainStates()
    return { ok: true, relay: advancedState.relay, request: completedRequest }
  })

  ipcMain.handle('paxion:relay:envelope', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to build relay envelope.' }
    }
    const result = buildRelayEnvelope(input)
    advancedState.relay = {
      ...(advancedState.relay || {}),
      envelopes: [...(advancedState.relay.envelopes || []), result.envelope].slice(-120),
      updatedAt: new Date().toISOString(),
    }
    saveDomainStates()
    return result
  })

  ipcMain.handle('paxion:wakeword:status', () => {
    return getNativeWakewordStatus(advancedState.wakeword)
  })

  ipcMain.handle('paxion:wakeword:configure', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to configure native wake-word adapter.' }
    }
    const result = configureWakewordAdapter(advancedState.wakeword, input)
    advancedState.wakeword = result.state
    saveDomainStates()
    return result
  })

  ipcMain.handle('paxion:planner:create', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to create long-horizon plan.' }
    }
    const result = createLongHorizonPlan(input)
    advancedState.planner.plans = [...advancedState.planner.plans, result.plan].slice(-120)
    advancedState.planner.updatedAt = new Date().toISOString()
    saveDomainStates()
    return result
  })

  ipcMain.handle('paxion:planner:advance', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to advance validation loop.' }
    }
    const result = advanceValidationLoop(advancedState.planner, input)
    advancedState.planner = result.state
    saveDomainStates()
    return result
  })

  ipcMain.handle('paxion:ecosystem:register', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to register device ecosystem adapter.' }
    }
    const result = registerEcosystemAdapter(advancedState.deviceEcosystem, input)
    advancedState.deviceEcosystem = result.state
    saveDomainStates()
    return result
  })

  ipcMain.handle('paxion:ecosystem:plan', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to plan device ecosystem action.' }
    }
    const result = planDeviceAction(input)
    advancedState.deviceEcosystem.actions = [...advancedState.deviceEcosystem.actions, result.deviceAction].slice(-120)
    advancedState.deviceEcosystem.updatedAt = new Date().toISOString()
    saveDomainStates()
    return result
  })

  ipcMain.handle('paxion:robotics:register', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to register actuator.' }
    }
    const result = registerActuator(advancedState.robotics, input)
    advancedState.robotics = result.state
    saveDomainStates()
    return result
  })

  ipcMain.handle('paxion:robotics:plan', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to plan actuation.' }
    }
    const result = buildActuationPlan(input)
    advancedState.robotics.plans = [...advancedState.robotics.plans, result.actuationPlan].slice(-120)
    advancedState.robotics.updatedAt = new Date().toISOString()
    saveDomainStates()
    return result
  })

  ipcMain.handle('paxion:vault:status', () => {
    return summarizeVaultProviders(advancedState.vault)
  })

  ipcMain.handle('paxion:vault:configure', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to configure vault provider.' }
    }
    const result = configureVaultProvider(advancedState.vault, input)
    advancedState.vault = result.state
    saveDomainStates()
    return result
  })

  ipcMain.handle('paxion:perception:sceneGraph', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required for multimodal scene graph generation.' }
    }
    const result = buildSceneGraph(input)
    advancedState.perception.sceneGraphs = [...advancedState.perception.sceneGraphs, result.sceneGraph].slice(-120)
    advancedState.perception.updatedAt = new Date().toISOString()
    saveDomainStates()
    return result
  })

  ipcMain.handle('paxion:perception:groundFrame', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required for realtime grounding.' }
    }
    const result = groundPerceptionFrame(input)
    advancedState.perception.frames = [...advancedState.perception.frames, result.frame].slice(-240)
    advancedState.perception.updatedAt = new Date().toISOString()
    saveDomainStates()
    return result
  })

  ipcMain.handle('paxion:workflow:generate', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required to generate AI workflows.' }
    }
    const result = generateWorkflow(input)
    appendLearningLog({
      title: `Workflow generated: ${String(result?.workflow?.goal || 'untitled')}`,
      detail: `Generated workflow with ${Array.isArray(result?.workflow?.steps) ? result.workflow.steps.length : 0} step(s).`,
      source: 'workflow-engine',
      newSkills: Array.isArray(result?.workflow?.skillTags) ? result.workflow.skillTags : [],
    })
    return {
      ...result,
      learningGraph: buildLearningGraph(),
      skills: learningState.skills,
    }
  })

  ipcMain.handle('paxion:terminal:plan', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required for terminal planning.' }
    }
    return buildCommandPlan(input)
  })

  ipcMain.handle('paxion:terminal:run', async (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required for terminal execution.' }
    }
    if (capabilityState.workspaceTooling !== true) {
      return { ok: false, reason: 'workspaceTooling capability must be enabled for terminal execution.' }
    }

    const command = String(input?.command || '').trim()
    const assessment = assessTerminalCommand(command)
    if (!assessment.allowed) {
      return { ok: false, reason: assessment.reason, risk: assessment.risk }
    }

    const actionEnvelope = await executeAllowedAction({
      actionId: 'workspace.runToolCommand',
      category: 'system',
      detail: `command=${command}`,
    })

    appendAuditEntry('action_result', {
      actionId: 'terminal.run',
      status: actionEnvelope.executed ? 'allowed' : 'denied',
      reason: actionEnvelope.note || 'Terminal command handled.',
      command,
      risk: assessment.risk,
    })

    return {
      ok: Boolean(actionEnvelope.executed),
      command,
      assessment,
      execution: actionEnvelope,
    }
  })

  ipcMain.handle('paxion:polyglot:status', async () => {
    const runtimes = await buildPolyglotStatus()
    return {
      ok: true,
      runtimes,
      updatedAt: new Date().toISOString(),
    }
  })

  ipcMain.handle('paxion:polyglot:starter', (_event, input) => {
    return loadPolyglotStarterSource(input?.language)
  })

  ipcMain.handle('paxion:polyglot:brainMesh', async (_event, input) => {
    const result = await runPolyglotBrainMesh(input)

    appendAuditEntry('action_result', {
      actionId: 'polyglot.brainMesh',
      status: result.ok ? 'allowed' : 'failed',
      reason: result.summary,
      completedCount: result.completedCount,
      attemptedCount: result.attemptedCount,
    })

    if (result.ok) {
      appendLearningLog({
        title: 'Polyglot brain mesh executed',
        detail: `Aggregated ${result.completedCount} language module(s) for architecture guidance.`,
        source: 'polyglot-brain-mesh',
        newSkills: ['Polyglot Architecture', 'Cross-Language Runtime Coordination'],
      })
    }

    return {
      ...result,
      skills: learningState.skills,
      updatedAt: learningState.updatedAt,
    }
  })

  ipcMain.handle('paxion:polyglot:run', async (_event, input) => {
    const result = await runPolyglotProgram(input)

    appendAuditEntry('action_result', {
      actionId: 'polyglot.run',
      status: result.ok ? 'allowed' : 'failed',
      language: result.language,
      stage: result.stage,
      reason: result.reason,
      timedOut: result.timedOut,
      exitCode: result.exitCode,
    })

    if (result.ok) {
      appendLearningLog({
        title: `${String(result.language || 'polyglot').toUpperCase()} program executed`,
        detail: `Program completed via ${Array.isArray(result.commands) ? result.commands[0] || 'local runtime' : 'local runtime'}.`,
        source: 'polyglot-runtime',
        newSkills: [buildPolyglotSkill(result.language)],
      })
    }

    return {
      ...result,
      skills: learningState.skills,
      updatedAt: learningState.updatedAt,
    }
  })

  ipcMain.handle('paxion:creative:ideate', (_event, input) => {
    if (!isAdminUnlocked(adminSession)) {
      return { ok: false, reason: 'Admin session required for creative ideation.' }
    }
    const result = generateCreativeHypotheses(input)
    appendLearningLog({
      title: `Creative lab ideation: ${String(result?.lab?.domain || 'general')}`,
      detail: `Generated ${Array.isArray(result?.lab?.hypotheses) ? result.lab.hypotheses.length : 0} research hypothesis candidates.`,
      source: 'creative-lab',
      newSkills: ['Creative Synthesis', 'Hypothesis Engineering'],
    })
    return {
      ...result,
      learningGraph: buildLearningGraph(),
      skills: learningState.skills,
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
        const parser = new PDFParse({ data: buffer })
        const parsed = await parser.getText()
        await parser.destroy()
        return {
          name: path.basename(filePath),
          content: parsed.text,
          path: filePath,
          pageCount: typeof parsed.total === 'number' ? parsed.total : null,
        }
      }

      const content = fs.readFileSync(filePath, 'utf8')
      return { name: path.basename(filePath), content, path: filePath }
    } catch (err) {
      return { error: `Could not read file: ${err.message}` }
    }
  })

  ipcMain.handle('paxion:library:ingestWebUrl', async (_event, input) => {
    if (capabilityState.libraryIngestWeb === false) {
      return {
        ok: false,
        reason: 'Web ingest capability is disabled in Access tab.',
      }
    }

    const url = String(input?.url || '').trim()
    if (!url) {
      return {
        ok: false,
        reason: 'A website URL is required.',
      }
    }

    try {
      const fetched = await fetchRemoteText(url)
      const title = extractHtmlTitle(fetched.raw)
      const rawText = fetched.contentType.includes('html') ? htmlToPlainText(fetched.raw) : fetched.raw
      const content = normalizeIngestedText(rawText)

      if (content.length < 160) {
        return {
          ok: false,
          reason: 'Fetched content is too short to ingest as knowledge.',
        }
      }

      const fallbackName = (() => {
        try {
          const parsed = new URL(fetched.finalUrl)
          return `Web: ${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`
        } catch {
          return 'Web article'
        }
      })()

      appendAuditEntry('action_result', {
        actionId: 'library.ingestWebUrl',
        status: 'allowed',
        reason: `Fetched and parsed website URL for library ingestion: ${url}`,
      })

      return {
        ok: true,
        name: title || fallbackName,
        url: fetched.finalUrl,
        content: `Source URL: ${fetched.finalUrl}\n\n${content}`,
      }
    } catch (err) {
      return {
        ok: false,
        reason: `Could not ingest website content: ${err.message}`,
      }
    }
  })

  ipcMain.handle('paxion:library:ingestYoutube', async (_event, input) => {
    if (capabilityState.libraryIngestWeb === false) {
      return {
        ok: false,
        reason: 'Web ingest capability is disabled in Access tab.',
      }
    }

    const url = String(input?.url || '').trim()
    if (!url) {
      return {
        ok: false,
        reason: 'A YouTube URL is required.',
      }
    }

    const videoId = extractYoutubeVideoId(url)
    if (!videoId) {
      return {
        ok: false,
        reason: 'Invalid YouTube URL.',
      }
    }

    try {
      const transcriptRows = await fetchYoutubeTranscriptRows(videoId)
      const lines = transcriptRows.map((item) => {
        const sec = Number(item?.start || 0)
        const mins = Math.floor(sec / 60)
        const secs = Math.floor(sec % 60)
        const stamp = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
        return `[${stamp}] ${String(item?.text || '').trim()}`
      })

      const segments = buildTranscriptSegments(transcriptRows, 360)

      const content = normalizeIngestedText(lines.join('\n'))
      if (content.length < 120) {
        return {
          ok: false,
          reason: 'Transcript is unavailable or too short for ingestion.',
        }
      }

      appendAuditEntry('action_result', {
        actionId: 'library.ingestYoutube',
        status: 'allowed',
        reason: `Fetched YouTube transcript for video ${videoId}.`,
      })

      return {
        ok: true,
        name: `YouTube transcript: ${videoId}`,
        url,
        content: `Source URL: ${url}\nVideo ID: ${videoId}\n\nTranscript:\n${content}`,
        segmentCount: lines.length,
        segments: segments.map((segment) => ({
          name: `YouTube ${videoId} [${Math.floor(segment.start / 60)}-${Math.ceil(segment.end / 60)} min]`,
          content: `Source URL: ${url}\nVideo ID: ${videoId}\nSegment: ${segment.start}s-${segment.end}s\n\n${segment.text}`,
          start: segment.start,
          end: segment.end,
        })),
      }
    } catch (err) {
      const sttFallback = await transcribeYoutubeWithLocalStt(url)
      if (!sttFallback.ok) {
        return {
          ok: false,
          reason: `Could not ingest YouTube transcript: ${err.message}. STT fallback failed: ${sttFallback.reason}`,
        }
      }

      appendAuditEntry('action_result', {
        actionId: 'library.ingestYoutube',
        status: 'allowed',
        reason: `Used local STT fallback for YouTube video ${videoId}.`,
      })

      return {
        ok: true,
        name: `YouTube STT transcript: ${videoId}`,
        url,
        content: `Source URL: ${url}\nVideo ID: ${videoId}\nLearning mode: local-stt\n\nTranscript:\n${sttFallback.text}`,
        segmentCount: 0,
        segments: [],
      }
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
