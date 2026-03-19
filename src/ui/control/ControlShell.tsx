import { useEffect, useMemo, useState } from 'react'
import type { PolicySnapshot } from '../../core/policy/policyAdapter'
import type { ModelRouterConfig, ModelProviderId, ProviderHealth, RoutingProfile } from '../../core/models/router'
import {
  countConnectedAdapters,
  createChannelAdapters,
  toggleChannelAdapter,
  type ChannelAdapter,
} from '../../core/channels/adapters'
import {
  approveQueuedAction,
  createSeedQueue,
  denyQueuedAction,
  enqueueAction,
  type QueueItem,
} from '../../core/execution/queue'
import { deriveMemoryState, loadMemoryState, saveMemoryState } from '../../core/memory/sessionStore'
import { ApprovalStore } from '../../security/approvals'
import type { AuditEntry, AuditEventType } from '../../security/types'
import { buildCommandPlan, type CommandPlan } from '../../core/agent/commandOrchestrator'
import { executeTaskExecution, summarizeExecution } from '../../core/agent/actionAdapters'
import { createAnalyticsEvent, summarizeAnalytics, type AnalyticsEvent } from '../../core/agent/analyticsStore'
import { createBackupSnapshot, restoreBackupSnapshot, type BackupSnapshot } from '../../core/agent/backupRecovery'
import { deriveEncryptionStatus } from '../../core/agent/encryptionStatus'
import { deriveIntegrationHealth, integrationCatalog } from '../../core/agent/integrationCatalog'
import {
  createNotification,
  defaultNotificationPreferences,
  markNotificationRead,
  type NotificationItem,
  type NotificationPreferences,
} from '../../core/agent/notificationCenter'
import { notificationsFromExecution } from '../../core/agent/notificationHooks'
import { onboardingChecklist, type OnboardingTask } from '../../core/agent/onboarding'
import { defaultPluginRegistry, type PluginCard } from '../../core/agent/pluginRegistry'
import {
  addWorkflowStep,
  defaultWorkflows,
  moveWorkflowStep,
  toggleWorkflowApproval,
  type WorkflowTemplate,
} from '../../core/agent/workflowBuilder'
import {
  defaultFeatureToggles,
  defaultIntegrationState,
  defaultPermissionState,
  safeParseJson,
  type FeatureToggleState,
  type IntegrationState,
  type PermissionKey,
  type PermissionState,
} from '../../core/agent/platformFeatures'
import type { UserAccount, UserRole } from '../../core/user/userRegistry'
import { Channels } from './surfaces/Channels'
import type { ChannelStatus as ChannelStatusView } from './surfaces/Channels'
import { Models } from './surfaces/Models'
import { Tools, type ExecutionQueueItem } from './surfaces/Tools'
import { Memory } from './surfaces/Memory'
import type { SessionMemory as SessionMemoryView } from './surfaces/Memory'
import { Nodes } from './surfaces/Nodes'
import type { BridgeSummary, DeviceNode, RelaySummary } from './surfaces/Nodes'
import { Workspace } from './surfaces/Workspace'
import type { WorkspaceMission } from './surfaces/Workspace'
import { Audit } from './surfaces/Audit'
import './ControlShell.css'

type ChannelStatus = {
  id: string
  label: string
  status: 'connected' | 'pending' | 'disabled'
  detail: string
}

type ControlShellProps = {
  adminUnlocked: boolean
  adminExpiresAt: number | null
  uiTheme: 'night' | 'day'
  onToggleTheme: () => void
  policySnapshot: PolicySnapshot
  routerConfig: ModelRouterConfig
  providerHealth: ProviderHealth[]
  channels: ChannelStatus[]
  onRoutingProfileChange: (profile: RoutingProfile) => void
  onProviderEnabledChange: (id: ModelProviderId, enabled: boolean) => void
  onProviderKeyChange: (id: ModelProviderId, key: string) => void
  auditEntries: AuditEntry[]
  learnedSkills: string[]
  totalDocuments: number
  totalWords: number
  workspaceMissions: WorkspaceMission[]
  relay: RelaySummary
  bridge: BridgeSummary
  onRefreshRelay: () => void
  onSyncRelay: () => void
  onSubmitRelayHeartbeat: () => void
  onCompleteRelayRequest: (requestId: string) => void
  onRefreshBridge: () => void
  onToggleBridge: (enabled: boolean) => void
  desktopAdapterEnabled?: boolean
  cloudRelayEnabled?: boolean
  onToggleDesktopAdapter?: (enabled: boolean) => void
  onToggleCloudRelay?: (enabled: boolean) => void
  m4RoutingPreview?: Array<{
    kind: 'channel' | 'call'
    primaryMode: string
    fallbackChain: string[]
  }>
  smartglass?: {
    enabled: boolean
    voiceModeActive: boolean
    confirmationRequired: boolean
  }
  onToggleSmartglass?: (enabled: boolean) => void
  m6Language?: {
    selectedLanguage: string
    sttLanguage: string
    responseLanguage: string
    ttsLanguage: string
    fallbackChain: string[]
    runtimeNote: string
  }
  m6LanguageOptions?: Array<{ code: string; label: string }>
  onSelectM6Language?: (code: string) => void
  onAppendAudit?: (type: AuditEventType, payload: Record<string, unknown>) => Promise<void> | void
}

type TabId = 'chat' | 'workspace' | 'automations' | 'integrations' | 'learn'

type ConversationItem = {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: string
}

type PermissionPrompt = {
  id: string
  permission: PermissionKey
  connector: string
  command: string
}

