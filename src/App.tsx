import { useMemo, useState } from 'react'
import './App.css'
import { ApprovalStore } from './security/approvals'
import { AuditLedger } from './security/audit'
import {
  evaluateActionPolicy,
  finalizePolicyDecision,
  getImmutablePolicySummary,
  verifyAdminCodeword,
} from './security/policy'
import type { ActionCategory, ActionRequest, AuditEntry } from './security/types'

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

  const activeTabMeta = useMemo(
    () => tabs.find((tab) => tab.id === activeTab) ?? tabs[0],
    [activeTab],
  )

  const approvalStore = useMemo(() => new ApprovalStore(), [])
  const auditLedger = useMemo(() => new AuditLedger(), [])

  const selectedAction = useMemo(
    () => actionPresets.find((preset) => preset.id === selectedActionId) ?? actionPresets[0],
    [selectedActionId],
  )

  function syncAuditState() {
    setAuditEntries(auditLedger.getAll())
  }

  async function runPolicyEvaluation() {
    const request: ActionRequest = {
      actionId: selectedAction.id,
      category: selectedAction.category,
      targetPath,
      detail: selectedAction.detail,
    }

    const baseDecision = evaluateActionPolicy(request)
    await auditLedger.append('policy_check', {
      request,
      decision: baseDecision,
    })

    if (!baseDecision.allowed && !baseDecision.requiresApproval) {
      await auditLedger.append('action_result', {
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
        await auditLedger.append('action_result', {
          actionId: request.actionId,
          status: 'denied',
          reason: deniedDecision.reason,
        })
        syncAuditState()
        setLastDecision(`Denied: ${deniedDecision.reason}`)
        return
      }

      const ticket = approvalStore.issue(request.actionId)
      await auditLedger.append('approval_issue', {
        actionId: request.actionId,
        ticketId: ticket.id,
        expiresAt: new Date(ticket.expiresAt).toISOString(),
      })

      const approvalGranted = approvalStore.consume(ticket.id, request.actionId)
      await auditLedger.append('approval_use', {
        actionId: request.actionId,
        ticketId: ticket.id,
        approvalGranted,
      })

      const finalDecision = finalizePolicyDecision(baseDecision, {
        adminVerified,
        approvalGranted,
      })

      await auditLedger.append('action_result', {
        actionId: request.actionId,
        status: finalDecision.allowed ? 'allowed' : 'denied',
        reason: finalDecision.reason,
      })

      syncAuditState()
      setLastDecision(`${finalDecision.allowed ? 'Allowed' : 'Denied'}: ${finalDecision.reason}`)
      return
    }

    await auditLedger.append('action_result', {
      actionId: request.actionId,
      status: 'allowed',
      reason: baseDecision.reason,
    })
    syncAuditState()
    setLastDecision(`Allowed: ${baseDecision.reason}`)
  }

  function renderTabBody() {
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
        <span>Version: v0.2.0-security-core</span>
      </footer>
    </div>
  )
}

export default App
