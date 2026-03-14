import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { LibraryStore } from './library/libraryStore'
import type { LibraryDocument } from './library/types'
import { ApprovalStore } from './security/approvals'
import { AuditLedger } from './security/audit'
import {
  evaluateActionPolicy,
  finalizePolicyDecision,
  getImmutablePolicySummary,
  verifyAdminCodeword,
} from './security/policy'
import type { ActionCategory, ActionRequest, AuditEntry, AuditEventType } from './security/types'

type TabId = 'chat' | 'library' | 'logs' | 'workspace' | 'access'

type Tab = {
  id: TabId
  name: string
  description: string
}

const tabs: Tab[] = [
  { id: 'chat', name: 'Chat', description: 'Task control and voice companion.' },
  {
    id: 'library',
    name: 'Library',
    description: 'Knowledge vault from books and approved web sources.',
  },
  { id: 'logs', name: 'Logs', description: 'Admin-only action history and audit trace.' },
  {
    id: 'workspace',
    name: 'Workspace',
    description: 'Mission board for multi-project execution flows.',
  },
  {
    id: 'access',
    name: 'Access',
    description: 'Permission map for every external platform and connector.',
  },
]

const policyLines = [
  'Legal-safe operations only; dangerous and illegal actions are blocked.',
  'Sensitive actions require admin verification and explicit approval.',
  'The app cannot self-grant permissions or hide actions from logs.',
]

type ActionPreset = {
  id: string
  label: string
  category: ActionCategory
  targetPath: string
  detail: string
}

const actionPresets: ActionPreset[] = [
  {
    id: 'library.ingestDocument',
    label: 'Ingest document into Library',
    category: 'knowledge',
    targetPath: '/library/books/mission-spec.pdf',
    detail: 'Index a trusted local document for retrieval.',
  },
  {
    id: 'workspace.generateComponent',
    label: 'Generate code in Workspace',
    category: 'codegen',
    targetPath: '/workspace/site/new-dashboard.tsx',
    detail: 'Create a new project component from prompt context.',
  },
  {
    id: 'filesystem.editSecurityFile',
    label: 'Attempt edit of immutable security file',
    category: 'filesystem',
    targetPath: '/src/security/policy.ts',
    detail: 'Intentional test: this must always be denied.',
  },
  {
    id: 'security.disablePolicy',
    label: 'Attempt to disable policy engine',
    category: 'system',
    targetPath: '/system/policy-core',
    detail: 'Intentional test: permanently blocked action ID.',
  },
]

