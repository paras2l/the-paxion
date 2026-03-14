import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { PaxionBrain } from './brain/engine'
import { rankFromDocs } from './brain/knowledge'
import type { ChatMessage } from './chat/types'
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

type WorkspaceStepStatus =
  | 'pending'
  | 'dry-run-pass'
  | 'dry-run-deny'
  | 'executed'
  | 'failed'

type WorkspaceStep = {
  id: string
  title: string
  request: ActionRequest
  status: WorkspaceStepStatus
  result: string
  executionMode?: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
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

function buildWorkspacePlan(goal: string): WorkspaceStep[] {
  const normalizedGoal = goal.toLowerCase()
  const steps: Array<Omit<WorkspaceStep, 'id' | 'status' | 'result'>> = []

  if (
    normalizedGoal.includes('research') ||
    normalizedGoal.includes('learn') ||
    normalizedGoal.includes('library')
  ) {
    steps.push({
      title: 'Prepare knowledge intake context',
      request: {
        actionId: 'library.ingestDocument',
        category: 'knowledge',
        targetPath: '/library/incoming/mission-context.txt',
        detail: `Prepare knowledge context for mission: ${goal}`,
      },
    })
  }

  steps.push({
    title: 'Generate mission component',
    request: {
      actionId: 'workspace.generateComponent',
      category: 'codegen',
      targetPath: '/workspace/missions/mission-component.tsx',
      detail: `Generate primary implementation for mission: ${goal}`,
    },
  })

  steps.push({
    title: 'Generate mission scaffold notes',
    request: {
      actionId: 'workspace.generateComponent',
      category: 'codegen',
      targetPath: '/workspace/missions/mission-notes.tsx',
      detail: `Generate supporting scaffold for mission: ${goal}`,
    },
  })

  return steps.map((step, idx) => ({
    id: `ws-step-${idx + 1}`,
    title: step.title,
    request: step.request,
    status: 'pending',
    result: 'Not run yet.',
  }))
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('chat')
  const [selectedActionId, setSelectedActionId] = useState(actionPresets[0].id)
  const [targetPath, setTargetPath] = useState(actionPresets[0].targetPath)
  const [adminCodeword, setAdminCodeword] = useState('')
  const [lastDecision, setLastDecision] = useState<string>('No action evaluated yet.')
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [adminExpiresAt, setAdminExpiresAt] = useState<number | null>(null)
  const [adminMessage, setAdminMessage] = useState('')

  // Library state
  const libraryStore = useMemo(() => new LibraryStore(), [])
  const [libDocs, setLibDocs] = useState<LibraryDocument[]>([])
  const [libSearch, setLibSearch] = useState('')
  const [libSelectedId, setLibSelectedId] = useState<string | null>(null)
  const [libAddMode, setLibAddMode] = useState(false)
  const [libPasteName, setLibPasteName] = useState('')
  const [libPasteText, setLibPasteText] = useState('')
  const [libAddError, setLibAddError] = useState('')

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [showThought, setShowThought] = useState<string | null>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  // Workspace mission executor state
  const [workspaceGoal, setWorkspaceGoal] = useState('')
  const [workspacePlan, setWorkspacePlan] = useState<WorkspaceStep[]>([])
  const [workspaceRunning, setWorkspaceRunning] = useState(false)
  const [workspaceMessage, setWorkspaceMessage] = useState('')
  const [workspaceQueuePaused, setWorkspaceQueuePaused] = useState(false)
  const [workspaceQueueStopped, setWorkspaceQueueStopped] = useState(false)
  const [workspaceUpdatedAt, setWorkspaceUpdatedAt] = useState<string | null>(null)
  const workspaceLoadedRef = useRef(false)
  const workspaceQueuePausedRef = useRef(false)
  const workspaceQueueStoppedRef = useRef(false)

  const activeTabMeta = useMemo(
    () => tabs.find((tab) => tab.id === activeTab) ?? tabs[0],
    [activeTab],
  )

  const approvalStore = useMemo(() => new ApprovalStore(), [])
  const auditLedger = useMemo(() => new AuditLedger(), [])
  const brain = useMemo(() => new PaxionBrain(), [])


  const refreshAdminStatus = useCallback(async () => {
    if (!window.paxion) return
    const status = await window.paxion.admin.status().catch(() => null)
    if (!status) return

    setAdminUnlocked(status.unlocked)
    setAdminExpiresAt(status.expiresAt)
  }, [])

  const loadAuditIfAllowed = useCallback(async () => {
    if (!window.paxion) return
    const result = await window.paxion.audit.load().catch(() => null)
    if (!result || !result.ok) {
      setAuditEntries([])
      return
    }

    auditLedger.loadExternal(result.entries)
    setAuditEntries(auditLedger.getAll())
  }, [auditLedger])

  const normalizeWorkspacePlan = useCallback((raw: Array<Record<string, unknown>>): WorkspaceStep[] => {
    return raw
      .map((item, idx) => {
        const request = (item.request ?? {}) as Record<string, unknown>
        return {
          id: typeof item.id === 'string' ? item.id : `ws-step-${idx + 1}`,
          title: typeof item.title === 'string' ? item.title : `Step ${idx + 1}`,
          request: {
            actionId:
              typeof request.actionId === 'string' ? request.actionId : 'workspace.generateComponent',
            category: (request.category as ActionCategory) ?? 'codegen',
            targetPath:
              typeof request.targetPath === 'string'
                ? request.targetPath
                : `/workspace/missions/recovered-step-${idx + 1}.tsx`,
            detail:
              typeof request.detail === 'string'
                ? request.detail
                : `Recovered mission step ${idx + 1}`,
          },
          status:
            typeof item.status === 'string'
              ? (item.status as WorkspaceStepStatus)
              : ('pending' as WorkspaceStepStatus),
          result: typeof item.result === 'string' ? item.result : 'Recovered from persistence.',
          executionMode:
            typeof item.executionMode === 'string' ? item.executionMode : undefined,
        }
      })
      .filter((item) => Boolean(item.request.actionId))
  }, [])

  const loadWorkspaceState = useCallback(async () => {
    if (window.paxion) {
      const loaded = await window.paxion.workspace.load().catch(() => null)
      if (loaded?.ok) {
        setWorkspaceGoal(loaded.state.goal)
        setWorkspacePlan(normalizeWorkspacePlan(loaded.state.plan))
        setWorkspaceUpdatedAt(loaded.state.updatedAt)
      }
    } else {
      try {
        const raw = localStorage.getItem('paxion-workspace-state')
        if (raw) {
          const parsed = JSON.parse(raw) as {
            goal?: string
            plan?: Array<Record<string, unknown>>
            updatedAt?: string | null
          }
          setWorkspaceGoal(parsed.goal ?? '')
          setWorkspacePlan(normalizeWorkspacePlan(parsed.plan ?? []))
          setWorkspaceUpdatedAt(parsed.updatedAt ?? null)
        }
      } catch {
        // Ignore corrupted local state and continue with fresh state.
      }
    }

    workspaceLoadedRef.current = true
  }, [normalizeWorkspacePlan])

  const persistWorkspaceState = useCallback(async (nextGoal: string, nextPlan: WorkspaceStep[]) => {
    if (window.paxion) {
      const result = await window.paxion.workspace
        .save({ goal: nextGoal, plan: nextPlan as unknown as Array<Record<string, unknown>> })
        .catch(() => null)
      if (result?.ok && result.updatedAt) {
        setWorkspaceUpdatedAt(result.updatedAt)
      }
      return
    }

    const payload = {
      goal: nextGoal,
      plan: nextPlan,
      updatedAt: new Date().toISOString(),
    }

    localStorage.setItem('paxion-workspace-state', JSON.stringify(payload))
    setWorkspaceUpdatedAt(payload.updatedAt)
  }, [])

  // Keep admin session status fresh.
  useEffect(() => {
    if (!window.paxion) return

    queueMicrotask(() => {
      refreshAdminStatus()
    })

    const intervalId = window.setInterval(() => {
      refreshAdminStatus()
    }, 30 * 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [refreshAdminStatus])

  // Restore workspace mission state from persistence.
  useEffect(() => {
    queueMicrotask(() => {
      loadWorkspaceState()
    })
  }, [loadWorkspaceState])

  // Autosave workspace mission state after local updates are initialized.
  useEffect(() => {
    if (!workspaceLoadedRef.current) return
    queueMicrotask(() => {
      persistWorkspaceState(workspaceGoal, workspacePlan)
    })
  }, [workspaceGoal, workspacePlan, persistWorkspaceState])

  const selectedAction = useMemo(
    () => actionPresets.find((preset) => preset.id === selectedActionId) ?? actionPresets[0],
    [selectedActionId],
  )

  // Auto-scroll chat to bottom whenever a message is added or loading state changes.
  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatMessages, chatLoading])

  function syncAuditState() {
    setAuditEntries(auditLedger.getAll())
  }

  async function unlockAdminSession() {
    if (!window.paxion) return
    const result = await window.paxion.admin.unlock(adminCodeword).catch(() => null)
    if (!result || !result.ok) {
      setAdminMessage(result?.reason ?? 'Failed to unlock admin session.')
      return
    }

    setAdminUnlocked(true)
    setAdminExpiresAt(result.expiresAt ?? null)
    setAdminMessage('Admin session unlocked.')
    await loadAuditIfAllowed()
  }

  async function lockAdminSession() {
    if (!window.paxion) return
    await window.paxion.admin.lock().catch(() => undefined)
    setAdminUnlocked(false)
    setAdminExpiresAt(null)
    setAuditEntries([])
    setAdminMessage('Admin session locked.')
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

    if (window.paxion) {
      const decisionEnvelope = await window.paxion.action.execute({
        request,
        adminCodeword,
      })

      await loadAuditIfAllowed()
      setLastDecision(
        `${decisionEnvelope.finalDecision.allowed ? 'Allowed' : 'Denied'}: ${decisionEnvelope.finalDecision.reason}${decisionEnvelope.execution?.executed ? ` | executed: ${decisionEnvelope.execution.mode}` : ''}`,
      )
      return
    }

    // Browser-only fallback (non-Electron): keep current renderer-local behavior.
    const baseDecision = evaluateActionPolicy(request)
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
      const ticket = adminVerified ? approvalStore.issue(request.actionId) : null

      if (ticket) {
        await appendAudit('approval_issue', {
          actionId: request.actionId,
          ticketId: ticket.id,
          expiresAt: new Date(ticket.expiresAt).toISOString(),
        })
      }

      const approvalGranted = ticket ? approvalStore.consume(ticket.id, request.actionId) : false

      if (ticket) {
        await appendAudit('approval_use', {
          actionId: request.actionId,
          ticketId: ticket.id,
          approvalGranted,
        })
      }

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

  // ── Workspace tab handlers ──

  function hasUnresolvedDependency(plan: WorkspaceStep[], index: number): boolean {
    for (let i = 0; i < index; i += 1) {
      if (plan[i].status !== 'executed') {
        return true
      }
    }
    return false
  }

  function getFirstResumeIndex(plan: WorkspaceStep[]): number {
    const failedIndex = plan.findIndex((step) => step.status === 'failed')
    if (failedIndex >= 0) return failedIndex

    const pendingIndex = plan.findIndex((step) => step.status !== 'executed')
    return pendingIndex
  }

  function createWorkspacePlan() {
    if (!workspaceGoal.trim()) {
      setWorkspaceMessage('Enter a mission goal first.')
      return
    }

    const nextPlan = buildWorkspacePlan(workspaceGoal.trim())
    setWorkspacePlan(nextPlan)
    setWorkspaceMessage(`Plan generated with ${nextPlan.length} steps.`)
  }

  async function runWorkspaceDryRun() {
    if (workspacePlan.length === 0) {
      setWorkspaceMessage('No mission plan available. Generate plan first.')
      return
    }

    setWorkspaceRunning(true)
    setWorkspaceMessage('Running dry-run policy checks...')

    for (const step of workspacePlan) {
      const idx = workspacePlan.findIndex((entry) => entry.id === step.id)
      if (hasUnresolvedDependency(workspacePlan, idx)) {
        setWorkspacePlan((prev) =>
          prev.map((item) =>
            item.id === step.id
              ? {
                  ...item,
                  status: 'dry-run-deny',
                  result: 'Dry run denied: blocked by unresolved previous step.',
                }
              : item,
          ),
        )
        continue
      }

      const baseDecision = window.paxion
        ? await window.paxion.policy.evaluate(step.request)
        : evaluateActionPolicy(step.request)

      setWorkspacePlan((prev) =>
        prev.map((item) => {
          if (item.id !== step.id) return item

          if (!baseDecision.allowed) {
            return {
              ...item,
              status: 'dry-run-deny',
              result: `Dry run denied: ${baseDecision.reason}`,
            }
          }

          if (baseDecision.requiresApproval) {
            return {
              ...item,
              status: 'dry-run-pass',
              result: 'Dry run pass: execution allowed with admin session + codeword.',
            }
          }

          return {
            ...item,
            status: 'dry-run-pass',
            result: 'Dry run pass: policy allows execution.',
          }
        }),
      )
    }

    setWorkspaceRunning(false)
    setWorkspaceMessage('Dry run complete.')
  }

  async function executeWorkspaceStep(stepId: string, managedByQueue = false): Promise<boolean> {
    const stepIndex = workspacePlan.findIndex((item) => item.id === stepId)
    const step = stepIndex >= 0 ? workspacePlan[stepIndex] : undefined
    if (!step || !window.paxion) return false

    if (hasUnresolvedDependency(workspacePlan, stepIndex)) {
      setWorkspacePlan((prev) =>
        prev.map((item) =>
          item.id === stepId
            ? {
                ...item,
                status: 'failed',
                result: 'Execution blocked: complete previous steps first.',
              }
            : item,
        ),
      )
      return false
    }

    if (!managedByQueue) {
      setWorkspaceRunning(true)
    }
    const result = await window.paxion.action.execute({
      request: step.request,
      adminCodeword,
    })

    setWorkspacePlan((prev) =>
      prev.map((item) => {
        if (item.id !== stepId) return item
        return {
          ...item,
          status: result.finalDecision.allowed ? 'executed' : 'failed',
          result: result.finalDecision.allowed
            ? `Executed: ${result.execution.mode}`
            : `Denied: ${result.finalDecision.reason}`,
          executionMode: result.execution.mode,
        }
      }),
    )

    if (adminUnlocked) {
      await loadAuditIfAllowed()
    }

    if (!managedByQueue) {
      setWorkspaceRunning(false)
    }

    return result.finalDecision.allowed
  }

  async function executeWorkspaceQueue(fromIndex = 0) {
    if (workspacePlan.length === 0) {
      setWorkspaceMessage('No mission plan available. Generate plan first.')
      return
    }

    setWorkspaceQueueStopped(false)
    setWorkspaceQueuePaused(false)
    workspaceQueueStoppedRef.current = false
    workspaceQueuePausedRef.current = false
    setWorkspaceRunning(true)
    setWorkspaceMessage('Mission queue started...')

    for (let i = fromIndex; i < workspacePlan.length; i += 1) {
      if (workspaceQueueStoppedRef.current) {
        setWorkspaceMessage('Mission queue stopped by admin.')
        break
      }

      while (workspaceQueuePausedRef.current) {
        await sleep(250)
        if (workspaceQueueStoppedRef.current) {
          break
        }
      }

      const step = workspacePlan[i]
      if (!step) {
        continue
      }

      const executed = await executeWorkspaceStep(step.id, true)
      if (!executed) {
        setWorkspaceMessage('Mission queue paused due to failed step.')
        break
      }
    }

    setWorkspaceRunning(false)
    if (!workspaceQueueStoppedRef.current) {
      setWorkspaceMessage('Mission execution queue finished.')
    }
  }

  function pauseWorkspaceQueue() {
    workspaceQueuePausedRef.current = true
    setWorkspaceQueuePaused(true)
    setWorkspaceMessage('Mission queue paused.')
  }

  function resumeWorkspaceQueue() {
    workspaceQueuePausedRef.current = false
    setWorkspaceQueuePaused(false)
    setWorkspaceMessage('Mission queue resumed.')
  }

  function stopWorkspaceQueue() {
    workspaceQueueStoppedRef.current = true
    workspaceQueuePausedRef.current = false
    setWorkspaceQueueStopped(true)
    setWorkspaceQueuePaused(false)
    setWorkspaceRunning(false)
    setWorkspaceMessage('Mission queue stop requested.')
  }

  async function resumeWorkspaceFromFailure() {
    const startIndex = getFirstResumeIndex(workspacePlan)
    if (startIndex < 0) {
      setWorkspaceMessage('All steps already executed.')
      return
    }

    await executeWorkspaceQueue(startIndex)
  }

  async function clearWorkspaceMission() {
    setWorkspaceGoal('')
    setWorkspacePlan([])
    setWorkspaceMessage('Mission cleared.')
    setWorkspaceUpdatedAt(null)

    if (window.paxion) {
      await window.paxion.workspace.clear().catch(() => undefined)
    } else {
      localStorage.removeItem('paxion-workspace-state')
    }
  }

  // ── Chat tab handlers ──

  // Chat runs entirely local — no external API. PaxionBrain answers from Library knowledge.
  function sendChatMessage() {
    const text = chatInput.trim()
    if (!text || chatLoading) return

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      contextDocs: [],
    }

    setChatMessages((prev) => [...prev, userMsg])
    setChatInput('')
    setChatLoading(true)

    // Small deliberate delay so the typing indicator shows — feels alive.
    const thinkMs = 500 + Math.random() * 600
    setTimeout(() => {
      const response = brain.think(text, libDocs)
      setChatMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-a`,
          role: 'assistant',
          content: response.reply,
          timestamp: new Date().toISOString(),
          contextDocs: response.contextDocs,
          reasoningSteps: response.reasoningSteps,
          confidence: response.confidence,
        },
      ])
      setChatLoading(false)
    }, thinkMs)
  }

  function renderTabBody() {
    if (activeTab === 'chat') {
      const totalLibWords = libDocs.reduce((acc, d) => acc + d.wordCount, 0)
      const rank = rankFromDocs(libDocs.length)
      const lastConf = [...chatMessages].reverse().find((m) => m.role === 'assistant')?.confidence

      return (
        <div className="tab-content-stack">
          {/* HUD status bar */}
          <div className="chat-hud">
            <span>
              Neural Index:{' '}
              <strong style={{ color: 'var(--accent-cyan)' }}>{libDocs.length}</strong> docs
              &nbsp;|&nbsp;
              <strong style={{ color: 'var(--accent-cyan)' }}>
                {totalLibWords.toLocaleString()}
              </strong>{' '}
              words
            </span>
            <span className={`chat-rank chat-rank-${lastConf ?? 'none'}`}>{rank}</span>
          </div>

          {/* Messages */}
          <div className="chat-messages" ref={chatScrollRef}>
            {chatMessages.length === 0 ? (
              <p className="muted chat-empty">
                Paxion is online. No external API needed — all responses come from your Library.
                Add documents to improve intelligence.
              </p>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id} className={`chat-bubble chat-${msg.role}`}>
                  <p>{msg.content}</p>
                  {msg.role === 'assistant' && msg.confidence && (
                    <span className={`chat-confidence conf-${msg.confidence}`}>
                      {msg.confidence} confidence
                    </span>
                  )}
                  {msg.role === 'assistant' && msg.contextDocs && msg.contextDocs.length > 0 && (
                    <p className="chat-citations">Source: {msg.contextDocs.join(', ')}</p>
                  )}
                  {msg.role === 'assistant' &&
                    msg.reasoningSteps &&
                    msg.reasoningSteps.length > 0 && (
                      <>
                        <button
                          className="chat-toggle-thought"
                          onClick={() =>
                            setShowThought((prev) => (prev === msg.id ? null : msg.id))
                          }
                        >
                          {showThought === msg.id ? '▲ hide trace' : '▼ show trace'}
                        </button>
                        {showThought === msg.id && (
                          <div className="chat-thought">
                            {msg.reasoningSteps.map((step, i) => (
                              <p key={i}>&gt; {step}</p>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                </div>
              ))
            )}
            {chatLoading && (
              <div className="chat-bubble chat-assistant chat-loading-bubble">
                <span className="chat-dot" />
                <span className="chat-dot" />
                <span className="chat-dot" />
              </div>
            )}
          </div>

          <div className="chat-input-row">
            <textarea
              className="chat-input"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendChatMessage()
                }
              }}
              placeholder="Ask Paxion anything… (Enter to send, Shift+Enter newline)"
              rows={2}
              disabled={chatLoading}
            />
            <div className="chat-input-actions">
              <button
                className="run-button"
                onClick={sendChatMessage}
                disabled={chatLoading || !chatInput.trim()}
              >
                Send
              </button>
              {chatMessages.length > 0 && (
                <button className="run-button" onClick={() => setChatMessages([])}>
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )
    }

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
      if (!adminUnlocked) {
        return (
          <div className="tab-content-stack">
            <div className="decision-card">
              <strong>Admin Session Required</strong>
              <p>Unlock with Paro codeword to open Access controls.</p>
            </div>
            <div className="control-group">
              <label htmlFor="unlock-admin-access">Admin codeword</label>
              <input
                id="unlock-admin-access"
                type="password"
                value={adminCodeword}
                onChange={(event) => setAdminCodeword(event.target.value)}
                placeholder="Enter admin codeword"
              />
            </div>
            <button className="run-button" onClick={unlockAdminSession}>
              Unlock Admin Session
            </button>
            {adminMessage && <p className="muted">{adminMessage}</p>}
          </div>
        )
      }

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
      if (!adminUnlocked) {
        return (
          <div className="tab-content-stack">
            <div className="decision-card">
              <strong>Admin Session Required</strong>
              <p>Unlock with Paro codeword to read append-only logs.</p>
            </div>
            <div className="control-group">
              <label htmlFor="unlock-admin-logs">Admin codeword</label>
              <input
                id="unlock-admin-logs"
                type="password"
                value={adminCodeword}
                onChange={(event) => setAdminCodeword(event.target.value)}
                placeholder="Enter admin codeword"
              />
            </div>
            <button className="run-button" onClick={unlockAdminSession}>
              Unlock Admin Session
            </button>
            {adminMessage && <p className="muted">{adminMessage}</p>}
          </div>
        )
      }

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

    if (activeTab === 'workspace') {
      return (
        <div className="tab-content-stack">
          <div className="control-group">
            <label htmlFor="workspace-goal">Mission goal</label>
            <input
              id="workspace-goal"
              value={workspaceGoal}
              onChange={(event) => setWorkspaceGoal(event.target.value)}
              placeholder="Example: Build landing page hero and scaffold mission files"
            />
          </div>

          <div className="workspace-actions">
            <button className="run-button" onClick={createWorkspacePlan} disabled={workspaceRunning}>
              Generate Plan
            </button>
            <button
              className="run-button"
              onClick={runWorkspaceDryRun}
              disabled={workspaceRunning || workspacePlan.length === 0}
            >
              Dry Run
            </button>
            <button
              className="run-button"
              onClick={() => {
                void executeWorkspaceQueue()
              }}
              disabled={workspaceRunning || workspacePlan.length === 0}
            >
              Execute Queue
            </button>
            {!workspaceQueuePaused ? (
              <button
                className="run-button"
                onClick={pauseWorkspaceQueue}
                disabled={!workspaceRunning}
              >
                Pause
              </button>
            ) : (
              <button className="run-button" onClick={resumeWorkspaceQueue} disabled={!workspaceRunning}>
                Resume
              </button>
            )}
            <button className="run-button" onClick={stopWorkspaceQueue} disabled={!workspaceRunning}>
              Stop
            </button>
            <button
              className="run-button"
              onClick={resumeWorkspaceFromFailure}
              disabled={workspaceRunning || workspacePlan.length === 0}
            >
              Resume From Failure
            </button>
            <button className="run-button" onClick={clearWorkspaceMission} disabled={workspaceRunning}>
              Clear Mission
            </button>
          </div>

          {workspaceMessage && <p className="muted">{workspaceMessage}</p>}
          <p className="muted">
            Queue state:{' '}
            {workspaceRunning
              ? workspaceQueuePaused
                ? 'Paused'
                : 'Running'
              : workspaceQueueStopped
                ? 'Stopped'
                : 'Idle'}
          </p>
          {workspaceUpdatedAt && (
            <p className="muted">Last mission save: {new Date(workspaceUpdatedAt).toLocaleString()}</p>
          )}

          <div className="workspace-step-list">
            {workspacePlan.length === 0 ? (
              <p className="muted">No mission plan yet. Enter a goal and generate one.</p>
            ) : (
              workspacePlan.map((step) => (
                <article className="workspace-step-card" key={step.id}>
                  <div className="workspace-step-head">
                    <strong>{step.title}</strong>
                    <span className={`workspace-status status-${step.status}`}>{step.status}</span>
                  </div>
                  <p className="muted">{step.request.detail}</p>
                  <p className="workspace-step-result">{step.result}</p>
                  <div className="workspace-step-actions">
                    <button
                      className="run-button"
                      onClick={() => executeWorkspaceStep(step.id)}
                      disabled={workspaceRunning}
                    >
                      Execute Step
                    </button>
                    {step.status === 'failed' && (
                      <button
                        className="run-button"
                        onClick={() => executeWorkspaceStep(step.id)}
                        disabled={workspaceRunning}
                      >
                        Retry
                      </button>
                    )}
                  </div>
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
          <div className="admin-session-row">
            <span>
              Admin session:{' '}
              <strong>{adminUnlocked ? 'Unlocked' : 'Locked'}</strong>
              {adminUnlocked && adminExpiresAt
                ? ` (expires ${new Date(adminExpiresAt).toLocaleTimeString()})`
                : ''}
            </span>
            {adminUnlocked ? (
              <button className="run-button" onClick={lockAdminSession}>
                Lock
              </button>
            ) : null}
          </div>
          {adminMessage && <p className="muted">{adminMessage}</p>}
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
        <span>Version: v0.6.0-workspace-mvp</span>
      </footer>
    </div>
  )
}

export default App