const tabs: Array<{ id: TabId; label: string; description: string }> = [
  { id: 'chat', label: 'Chat', description: 'Talk to your AI and delegate real-world tasks.' },
  { id: 'workspace', label: 'Workspace', description: 'Track multi-step missions and outcomes.' },
  { id: 'automations', label: 'Automations', description: 'Queue and run actions across apps.' },
  { id: 'integrations', label: 'Integrations', description: 'Connect channels, devices, and bridges.' },
  { id: 'learn', label: 'Learn', description: 'Grow local brain memory and model intelligence.' },
]

const defaultUsers: UserAccount[] = [
  {
    id: 'owner-1',
    username: 'owner',
    passwordHash: 'managed-by-auth-layer',
    role: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

const STORAGE_KEYS = {
  features: 'paxion.settings.features.v1',
  integrations: 'paxion.settings.integrations.v1',
  permissions: 'paxion.settings.permissions.v1',
  users: 'paxion.settings.users.v1',
  notificationPrefs: 'paxion.settings.notificationPrefs.v1',
} as const

function nowIso(): string {
  return new Date().toISOString()
}

function mapQueueToView(items: QueueItem[]): ExecutionQueueItem[] {
  return items.map((item) => ({
    id: item.id,
    actionId: item.actionId,
    status: item.status,
    requestedAt: item.requestedAt,
    approvedAt: item.approvedAt,
    completedAt: item.completedAt,
    detail: item.detail,
  }))
}

export default function ControlShell({
  adminUnlocked,
  adminExpiresAt,
  uiTheme,
  onToggleTheme,
  policySnapshot,
  routerConfig,
  providerHealth,
  channels,
  onRoutingProfileChange,
  onProviderEnabledChange,
  onProviderKeyChange,
  auditEntries,
  learnedSkills,
  totalDocuments,
  totalWords,
  workspaceMissions,
  relay,
  bridge,
  onRefreshRelay,
  onSyncRelay,
  onSubmitRelayHeartbeat,
  onCompleteRelayRequest,
  onRefreshBridge,
  onToggleBridge,
  desktopAdapterEnabled = false,
  cloudRelayEnabled = false,
  onToggleDesktopAdapter,
  onToggleCloudRelay,
  m4RoutingPreview = [],
  smartglass = {
    enabled: false,
    voiceModeActive: false,
    confirmationRequired: false,
  },
  onToggleSmartglass,
  m6Language = {
    selectedLanguage: 'en-US',
    sttLanguage: 'en-US',
    responseLanguage: 'English',
    ttsLanguage: 'en-US',
    fallbackChain: ['en-US'],
    runtimeNote: '',
  },
  m6LanguageOptions = [],
  onSelectM6Language,
  onAppendAudit,
}: ControlShellProps) {
  const [activeTab, setActiveTab] = useState<TabId>('chat')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [adapterState, setAdapterState] = useState<ChannelAdapter[]>(() => createChannelAdapters(channels))
  const [queueItems, setQueueItems] = useState<QueueItem[]>(() => createSeedQueue())
  const [missionItems, setMissionItems] = useState<WorkspaceMission[]>(workspaceMissions)
  const [chatInput, setChatInput] = useState('')
  const [latestPlan, setLatestPlan] = useState<CommandPlan | null>(null)
  const [lastQueueMessage, setLastQueueMessage] = useState('Ready to execute your command.')
  const [permissionPrompts, setPermissionPrompts] = useState<PermissionPrompt[]>([])
  const [chatFeed, setChatFeed] = useState<ConversationItem[]>([
    {
      id: 'boot-1',
      role: 'assistant',
      text: 'I am online. Tell me what you want me to do across chat, web, apps, files, or devices.',
      createdAt: nowIso(),
    },
  ])

  const [features, setFeatures] = useState<FeatureToggleState>(() => {
    if (typeof window === 'undefined') {
      return defaultFeatureToggles
    }
    return safeParseJson(
      window.localStorage.getItem(STORAGE_KEYS.features),
      defaultFeatureToggles,
    )
  })

  const [integrations, setIntegrations] = useState<IntegrationState>(() => {
    if (typeof window === 'undefined') {
      return defaultIntegrationState
    }
    return safeParseJson(
      window.localStorage.getItem(STORAGE_KEYS.integrations),
      defaultIntegrationState,
    )
  })

  const [permissions, setPermissions] = useState<PermissionState>(() => {
    if (typeof window === 'undefined') {
      return defaultPermissionState
    }
    return safeParseJson(
      window.localStorage.getItem(STORAGE_KEYS.permissions),
      defaultPermissionState,
    )
  })

  const [users, setUsers] = useState<UserAccount[]>(() => {
    if (typeof window === 'undefined') {
      return defaultUsers
    }
    return safeParseJson(window.localStorage.getItem(STORAGE_KEYS.users), defaultUsers)
  })

  const [newUsername, setNewUsername] = useState('')
  const [newUserRole, setNewUserRole] = useState<UserRole>('viewer')
  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEvent[]>([])
  const [backupSnapshots, setBackupSnapshots] = useState<BackupSnapshot[]>([])
  const [backupMessage, setBackupMessage] = useState('No backup created yet.')
  const [plugins, setPlugins] = useState<PluginCard[]>(defaultPluginRegistry)
  const [onboardingTasks, setOnboardingTasks] = useState<OnboardingTask[]>(onboardingChecklist)
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>(defaultWorkflows)
  const [activeWorkflowId, setActiveWorkflowId] = useState<string>(defaultWorkflows[0]?.id ?? '')
  const [workflowStepTitle, setWorkflowStepTitle] = useState('')
  const [workflowStepAction, setWorkflowStepAction] = useState('agent.browser.execute')
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(() => {
    if (typeof window === 'undefined') {
      return defaultNotificationPreferences
    }
    return safeParseJson(
      window.localStorage.getItem(STORAGE_KEYS.notificationPrefs),
      defaultNotificationPreferences,
    )
  })

  const approvalStore = useMemo(() => new ApprovalStore(), [])

  useEffect(() => {
    setAdapterState(createChannelAdapters(channels))
  }, [channels])

  useEffect(() => {
    if (workspaceMissions.length > 0) {
      setMissionItems(workspaceMissions)
    }
  }, [workspaceMissions])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.features, JSON.stringify(features))
    }
  }, [features])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.integrations, JSON.stringify(integrations))
    }
  }, [integrations])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.permissions, JSON.stringify(permissions))
    }
  }, [permissions])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users))
    }
  }, [users])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.notificationPrefs, JSON.stringify(notificationPrefs))
    }
  }, [notificationPrefs])

  const memoryState = useMemo(() => {
    const derived = deriveMemoryState(queueItems, learnedSkills, totalDocuments, totalWords)
    const persisted = loadMemoryState()
    if (!persisted) {
      return derived
    }

    const mergedSessions = [
      ...derived.sessions,
      ...persisted.sessions.filter(
        (session) => !derived.sessions.some((derivedSession) => derivedSession.id === session.id),
      ),
    ].slice(0, 24)

    return {
      ...derived,
      sessions: mergedSessions,
    }
  }, [learnedSkills, queueItems, totalDocuments, totalWords])

  useEffect(() => {
    saveMemoryState(memoryState)
  }, [memoryState])

  const queueViews = useMemo(() => mapQueueToView(queueItems), [queueItems])

  const channelViews: ChannelStatusView[] = useMemo(
    () =>
      adapterState.map((adapter) => ({
        id: adapter.id,
        name: adapter.name,
        status: adapter.status,
        description: `${adapter.description} (${adapter.mode})`,
        lastActiveAt: adapter.lastActiveAt,
      })),
    [adapterState],
  )

  const sessionViews: SessionMemoryView[] = useMemo(
    () =>
      memoryState.sessions.map((session) => ({
        id: session.id,
        channelId: session.channelId,
        title: session.title,
        compactSummary: session.compactSummary,
        createdAt: session.createdAt,
        facts: session.facts,
        relevanceScore: session.relevanceScore,
      })),
    [memoryState.sessions],
  )

  const nodeViews: DeviceNode[] = useMemo(() => {
    const now = nowIso()
    const localNode: DeviceNode = {
      id: 'node-local-01',
      name: 'Primary Desktop',
      type: 'local',
      status: 'connected',
      lastSeen: now,
    }

    const relayNodes = adapterState
      .filter((adapter) => adapter.id !== 'webchat' && adapter.enabled)
      .map((adapter) => {
        const relayStatus: DeviceNode['status'] =
          adapter.status === 'connected' ? 'connected' : 'syncing'

        return {
          id: `relay-${adapter.id}`,
          name: `${adapter.name} Relay`,
          type: 'relay' as const,
          status: relayStatus,
          lastSeen: adapter.lastActiveAt ?? now,
        }
      })

    const bridgeNode: DeviceNode = {
      id: 'bridge-mobile-01',
      name: 'Mobile Bridge',
      type: 'bridge',
      status: relayNodes.length > 0 ? 'connected' : 'disconnected',
      lastSeen: now,
    }

    return [localNode, ...relayNodes, bridgeNode]
  }, [adapterState])

  const connectedChannels = useMemo(() => countConnectedAdapters(adapterState), [adapterState])
  const readyProviders = useMemo(
    () => providerHealth.filter((provider) => provider.ready).length,
    [providerHealth],
  )
  const pendingApprovals = useMemo(
    () => queueItems.filter((item) => item.status === 'pending').length,
    [queueItems],
  )
  const integrationHealth = useMemo(() => deriveIntegrationHealth(integrations), [integrations])
  const encryptionStatus = useMemo(() => deriveEncryptionStatus(), [])
  const activeWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === activeWorkflowId) ?? workflows[0] ?? null,
    [activeWorkflowId, workflows],
  )

  useEffect(() => {
    setOnboardingTasks((prev) =>
      prev.map((task) => {
        if (task.id === 'connect-models') {
          return { ...task, done: readyProviders > 0 }
        }
        if (task.id === 'enable-integrations') {
          const activeCount = Object.values(integrations).filter(Boolean).length
          return { ...task, done: activeCount >= 2 }
        }
        if (task.id === 'set-permissions') {
          const activePerms = Object.values(permissions).filter(Boolean).length
          return { ...task, done: activePerms >= 3 }
        }
        if (task.id === 'verify-backup') {
          return { ...task, done: backupSnapshots.length > 0 }
        }
        return task
      }),
    )
  }, [backupSnapshots.length, integrations, permissions, readyProviders])

  function enqueueMissionAction() {
    const request = {
      actionId: 'workspace.generateMission',
      category: 'codegen' as const,
      targetPath: '/workspace/missions/auto-generated-mission.ts',
      detail: 'Generate mission implementation scaffold from Workspace.',
      jurisdiction: 'workspace',
    }

    setQueueItems((prev) => enqueueAction(prev, request))
    setLastQueueMessage('Mission action queued successfully.')
  }

  function addConversation(role: 'user' | 'assistant', text: string) {
    setChatFeed((prev) => [
      {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        role,
        text,
        createdAt: nowIso(),
      },
      ...prev,
    ])
  }

  async function runAgentCommand() {
    const command = chatInput.trim()
    if (!command) {
      return
    }

    addConversation('user', command)

    const plan = buildCommandPlan(command, providerHealth, permissions)
    setLatestPlan(plan)
    setAnalyticsEvents((prev) => [createAnalyticsEvent('command', command), ...prev].slice(0, 200))

    const executionResults = await executeTaskExecution(plan.tasks, integrations, {
      enabled: Boolean(window.paxion),
    })

    const runnable = plan.tasks.filter((task) => {
      const result = executionResults.find((item) => item.taskId === task.id)
      return result?.status === 'queued'
    })
    const blocked = plan.tasks.filter((task) => {
      const result = executionResults.find((item) => item.taskId === task.id)
      return result?.status === 'blocked-permission'
    })
    const blockedIntegration = plan.tasks.filter((task) => {
      const result = executionResults.find((item) => item.taskId === task.id)
      return result?.status === 'blocked-integration'
    })
    const executed = plan.tasks.filter((task) => {
      const result = executionResults.find((item) => item.taskId === task.id)
      return result?.status === 'executed'
    })
    const failed = plan.tasks.filter((task) => {
      const result = executionResults.find((item) => item.taskId === task.id)
      return result?.status === 'failed'
    })

    if (runnable.length > 0) {
      setQueueItems((prev) =>
        runnable.reduce((acc, task) => enqueueAction(acc, task.request), prev),
      )

      runnable.forEach((task) => {
        setAnalyticsEvents((prev) => [
          createAnalyticsEvent('queued', task.request.actionId),
          ...prev,
        ].slice(0, 200))
        void onAppendAudit?.('action_result', {
          actionId: task.request.actionId,
          detail: task.request.detail,
          source: 'chat-orchestrator',
          model: plan.selectedModel,
        })
      })
    }

    if (blocked.length > 0) {
      blocked.forEach((task) => {
        setAnalyticsEvents((prev) => [
          createAnalyticsEvent('blocked-permission', task.request.actionId),
          ...prev,
        ].slice(0, 200))
      })
      setPermissionPrompts((prev) => [
        ...blocked.map((task) => ({
          id: task.id,
          permission: task.requestedPermission as PermissionKey,
          connector: task.connector,
          command,
        })),
        ...prev,
      ])
    }

    if (blockedIntegration.length > 0) {
      blockedIntegration.forEach((task) => {
        setAnalyticsEvents((prev) => [
          createAnalyticsEvent('blocked-integration', task.request.actionId),
          ...prev,
        ].slice(0, 200))
      })
    }

    if (executed.length > 0) {
      executed.forEach((task) => {
        void onAppendAudit?.('action_result', {
          actionId: task.request.actionId,
          detail: task.request.detail,
          source: 'chat-orchestrator-live',
          model: plan.selectedModel,
          status: 'executed',
        })
      })
    }

    if (failed.length > 0) {
      failed.forEach((task) => {
        void onAppendAudit?.('action_result', {
          actionId: task.request.actionId,
          detail: task.request.detail,
          source: 'chat-orchestrator-live',
          model: plan.selectedModel,
          status: 'failed',
        })
      })
    }

    const generatedNotifications = notificationsFromExecution(executionResults)
    if (generatedNotifications.length > 0) {
      setNotifications((prev) => [...generatedNotifications, ...prev].slice(0, 80))
    }

    const summary = summarizeExecution(executionResults)
    addConversation('assistant', `${plan.assistantMessage} ${summary}`)
    setLastQueueMessage(summary)
    setChatInput('')
    setOnboardingTasks((prev) =>
      prev.map((task) =>
        task.id === 'run-first-command'
          ? {
              ...task,
              done: true,
            }
          : task,
      ),
    )
  }

  function approvePermissionRequest(prompt: PermissionPrompt) {
    setPermissions((prev) => ({
      ...prev,
      [prompt.permission]: true,
    }))
    setPermissionPrompts((prev) => prev.filter((item) => item.id !== prompt.id))
    addConversation('assistant', `Permission enabled: ${prompt.permission}. You can rerun that command now.`)
  }

  function onChannelToggle(channelId: string, enabled: boolean) {
    setAdapterState((prev) => toggleChannelAdapter(prev, channelId as ChannelAdapter['id'], enabled))
    void onAppendAudit?.('action_result', {
      actionId: 'channels.toggleAdapter',
      channelId,
      enabled,
      source: 'control-shell',
    })
  }

  function onApproveQueueItem(itemId: string) {
    setQueueItems((prev) => {
      const resolution = approveQueuedAction(prev, itemId, adminUnlocked, approvalStore)
      setLastQueueMessage(resolution.reason)
      const resolved = resolution.resolved
      if (resolved) {
        void onAppendAudit?.('approval_use', {
          actionId: resolved.actionId,
          queueItemId: resolved.id,
          status: resolved.status,
          reason: resolution.reason,
          source: 'control-shell',
        })
      }
      return resolution.items
    })
  }

  function onDenyQueueItem(itemId: string) {
    setQueueItems((prev) => {
      const resolution = denyQueuedAction(prev, itemId)
      setLastQueueMessage(resolution.reason)
      return resolution.items
    })
  }

  function addUser() {
    const username = newUsername.trim()
    if (!username) {
      return
    }

    const timestamp = nowIso()
    setUsers((prev) => [
      {
        id: `user-${Date.now().toString(36)}`,
        username,
        passwordHash: 'managed-by-auth-layer',
        role: newUserRole,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      ...prev,
    ])
    setNewUsername('')
  }

  function setUserRole(userId: string, role: UserRole) {
    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId
          ? {
              ...user,
              role,
              updatedAt: nowIso(),
            }
          : user,
      ),
    )
  }

  function addStepToWorkflow() {
    const title = workflowStepTitle.trim()
    const action = workflowStepAction.trim()

    if (!activeWorkflow || !title || !action) {
      return
    }

    setWorkflows((prev) =>
      prev.map((workflow) =>
        workflow.id === activeWorkflow.id ? addWorkflowStep(workflow, title, action) : workflow,
      ),
    )
    setWorkflowStepTitle('')
  }

  function reorderWorkflowStep(stepId: string, direction: 'up' | 'down') {
    if (!activeWorkflow) {
      return
    }

    setWorkflows((prev) =>
      prev.map((workflow) =>
        workflow.id === activeWorkflow.id ? moveWorkflowStep(workflow, stepId, direction) : workflow,
      ),
    )
  }

  function toggleWorkflowStepApproval(stepId: string) {
    if (!activeWorkflow) {
      return
    }

    setWorkflows((prev) =>
      prev.map((workflow) =>
        workflow.id === activeWorkflow.id ? toggleWorkflowApproval(workflow, stepId) : workflow,
      ),
    )
  }

  function markNotificationAsRead(notificationId: string) {
    setNotifications((prev) => markNotificationRead(prev, notificationId))
  }

  function pushManualNotification(channel: 'in-app' | 'email' | 'sms' | 'push') {
    setNotifications((prev) => [
      createNotification('Manual alert', `Notification sent through ${channel}.`, channel),
      ...prev,
    ].slice(0, 80))
  }

  const activeTabMeta = tabs.find((item) => item.id === activeTab) ?? tabs[0]
  const analyticsSummary = useMemo(() => summarizeAnalytics(analyticsEvents), [analyticsEvents])

  function createBackupNow() {
    const snapshot = createBackupSnapshot({
      features,
      integrations,
      permissions,
      users,
      plugins,
      createdFrom: 'control-shell-settings',
    })
    setBackupSnapshots((prev) => [snapshot, ...prev].slice(0, 15))
    setBackupMessage(`Backup created at ${new Date(snapshot.createdAt).toLocaleString()}`)
  }

  function restoreLatestBackup() {
    const latest = backupSnapshots[0]
    if (!latest) {
      setBackupMessage('No backup found to restore.')
      return
    }

    const restored = restoreBackupSnapshot(latest)
    setFeatures((restored.features as FeatureToggleState | undefined) ?? defaultFeatureToggles)
    setIntegrations((restored.integrations as IntegrationState | undefined) ?? defaultIntegrationState)
    setPermissions((restored.permissions as PermissionState | undefined) ?? defaultPermissionState)
    setUsers((restored.users as UserAccount[] | undefined) ?? defaultUsers)
    setPlugins((restored.plugins as PluginCard[] | undefined) ?? defaultPluginRegistry)
    setBackupMessage(`Restored backup from ${new Date(latest.createdAt).toLocaleString()}`)
  }

  return (
    <div className={`clean-shell theme-${uiTheme}`}>
      <header className="clean-header">
        <div>
          <p className="clean-kicker">Your Personal AI Control</p>
          <h1>Command Center</h1>
          <p>
            Friendly assistant experience with real execution, approvals, integrations, and learning.
          </p>
        </div>
        <div className="clean-actions">
          <button className="clean-btn" onClick={onToggleTheme}>
            Theme: {uiTheme === 'night' ? 'Night' : 'Day'}
          </button>
          <button className="clean-btn clean-btn-secondary" onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
        </div>
      </header>

      <section className="clean-metrics" aria-label="Status cards">
        <article className="clean-metric">
          <span>Admin Session</span>
          <strong>{adminUnlocked ? 'Unlocked' : 'Locked'}</strong>
          <small>
            {adminUnlocked && adminExpiresAt
              ? `Expires ${new Date(adminExpiresAt).toLocaleTimeString()}`
              : 'Sensitive actions will ask for approval.'}
          </small>
        </article>
        <article className="clean-metric">
          <span>Connected Channels</span>
          <strong>
            {connectedChannels}/{channels.length}
          </strong>
          <small>Ready for command execution.</small>
        </article>
        <article className="clean-metric">
          <span>Ready Models</span>
          <strong>
            {readyProviders}/{providerHealth.length}
          </strong>
          <small>Auto-routing picks best model per task.</small>
        </article>
        <article className="clean-metric">
          <span>Pending Approvals</span>
          <strong>{pendingApprovals}</strong>
          <small>{lastQueueMessage}</small>
        </article>
      </section>

      <nav className="clean-tabs" role="tablist" aria-label="Main tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'clean-tab is-active' : 'clean-tab'}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.label}</span>
            <small>{tab.description}</small>
          </button>
        ))}
      </nav>

      <main className="clean-main" role="tabpanel" aria-label={activeTabMeta.label}>
        {activeTab === 'chat' && (
          <div className="clean-grid">
            <section className="clean-card">
              <h2>Chat With Your AI</h2>
              <p className="muted">
                Give natural commands. The assistant plans tasks, auto-selects model(s), asks for permission if needed,
                and queues work.
              </p>
              <textarea
                className="clean-textarea"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Example: open WhatsApp, message Alex that meeting moved to 7pm, show me reply and ask before sending next message"
              />
              <div className="clean-row">
                <button className="clean-btn" onClick={runAgentCommand}>
                  Run Command
                </button>
              </div>

              {latestPlan && (
                <article className="clean-plan">
                  <strong>Latest Plan</strong>
                  <p className="muted">Model: {latestPlan.selectedModel}</p>
                  <p className="muted">Multitask: {latestPlan.multitask ? 'yes' : 'no'}</p>
                  <p className="muted">Tasks: {latestPlan.tasks.length}</p>
                </article>
              )}
            </section>

            <section className="clean-card">
              <h2>Permission Requests</h2>
              {permissionPrompts.length === 0 ? (
                <p className="muted">No pending permission request.</p>
              ) : (
                <div className="clean-list">
                  {permissionPrompts.slice(0, 8).map((prompt) => (
                    <article key={prompt.id} className="clean-list-item">
                      <strong>{prompt.connector}</strong>
                      <p className="muted">Needs: {prompt.permission}</p>
                      <button className="clean-btn clean-btn-secondary" onClick={() => approvePermissionRequest(prompt)}>
                        Allow and Continue
                      </button>
                    </article>
                  ))}
                </div>
              )}

              <h3>Conversation</h3>
              <div className="clean-feed">
                {chatFeed.slice(0, 12).map((item) => (
                  <article key={item.id} className={item.role === 'assistant' ? 'clean-msg assistant' : 'clean-msg user'}>
                    <strong>{item.role === 'assistant' ? 'AI' : 'You'}</strong>
                    <p>{item.text}</p>
                  </article>
                ))}
              </div>

              <h3>Onboarding</h3>
              <div className="clean-list">
                {onboardingTasks.map((task) => (
                  <article key={task.id} className="clean-list-item">
                    <strong>{task.title}</strong>
                    <p className="muted">{task.done ? 'Completed' : 'Pending'}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'workspace' && (
          <Workspace
            missions={missionItems}
            learnedSkills={learnedSkills}
            onCreateMission={enqueueMissionAction}
          />
        )}

        {activeTab === 'automations' && (
          <div className="clean-grid">
            <section className="clean-card">
              <h2>Automation Queue</h2>
              <Tools queueItems={queueViews} onApprove={onApproveQueueItem} onDeny={onDenyQueueItem} />

              <h3>Workflow Builder</h3>
              <p className="muted">Build reusable multi-step flows. Reorder steps like a drag-and-drop board.</p>
              <div className="clean-row">
                <select
                  className="clean-input"
                  value={activeWorkflow?.id ?? ''}
                  onChange={(event) => setActiveWorkflowId(event.target.value)}
                >
                  {workflows.map((workflow) => (
                    <option key={workflow.id} value={workflow.id}>
                      {workflow.name}
                    </option>
                  ))}
                </select>
              </div>
              {activeWorkflow && (
                <>
                  <div className="clean-row wrap">
                    <input
                      className="clean-input"
                      value={workflowStepTitle}
                      onChange={(event) => setWorkflowStepTitle(event.target.value)}
                      placeholder="step title"
                    />
                    <input
                      className="clean-input"
                      value={workflowStepAction}
                      onChange={(event) => setWorkflowStepAction(event.target.value)}
                      placeholder="action id"
                    />
                    <button className="clean-btn" onClick={addStepToWorkflow}>
                      Add Step
                    </button>
                  </div>

                  <div className="clean-list">
                    {activeWorkflow.steps.map((step) => (
                      <article key={step.id} className="clean-list-item">
                        <strong>{step.title}</strong>
                        <p className="muted">{step.action}</p>
                        <div className="clean-row wrap">
                          <button className="clean-btn clean-btn-secondary" onClick={() => reorderWorkflowStep(step.id, 'up')}>
                            Move Up
                          </button>
                          <button className="clean-btn clean-btn-secondary" onClick={() => reorderWorkflowStep(step.id, 'down')}>
                            Move Down
                          </button>
                          <button className="clean-btn clean-btn-secondary" onClick={() => toggleWorkflowStepApproval(step.id)}>
                            {step.requiresApproval ? 'Approval: On' : 'Approval: Off'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </section>
            <section className="clean-card">
              <h2>Quick Actions</h2>
              <p className="muted">These represent real-world actions across messaging, email, social, calls, and media generation.</p>
              <div className="clean-row wrap">
                <button className="clean-btn" onClick={() => setChatInput('Send WhatsApp update to team and ask before reply')}>
                  WhatsApp workflow
                </button>
                <button className="clean-btn" onClick={() => setChatInput('Draft and send email summary to client')}>
                  Email workflow
                </button>
                <button className="clean-btn" onClick={() => setChatInput('Create post and publish to social channels')}>
                  Social post
                </button>
                <button className="clean-btn" onClick={() => setChatInput('Generate image for today campaign')}>
                  Image generation
                </button>
                <button className="clean-btn" onClick={() => setChatInput('Call customer and summarize call result')}>
                  Call on my behalf
                </button>
              </div>

              <h3>Plugin Marketplace</h3>
              <div className="clean-list">
                {plugins.map((plugin) => (
                  <article key={plugin.id} className="clean-list-item">
                    <strong>{plugin.name}</strong>
                    <p className="muted">{plugin.description}</p>
                    <label className="clean-toggle">
                      <input
                        type="checkbox"
                        checked={plugin.enabled}
                        onChange={(event) =>
                          setPlugins((prev) =>
                            prev.map((item) =>
                              item.id === plugin.id
                                ? {
                                    ...item,
                                    enabled: event.target.checked,
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                      <span>{plugin.enabled ? 'enabled' : 'disabled'}</span>
                    </label>
                  </article>
                ))}
              </div>

              <h3>Notification Center</h3>
              <div className="clean-row wrap">
                <button className="clean-btn clean-btn-secondary" onClick={() => pushManualNotification('in-app')}>
                  In-App
                </button>
                <button className="clean-btn clean-btn-secondary" onClick={() => pushManualNotification('email')}>
                  Email
                </button>
                <button className="clean-btn clean-btn-secondary" onClick={() => pushManualNotification('sms')}>
                  SMS
                </button>
                <button className="clean-btn clean-btn-secondary" onClick={() => pushManualNotification('push')}>
                  Push
                </button>
              </div>
              <div className="clean-list">
                {notifications.length === 0 ? (
                  <article className="clean-list-item">
                    <p className="muted">No notifications yet.</p>
                  </article>
                ) : (
                  notifications.slice(0, 8).map((item) => (
                    <article key={item.id} className="clean-list-item">
                      <strong>{item.title}</strong>
                      <p className="muted">{item.body}</p>
                      <p className="muted">{item.channel} • {new Date(item.createdAt).toLocaleTimeString()}</p>
                      {!item.read && (
                        <button className="clean-btn clean-btn-secondary" onClick={() => markNotificationAsRead(item.id)}>
                          Mark Read
                        </button>
                      )}
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="clean-grid">
            <section className="clean-card">
              <h2>Channel Integrations</h2>
              <Channels channels={channelViews} onChannelToggle={onChannelToggle} />

              <h3>Built-in Services</h3>
              <div className="clean-list">
                {integrationCatalog.map((service) => {
                  const health = integrationHealth.find((item) => item.id === service.id)

                  return (
                    <article key={service.id} className="clean-list-item">
                      <strong>{service.label}</strong>
                      <p className="muted">{service.description}</p>
                      <p className="muted">Use cases: {service.usefulFor.join(', ')}</p>
                      <p className="muted">Status: {health?.status ?? 'disconnected'}</p>
                      <button
                        className="clean-btn clean-btn-secondary"
                        onClick={() =>
                          setIntegrations((prev) => ({
                            ...prev,
                            [service.id]: !prev[service.id],
                          }))
                        }
                      >
                        {health?.connected ? 'Disconnect' : 'Connect'}
                      </button>
                    </article>
                  )
                })}
              </div>
            </section>
            <section className="clean-card">
              <h2>Devices and Bridge</h2>
              <Nodes
                nodes={nodeViews}
                relay={relay}
                bridge={bridge}
                desktopAdapterEnabled={desktopAdapterEnabled}
                cloudRelayEnabled={cloudRelayEnabled}
                onToggleDesktopAdapter={onToggleDesktopAdapter}
                onToggleCloudRelay={onToggleCloudRelay}
                m4RoutingPreview={m4RoutingPreview}
                smartglass={smartglass}
                onToggleSmartglass={onToggleSmartglass}
                m6Language={m6Language}
                m6LanguageOptions={m6LanguageOptions}
                onSelectM6Language={onSelectM6Language}
                onPairNew={() => setLastQueueMessage('New device pairing started.')}
                onRotateSecret={(nodeId) => setLastQueueMessage(`Requested secret rotation for ${nodeId}.`)}
                onRefreshRelay={onRefreshRelay}
                onSyncRelay={onSyncRelay}
                onSubmitRelayHeartbeat={onSubmitRelayHeartbeat}
                onCompleteRelayRequest={onCompleteRelayRequest}
                onRefreshBridge={onRefreshBridge}
                onToggleBridge={onToggleBridge}
              />
            </section>
          </div>
        )}

        {activeTab === 'learn' && (
          <div className="clean-grid">
            <section className="clean-card">
              <h2>Local Brain Learning</h2>
              <p className="muted">
                Local brain is active. It learns from task outcomes, model responses, and workflow traces to become more capable over time.
              </p>
              <p className="muted">Learned skills: {learnedSkills.length}</p>
              <Memory sessions={sessionViews} totalDocuments={memoryState.totalDocuments} totalWords={memoryState.totalWords} />
            </section>
            <section className="clean-card">
              <h2>Auto Model Routing</h2>
              <Models
                defaultProfile={routerConfig.defaultProfile}
                fallbackOrder={routerConfig.fallbackOrder}
                providers={providerHealth}
                onProfileChange={onRoutingProfileChange}
                onProviderEnabledChange={onProviderEnabledChange}
                onProviderKeyChange={onProviderKeyChange}
              />

              <h3>Analytics Dashboard</h3>
              <div className="clean-list">
                <article className="clean-list-item">
                  <strong>Total Commands</strong>
                  <p className="muted">{analyticsSummary.totalCommands}</p>
                </article>
                <article className="clean-list-item">
                  <strong>Queued Actions</strong>
                  <p className="muted">{analyticsSummary.queuedActions}</p>
                </article>
                <article className="clean-list-item">
                  <strong>Permission Blocks</strong>
                  <p className="muted">{analyticsSummary.blockedPermission}</p>
                </article>
                <article className="clean-list-item">
                  <strong>Integration Blocks</strong>
                  <p className="muted">{analyticsSummary.blockedIntegration}</p>
                </article>
              </div>

              <h3 style={{ marginTop: '14px' }}>Audit Timeline</h3>
              <Audit entries={auditEntries} adminUnlocked={adminUnlocked} />
            </section>
          </div>
        )}
      </main>

      {settingsOpen && (
        <div className="clean-settings-overlay" role="dialog" aria-modal="true" aria-label="Settings">
          <section className="clean-settings">
            <header className="clean-settings-head">
              <h2>Settings</h2>
              <button className="clean-btn clean-btn-secondary" onClick={() => setSettingsOpen(false)}>
                Close
              </button>
            </header>

            <div className="clean-settings-grid">
              <article className="clean-card">
                <h3>Permissions</h3>
                <p className="muted">Real actions require explicit permission. Toggle what AI can do automatically.</p>
                {Object.entries(permissions).map(([key, value]) => (
                  <label key={key} className="clean-toggle">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(event) =>
                        setPermissions((prev) => ({
                          ...prev,
                          [key]: event.target.checked,
                        }))
                      }
                    />
                    <span>{key}</span>
                  </label>
                ))}
              </article>

              <article className="clean-card">
                <h3>Features</h3>
                <p className="muted">Enable or disable major platform modules.</p>
                {Object.entries(features).map(([key, value]) => (
                  <label key={key} className="clean-toggle">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(event) =>
                        setFeatures((prev) => ({
                          ...prev,
                          [key]: event.target.checked,
                        }))
                      }
                    />
                    <span>{key}</span>
                  </label>
                ))}
              </article>

              <article className="clean-card">
                <h3>Integrations</h3>
                <p className="muted">Connect external services and device ecosystems.</p>
                {Object.entries(integrations).map(([key, value]) => (
                  <label key={key} className="clean-toggle">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(event) =>
                        setIntegrations((prev) => ({
                          ...prev,
                          [key]: event.target.checked,
                        }))
                      }
                    />
                    <span>{key}</span>
                  </label>
                ))}
              </article>

              <article className="clean-card">
                <h3>Notification Preferences</h3>
                <p className="muted">Choose where the assistant should notify you for completed or blocked tasks.</p>
                <label className="clean-toggle">
                  <input
                    type="checkbox"
                    checked={notificationPrefs.email}
                    onChange={(event) =>
                      setNotificationPrefs((prev) => ({
                        ...prev,
                        email: event.target.checked,
                      }))
                    }
                  />
                  <span>Email alerts</span>
                </label>
                <label className="clean-toggle">
                  <input
                    type="checkbox"
                    checked={notificationPrefs.sms}
                    onChange={(event) =>
                      setNotificationPrefs((prev) => ({
                        ...prev,
                        sms: event.target.checked,
                      }))
                    }
                  />
                  <span>SMS alerts</span>
                </label>
                <label className="clean-toggle">
                  <input
                    type="checkbox"
                    checked={notificationPrefs.push}
                    onChange={(event) =>
                      setNotificationPrefs((prev) => ({
                        ...prev,
                        push: event.target.checked,
                      }))
                    }
                  />
                  <span>Push alerts</span>
                </label>
              </article>

              <article className="clean-card">
                <h3>User Management</h3>
                <p className="muted">Multi-user roles and access control for real team use.</p>
                <div className="clean-row">
                  <input
                    className="clean-input"
                    value={newUsername}
                    onChange={(event) => setNewUsername(event.target.value)}
                    placeholder="username"
                  />
                  <select
                    className="clean-input"
                    value={newUserRole}
                    onChange={(event) => setNewUserRole(event.target.value as UserRole)}
                  >
                    <option value="admin">admin</option>
                    <option value="editor">editor</option>
                    <option value="viewer">viewer</option>
                  </select>
                  <button className="clean-btn" onClick={addUser}>
                    Add User
                  </button>
                </div>
                <div className="clean-list">
                  {users.map((user) => (
                    <article key={user.id} className="clean-list-item">
                      <strong>{user.username}</strong>
                      <select
                        className="clean-input"
                        value={user.role}
                        onChange={(event) => setUserRole(user.id, event.target.value as UserRole)}
                      >
                        <option value="admin">admin</option>
                        <option value="editor">editor</option>
                        <option value="viewer">viewer</option>
                      </select>
                    </article>
                  ))}
                </div>
              </article>

              <article className="clean-card">
                <h3>Security and Reliability</h3>
                <ul className="muted">
                  <li>Transport encryption: {encryptionStatus.transit}.</li>
                  <li>Storage encryption: {encryptionStatus.atRest}.</li>
                  <li>Active key fingerprint: {encryptionStatus.keyFingerprint}.</li>
                  <li>Last key rotation: {new Date(encryptionStatus.lastRotatedAt).toLocaleString()}.</li>
                  <li>Backup/restore: enabled through managed snapshots.</li>
                  <li>Disaster recovery: queue replay and mission resume ready.</li>
                  <li>Core safety rules are locked and cannot be overridden by chat commands.</li>
                </ul>
                <p className="muted">Immutable core rules loaded: {policySnapshot.immutableRules.length}</p>
                <p className="muted">Audit records available: {auditEntries.length}</p>
                <div className="clean-row wrap">
                  <button className="clean-btn" onClick={createBackupNow}>
                    Create Backup
                  </button>
                  <button className="clean-btn clean-btn-secondary" onClick={restoreLatestBackup}>
                    Restore Latest
                  </button>
                </div>
                <p className="muted">{backupMessage}</p>
              </article>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