const immutableSummary = getImmutablePolicySummary()

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('chat')
  const [selectedActionId, setSelectedActionId] = useState(actionPresets[0].id)
  const [targetPath, setTargetPath] = useState(actionPresets[0].targetPath)
  const [adminCodeword, setAdminCodeword] = useState('')
  const [lastDecision, setLastDecision] = useState<string>('No action evaluated yet.')
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])

  // Library state
  const libraryStore = useMemo(() => new LibraryStore(), [])
  const [libDocs, setLibDocs] = useState<LibraryDocument[]>([])
  const [libSearch, setLibSearch] = useState('')
  const [libSelectedId, setLibSelectedId] = useState<string | null>(null)
  const [libAddMode, setLibAddMode] = useState(false)
  const [libPasteName, setLibPasteName] = useState('')
  const [libPasteText, setLibPasteText] = useState('')
  const [libAddError, setLibAddError] = useState('')

  const activeTabMeta = useMemo(
    () => tabs.find((tab) => tab.id === activeTab) ?? tabs[0],
    [activeTab],
  )

  const approvalStore = useMemo(() => new ApprovalStore(), [])
  const auditLedger = useMemo(() => new AuditLedger(), [])

  // Restore persisted audit log from disk when running inside Electron.
  useEffect(() => {
    if (!window.paxion) return
    window.paxion.audit
      .load()
      .then((entries) => {
        if (entries.length > 0) {
          auditLedger.loadExternal(entries)
          setAuditEntries(auditLedger.getAll())
        }
      })
      .catch(() => undefined)
  }, [auditLedger])

  const selectedAction = useMemo(
    () => actionPresets.find((preset) => preset.id === selectedActionId) ?? actionPresets[0],
    [selectedActionId],
  )

  function syncAuditState() {
    setAuditEntries(auditLedger.getAll())
  }

  // Append an entry to the in-memory ledger and persist it via IPC when in Electron.
  async function appendAudit(type: AuditEventType, payload: Record<string, unknown>) {
    const entry = await auditLedger.append(type, payload)
    if (window.paxion) {
      await window.paxion.audit.append(entry).catch(() => undefined)
    }
  }

  async function runPolicyEvaluation() {
    const request: ActionRequest = {
      actionId: selectedAction.id,
      category: selectedAction.category,
      targetPath,
      detail: selectedAction.detail,
    }

    // Use main-process enforcement when available; fall back to renderer module.
    const baseDecision = window.paxion
      ? await window.paxion.policy.evaluate(request)
      : evaluateActionPolicy(request)

    await appendAudit('policy_check', { request, decision: baseDecision })

    if (!baseDecision.allowed && !baseDecision.requiresApproval) {
      await appendAudit('action_result', {
        actionId: request.actionId,
        status: 'denied',
        reason: baseDecision.reason,
      })
      syncAuditState()
      setLastDecision(`Denied: ${baseDecision.reason}`)
      return
    }

    if (baseDecision.requiresApproval) {
      const adminVerified = verifyAdminCodeword(adminCodeword)
      if (!adminVerified) {
        const deniedDecision = finalizePolicyDecision(baseDecision, {
          adminVerified: false,
          approvalGranted: false,
        })
        await appendAudit('action_result', {
          actionId: request.actionId,
          status: 'denied',
          reason: deniedDecision.reason,
        })
        syncAuditState()
        setLastDecision(`Denied: ${deniedDecision.reason}`)
        return
      }

      const ticket = approvalStore.issue(request.actionId)
      await appendAudit('approval_issue', {
        actionId: request.actionId,
        ticketId: ticket.id,
        expiresAt: new Date(ticket.expiresAt).toISOString(),
      })

      const approvalGranted = approvalStore.consume(ticket.id, request.actionId)
      await appendAudit('approval_use', {
        actionId: request.actionId,
        ticketId: ticket.id,
        approvalGranted,
      })

      const finalDecision = finalizePolicyDecision(baseDecision, {
        adminVerified,
        approvalGranted,
      })

      await appendAudit('action_result', {
        actionId: request.actionId,
        status: finalDecision.allowed ? 'allowed' : 'denied',
        reason: finalDecision.reason,
      })

      syncAuditState()
      setLastDecision(`${finalDecision.allowed ? 'Allowed' : 'Denied'}: ${finalDecision.reason}`)
      return
    }

    await appendAudit('action_result', {
      actionId: request.actionId,
      status: 'allowed',
      reason: baseDecision.reason,
    })
    syncAuditState()
    setLastDecision(`Allowed: ${baseDecision.reason}`)
  }

  // ── Library tab handlers ──

  async function handleAddByFile() {
    if (!window.paxion) return
    setLibAddError('')
    const result = await window.paxion.library.pickFile()
    if (!result) return
    if ('error' in result) {
      setLibAddError(result.error)
      return
    }
    libraryStore.add(result.name, result.content, 'file')
    setLibDocs(libraryStore.getAll())
    setLibAddMode(false)
  }

  function handleAddByPaste() {
    if (!libPasteText.trim()) return
    setLibAddError('')
    libraryStore.add(libPasteName || 'Pasted document', libPasteText, 'paste')
    setLibDocs(libraryStore.getAll())
    setLibAddMode(false)
    setLibPasteName('')
    setLibPasteText('')
  }

  function handleRemoveDoc(id: string) {
    libraryStore.remove(id)
    if (libSelectedId === id) setLibSelectedId(null)
    setLibDocs(libraryStore.getAll())
  }

  function renderTabBody() {
    if (activeTab === 'library') {
      const selectedDoc = libDocs.find((d) => d.id === libSelectedId) ?? null
      const displayDocs = libSearch.trim()
        ? libDocs.filter(
            (d) =>
              d.name.toLowerCase().includes(libSearch.toLowerCase()) ||
              d.content.toLowerCase().includes(libSearch.toLowerCase()),
          )
        : libDocs

      return (
        <div className="tab-content-stack">
          <div className="lib-toolbar">
            <input
              className="lib-search"
              value={libSearch}
              onChange={(e) => setLibSearch(e.target.value)}
              placeholder="Search documents…"
            />
            <button
              className="run-button"
              onClick={() => {
                setLibAddMode((m) => !m)
                setLibAddError('')
              }}
            >
              {libAddMode ? 'Cancel' : '+ Add Document'}
            </button>
          </div>

          {libAddMode && (
            <div className="lib-add-panel">
              <div className="control-group">
                <label>Document name</label>
                <input
                  value={libPasteName}
                  onChange={(e) => setLibPasteName(e.target.value)}
                  placeholder="e.g. Mission Brief v2"
                />
              </div>
              <div className="control-group">
                <label>Paste content</label>
                <textarea
                  className="lib-paste-area"
                  value={libPasteText}
                  onChange={(e) => setLibPasteText(e.target.value)}
                  placeholder="Paste text, markdown, or code here…"
                  rows={6}
                />
              </div>
              <div className="lib-add-actions">
                <button className="run-button" onClick={handleAddByPaste}>
                  Ingest Pasted Text
                </button>
                {window.paxion && (
                  <button className="run-button" onClick={handleAddByFile}>
                    Pick File from Disk
                  </button>
                )}
              </div>
              {libAddError && <p className="lib-error">{libAddError}</p>}
            </div>
          )}

          {displayDocs.length === 0 ? (
            <p className="muted">
              {libSearch.trim()
                ? 'No documents match the search.'
                : 'Library is empty. Add a document to begin.'}
            </p>
          ) : (
            <div className="lib-doc-list">
              {displayDocs.map((doc) => (
                <article
                  key={doc.id}
                  className={`lib-doc-card${libSelectedId === doc.id ? ' is-selected' : ''}`}
                  onClick={() => setLibSelectedId(doc.id === libSelectedId ? null : doc.id)}
                >
                  <div className="lib-doc-head">
                    <strong>{doc.name}</strong>
                    <span className="muted">{doc.wordCount.toLocaleString()} words</span>
                    <button
                      className="lib-remove-btn"
                      aria-label={`Remove ${doc.name}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveDoc(doc.id)
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <p className="lib-excerpt muted">{doc.excerpt}</p>
                  {libSelectedId === doc.id && selectedDoc && (
                    <pre className="lib-doc-content">{selectedDoc.content}</pre>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (activeTab === 'access') {
      return (
        <div className="tab-content-stack">
          <div className="control-group">
            <label htmlFor="action-preset">Action preset</label>
            <select
              id="action-preset"
              value={selectedActionId}
              onChange={(event) => {
                const nextId = event.target.value
                setSelectedActionId(nextId)
                const next = actionPresets.find((item) => item.id === nextId)
                if (next) {
                  setTargetPath(next.targetPath)
                }
              }}
            >
              {actionPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label htmlFor="target-path">Target path</label>
            <input
              id="target-path"
              value={targetPath}
              onChange={(event) => setTargetPath(event.target.value)}
              placeholder="/workspace/project/file.ts"
            />
          </div>

          <div className="control-group">
            <label htmlFor="admin-codeword">Admin codeword for sensitive actions</label>
            <input
              id="admin-codeword"
              type="password"
              value={adminCodeword}
              onChange={(event) => setAdminCodeword(event.target.value)}
              placeholder="Enter codeword when required"
            />
          </div>

          <button className="run-button" onClick={runPolicyEvaluation}>
            Evaluate Policy Gate
          </button>

          <div className="decision-card">
            <strong>Result:</strong>
            <p>{lastDecision}</p>
          </div>

          <div className="decision-card">
            <strong>Immutable guardrails:</strong>
            <ul>
              {immutableSummary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      )
    }

    if (activeTab === 'logs') {
      return (
        <div className="tab-content-stack">
          <p>Append-only audit chain for policy checks and sensitive approvals.</p>
          <div className="log-list">
            {auditEntries.length === 0 ? (
              <p className="muted">No audit events yet. Run an Access action to generate logs.</p>
            ) : (
              [...auditEntries]
                .reverse()
                .slice(0, 8)
                .map((entry) => (
                  <article className="log-card" key={entry.id}>
                    <div className="log-head">
                      <strong>{entry.type}</strong>
                      <span>{entry.timestamp}</span>
                    </div>
                    <p>
                      <span className="muted">hash:</span> {entry.hash.slice(0, 16)}...
                    </p>
                    <p>
                      <span className="muted">prev:</span> {entry.prevHash.slice(0, 16)}...
                    </p>
                  </article>
                ))
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="placeholder">
        <p>
          This tab is ready for the next phase. Security gates are now active through Access,
          and logs are tamper-evident through chained hashes.
        </p>
      </div>
    )
  }

  return (
    <div className="paxion-app">
      <header className="hero">
        <p className="eyebrow">The Paxion</p>
        <h1>Mission Console</h1>
        <p className="subtitle">
          Desktop-first AI workspace with controlled permissions, verified sensitive actions,
          and full project continuity.
        </p>
      </header>

      <section className="grid-shell">
        <aside className="panel nav-panel">
          <h2>Tabs</h2>
          <div className="tab-list" role="tablist" aria-label="Paxion tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                className={activeTab === tab.id ? 'tab is-active' : 'tab'}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.name}</span>
                <small>{tab.description}</small>
              </button>
            ))}
          </div>
        </aside>

        <main className="panel work-panel" role="tabpanel" aria-label={activeTabMeta.name}>
          <h2>{activeTabMeta.name}</h2>
          <p>{activeTabMeta.description}</p>
          {renderTabBody()}
        </main>

        <aside className="panel policy-panel">
          <h2>Core Policy</h2>
          <ul>
            {policyLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className="status">
            <strong>Checkpoint:</strong> Initial desktop foundation is active.
          </div>
        </aside>
      </section>

      <footer className="footer">
        <span>Profile: Paro the Chief</span>
        <span>Mode: Policy-Enforced Build</span>
        <span>Version: v0.3.0-library</span>
      </footer>
    </div>
  )
}

export default App
