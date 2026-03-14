'use strict'

const { ipcMain, dialog, app } = require('electron')
const fs = require('fs')
const path = require('path')
const pdfParse = require('pdf-parse')

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

// ── IPC handler registration ──

function registerIpcHandlers(mainWindow) {
  const auditFilePath = path.join(app.getPath('userData'), 'paxion-audit.jsonl')

  // Persist a single audit entry as a JSON line.
  ipcMain.handle('paxion:audit:append', (_event, entry) => {
    try {
      fs.appendFileSync(auditFilePath, JSON.stringify(entry) + '\n', 'utf8')
    } catch (err) {
      console.error('[Paxion] audit append failed:', err)
    }
  })

  // Load the full persisted audit log on startup.
  ipcMain.handle('paxion:audit:load', () => {
    try {
      if (!fs.existsSync(auditFilePath)) return []
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
    } catch (err) {
      console.error('[Paxion] audit load failed:', err)
      return []
    }
  })

  // Authoritative main-process policy evaluation.
  ipcMain.handle('paxion:policy:evaluate', (_event, request) => {
    return enforcePolicy(request)
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
}

module.exports = { registerIpcHandlers }
