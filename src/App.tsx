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

const profileVariablePattern = /{{\s*([a-zA-Z0-9_-]+)\s*}}/g

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

type CapabilityState = {
  workspaceExecution: boolean
  workspaceFileWrite: boolean
  workspaceTooling: boolean
  vscodeControl: boolean
  desktopAppAutomation: boolean
  webAppAutomation: boolean
  mediaGeneration: boolean
  selfEvolution: boolean
  videoLearning: boolean
  libraryIngestLocal: boolean
  libraryIngestWeb: boolean
  chatExternalModel: boolean
  voiceInput: boolean
  voiceOutput: boolean
}

type CapabilityKey = keyof CapabilityState

type SpeechRecognitionResultLike = {
  transcript: string
}

type SpeechRecognitionEventLike = {
  results: SpeechRecognitionResultLike[][]
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionCtorLike = new () => SpeechRecognitionLike

type ChatMode = 'local' | 'desktop-relay'

type IntegrationStatus = {
  desktopRelay: boolean
  googleReady: boolean
  gptReady: boolean
  requiresAdminApproval: boolean
}

type LearningLogEntry = {
  id: string
  timestamp: string
  title: string
  detail: string
  source: string
  newSkills: string[]
}

type VideoLearningSegment = {
  id: string
  label: string
  startMinute: number
  endMinute: number
  status: string
  notes: string
}

type VideoLearningPlan = {
  id: string
  topic: string
  videoUrl: string
  durationMinutes: number
  segmentMinutes: number
  parallelSlots: number
  createdAt: string
  segments: VideoLearningSegment[]
}

type AutomationTemplate = {
  id: string
  appType: string
  name: string
  observe: string[]
  learnFocus: string
  skillSignals: string[]
}

type ExecutionRecord = {
  id: string
  timestamp: string
  domain: string
  adapterId: string | null
  templateId: string | null
  appType: string | null
  intendedStep: string
  performedStep: string
  result: string
  newSkills: string[]
  metadata: Record<string, unknown>
  simpleLog: string
}

type AutomationProfile = {
  id: string
  name: string
  appType: string
  adapterId: 'browser.formFill.basic' | 'browser.clickFlow.basic'
  targetUrl: string
  intent: string
  stepTemplate: string[]
  gainedSkills: string[]
  variableHints?: string[]
}

type AutomationProfilePreset = {
  id: string
  profileId: string
  name: string
  variables: Record<string, string>
  updatedAt: string
}

type CapabilitySuggestion = {
  capability: string
  reason: string
  recommendedAction: string
  confidence: number
  matchedSkills: string[]
  unmetPrerequisites: string[]
  readyToEnable: boolean
}

type ReplayStepDiff = {
  recordId: string
  originalIntendedStep: string
  replayIntendedStep: string
  originalPerformedStep: string
  replayPerformedStep: string
  originalResult: string
  replayResult: string
}

type ReplayPreview = {
  previewToken: string
  sourceRecord: ExecutionRecord
  relatedRecords: ExecutionRecord[]
  targetUrl: string | null
  intent: string | null
  stepDiffs: ReplayStepDiff[]
  expiresAt: number
}

type TargetWorkflowPack = {
  id: string
  name: string
  surface: string
  appType: string
  requiredCapability: string
  targetUrl: string
  intent: string
  executionSteps: string[]
  verificationChecks: string[]
  rollbackSteps: string[]
  variableHints?: string[]
}

type ExecutionSession = {
  id: string
  createdAt: string
  updatedAt: string
  status: string
  packId: string
  packName: string
  surface: string
  appType: string
  targetUrl: string
  intent: string
  executionSteps: string[]
  verificationChecks: string[]
  rollbackSteps: string[]
  variables: Record<string, string>
  evidence: string[]
  verificationNotes: string
  rollbackNotes: string
  artifactPath: string
}

type ObservationSnapshot = {
  id: string
  createdAt: string
  title: string
  appType: string
  visibleText: string
  notes: string
  screenshotPath: string
  inferredSkills: string[]
}

type CrossAppMission = {
  id: string
  goal: string
  surfaces: string[]
  recommendedPacks: Array<{ id: string; name: string; surface: string }>
  phases: Array<{ id: string; title: string; surface: string; objective: string }>
  createdAt: string
  status: string
}

type LearningGraphSnapshot = {
  nodes: Array<{ id: string; kind: string; label: string }>
  edges: Array<{ from: string; to: string; kind: string }>
  updatedAt: string | null
}

type EvolutionPipeline = {
  id: string
  title: string
  objective: string
  createdAt: string
  updatedAt: string
  currentStage: string
  stages: string[]
  history: Array<{ stage: string; note: string; timestamp: string }>
  artifactPath: string
}

type VisionJob = {
  id: string
  objective: string
  screenshotPath: string
  extractedText: string
  notes: string
  status: string
  createdAt: string
  updatedAt: string
  inferredSkills: string[]
}

type AutomationStepInput = {
  action: 'fill' | 'click' | 'select' | 'wait' | 'extractText'
  selector?: string
  value?: string
  waitMs?: number
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
    id: 'workspace.runToolCommand',
    label: 'Run workspace tool command',
    category: 'system',
    targetPath: '/workspace/toolchain',
    detail: 'command=npm run lint',
  },
  {
    id: 'vscode.executeCommand',
    label: 'Execute VS Code command bridge',
    category: 'system',
    targetPath: '/workspace/vscode',
    detail: 'command=workbench.action.terminal.toggleTerminal',
  },
  {
    id: 'automation.desktopAppEdit',
    label: 'Desktop app edit automation playbook',
    category: 'system',
    targetPath: '/workspace/automation/desktop',
    detail: 'app=Photoshop; intent=Update promo banner title and export PNG',
  },
  {
    id: 'automation.webAppEdit',
    label: 'Web app edit automation playbook',
    category: 'system',
    targetPath: '/workspace/automation/web',
    detail: 'url=https://example.com/dashboard; intent=Update product content block',
  },
  {
    id: 'media.generateAsset',
    label: 'Generate media asset prompt',
    category: 'codegen',
    targetPath: '/workspace/media/asset-prompt.txt',
    detail: 'Create media generation artifact prompt: cinematic project teaser video.',
  },
  {
    id: 'workspace.selfEvolve',
    label: 'Create self-evolution proposal',
    category: 'codegen',
    targetPath: '/workspace/evolution/skill-proposal.md',
    detail: 'Propose and scaffold new Paxion capability implementation.',
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

const defaultCapabilityState: CapabilityState = {
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

const defaultIntegrationStatus: IntegrationStatus = {
  desktopRelay: true,
  googleReady: false,
  gptReady: false,
  requiresAdminApproval: true,
}

const SKILL_PATTERNS: Array<{ skill: string; pattern: RegExp }> = [
  { skill: 'React UI Development', pattern: /react|tsx|component|jsx/i },
  { skill: 'TypeScript Engineering', pattern: /typescript|tsconfig|type|interface|generic/i },
  { skill: 'Electron Desktop Integration', pattern: /electron|ipc|main process|preload/i },
  { skill: 'Security Policy Design', pattern: /policy|approval|audit|permission|security/i },
  { skill: 'Workspace Automation', pattern: /workspace|mission|automation|executor|queue/i },
  { skill: 'Web Research', pattern: /google|search|web research|browser/i },
  { skill: 'AI Prompt Engineering', pattern: /prompt|llm|chatgpt|assistant|reasoning/i },
  { skill: 'Media Generation Workflow', pattern: /image|video|media|render|generation/i },
  { skill: 'Data Processing', pattern: /json|csv|parse|dataset|transform/i },
]

function inferSkills(text: string): string[] {
  const hits = SKILL_PATTERNS.filter((entry) => entry.pattern.test(text)).map((entry) => entry.skill)
  return Array.from(new Set(hits))
}

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
  const [actionDetail, setActionDetail] = useState(actionPresets[0].detail)
  const [adminCodeword, setAdminCodeword] = useState('')
  const [lastDecision, setLastDecision] = useState<string>('No action evaluated yet.')
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [adminExpiresAt, setAdminExpiresAt] = useState<number | null>(null)
  const [adminMessage, setAdminMessage] = useState('')
  const [capabilities, setCapabilities] = useState<CapabilityState>(defaultCapabilityState)
  const [accessMessage, setAccessMessage] = useState('')
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus>(defaultIntegrationStatus)
  const [learningLogs, setLearningLogs] = useState<LearningLogEntry[]>([])
  const [learnedSkills, setLearnedSkills] = useState<string[]>([])
  const [videoPlans, setVideoPlans] = useState<VideoLearningPlan[]>([])
  const [learningUpdatedAt, setLearningUpdatedAt] = useState<string | null>(null)
  const [videoTopic, setVideoTopic] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [videoDurationMinutes, setVideoDurationMinutes] = useState('60')
  const [videoSegmentMinutes, setVideoSegmentMinutes] = useState('10')
  const [videoParallelSlots, setVideoParallelSlots] = useState('3')
  const [videoPermission, setVideoPermission] = useState(false)
  const [videoMessage, setVideoMessage] = useState('')
  const [videoTargetPlanId, setVideoTargetPlanId] = useState('')
  const [videoTargetSegmentId, setVideoTargetSegmentId] = useState('')
  const [videoSegmentSummary, setVideoSegmentSummary] = useState('')
  const [videoSegmentSkills, setVideoSegmentSkills] = useState('')
  const [automationTemplates, setAutomationTemplates] = useState<AutomationTemplate[]>([])
  const [automationProfiles, setAutomationProfiles] = useState<AutomationProfile[]>([])
  const [automationProfilePresets, setAutomationProfilePresets] = useState<AutomationProfilePreset[]>([])
  const [executionRecords, setExecutionRecords] = useState<ExecutionRecord[]>([])
  const [capabilitySuggestions, setCapabilitySuggestions] = useState<CapabilitySuggestion[]>([])
  const [selectedAutomationProfileId, setSelectedAutomationProfileId] = useState('')
  const [automationPresetName, setAutomationPresetName] = useState('')
  const [automationProfileVariables, setAutomationProfileVariables] = useState<Record<string, string>>({})
  const [automationAdapterId, setAutomationAdapterId] = useState<'browser.formFill.basic' | 'browser.clickFlow.basic'>('browser.formFill.basic')
  const [automationTargetUrl, setAutomationTargetUrl] = useState('')
  const [automationIntent, setAutomationIntent] = useState('')
  const [automationStepsText, setAutomationStepsText] = useState('fill|#email|chief@paxion.ai\nfill|#password|********\nclick|button[type="submit"]')
  const [automationPermission, setAutomationPermission] = useState(false)
  const [automationTemplateId, setAutomationTemplateId] = useState('')
  const [automationSourceKnowledge, setAutomationSourceKnowledge] = useState('')
  const [replayRecordId, setReplayRecordId] = useState('')
  const [replayPermission, setReplayPermission] = useState(false)
  const [replayPreview, setReplayPreview] = useState<ReplayPreview | null>(null)
  const [automationMessage, setAutomationMessage] = useState('')
  const [targetPacks, setTargetPacks] = useState<TargetWorkflowPack[]>([])
  const [executionSessions, setExecutionSessions] = useState<ExecutionSession[]>([])
  const [observationSnapshots, setObservationSnapshots] = useState<ObservationSnapshot[]>([])
  const [crossAppMissions, setCrossAppMissions] = useState<CrossAppMission[]>([])
  const [learningGraph, setLearningGraph] = useState<LearningGraphSnapshot>({ nodes: [], edges: [], updatedAt: null })
  const [evolutionPipelines, setEvolutionPipelines] = useState<EvolutionPipeline[]>([])
  const [visionJobs, setVisionJobs] = useState<VisionJob[]>([])
  const [selectedTargetPackId, setSelectedTargetPackId] = useState('')
  const [targetPackVariables, setTargetPackVariables] = useState<Record<string, string>>({})
  const [targetPackPermission, setTargetPackPermission] = useState(false)
  const [sessionEvidenceText, setSessionEvidenceText] = useState('')
  const [sessionNotes, setSessionNotes] = useState('')
  const [observationTitle, setObservationTitle] = useState('')
  const [observationAppType, setObservationAppType] = useState('code-editor')
  const [observationVisibleText, setObservationVisibleText] = useState('')
  const [observationNotes, setObservationNotes] = useState('')
  const [observationScreenshotPath, setObservationScreenshotPath] = useState('')
  const [crossAppSurfacesText, setCrossAppSurfacesText] = useState('browser, editor, workspace')
  const [evolutionTitle, setEvolutionTitle] = useState('')
  const [evolutionObjective, setEvolutionObjective] = useState('')
  const [visionObjective, setVisionObjective] = useState('')
  const [visionScreenshotPath, setVisionScreenshotPath] = useState('')
  const [visionExtractedText, setVisionExtractedText] = useState('')
  const [visionNotes, setVisionNotes] = useState('')
  const [ocrJobId, setOcrJobId] = useState('')
  const [ocrImagePath, setOcrImagePath] = useState('')
  const [ocrLanguage, setOcrLanguage] = useState('eng')
  const [ocrResultText, setOcrResultText] = useState('')
  const [evidenceSessionId, setEvidenceSessionId] = useState('')
  const [evidenceSummary, setEvidenceSummary] = useState('')
  const [evidenceNotes, setEvidenceNotes] = useState('')
  const [evidenceDomSnapshot, setEvidenceDomSnapshot] = useState('')
  const [evidenceCommandOutput, setEvidenceCommandOutput] = useState('')
  const [evidenceScreenshotPath, setEvidenceScreenshotPath] = useState('')
  const [evidenceArtifactHash, setEvidenceArtifactHash] = useState('')
  const [evidenceArtifactPath, setEvidenceArtifactPath] = useState('')
  const [readinessMessage, setReadinessMessage] = useState('')

  // Library state
  const libraryStore = useMemo(() => new LibraryStore(), [])
  const [libDocs, setLibDocs] = useState<LibraryDocument[]>([])
  const [libSearch, setLibSearch] = useState('')
  const [libSelectedId, setLibSelectedId] = useState<string | null>(null)
  const [libAddMode, setLibAddMode] = useState(false)
  const [libPasteName, setLibPasteName] = useState('')
  const [libPasteText, setLibPasteText] = useState('')
  const [libAddError, setLibAddError] = useState('')
  const [libraryUpdatedAt, setLibraryUpdatedAt] = useState<string | null>(null)
  const [webSearchQuery, setWebSearchQuery] = useState('')
  const [webSearchLoading, setWebSearchLoading] = useState(false)
  const [webSearchMessage, setWebSearchMessage] = useState('')
  const libraryLoadedRef = useRef(false)

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatMode, setChatMode] = useState<ChatMode>('local')
  const [chatNotice, setChatNotice] = useState('')
  const [relayCaptureTitle, setRelayCaptureTitle] = useState('')
  const [relayCaptureText, setRelayCaptureText] = useState('')
  const [chatVoiceListening, setChatVoiceListening] = useState(false)
  const [chatVoiceEnabled, setChatVoiceEnabled] = useState(true)
  const [showThought, setShowThought] = useState<string | null>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const lastSpokenMessageIdRef = useRef<string | null>(null)

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

  const loadCapabilities = useCallback(async () => {
    if (!window.paxion) {
      setCapabilities(defaultCapabilityState)
      return
    }

    const result = await window.paxion.access.load().catch(() => null)
    if (result?.ok) {
      setCapabilities(result.capabilities)
    }
  }, [])

  const loadIntegrationStatus = useCallback(async () => {
    if (!window.paxion) {
      setIntegrationStatus(defaultIntegrationStatus)
      return
    }

    const result = await window.paxion.integrations.getStatus().catch(() => null)
    if (result?.ok) {
      setIntegrationStatus({
        desktopRelay: result.desktopRelay,
        googleReady: result.googleReady,
        gptReady: result.gptReady,
        requiresAdminApproval: result.requiresAdminApproval,
      })
    }
  }, [])

  const loadLearningState = useCallback(async () => {
    if (!window.paxion) {
      setLearningLogs([])
      setLearnedSkills([])
      setVideoPlans([])
      setLearningUpdatedAt(null)
      return
    }

    const result = await window.paxion.learning.load().catch(() => null)
    if (!result?.ok) {
      setLearningLogs([])
      setLearnedSkills([])
      setVideoPlans([])
      setLearningUpdatedAt(null)
      return
    }

    setLearningLogs(result.logs)
    setLearnedSkills(result.skills)
    setVideoPlans(result.videoPlans)
    setLearningUpdatedAt(result.updatedAt)
  }, [])

  const loadAutomationState = useCallback(async () => {
    if (!window.paxion) {
      setAutomationTemplates([])
      setAutomationProfiles([])
      setAutomationProfilePresets([])
      setExecutionRecords([])
      setCapabilitySuggestions([])
      setReplayPreview(null)
      return
    }

    const result = await window.paxion.automation.load().catch(() => null)
    if (!result?.ok) {
      setAutomationTemplates([])
      setAutomationProfiles([])
      setAutomationProfilePresets([])
      setExecutionRecords([])
      setCapabilitySuggestions([])
      setReplayPreview(null)
      return
    }

    setAutomationTemplates(result.templates)
    setAutomationProfiles(result.profiles)
    setAutomationProfilePresets(result.presets)
    setExecutionRecords(result.records)
    setCapabilitySuggestions(result.suggestions)
    if (!automationTemplateId && result.templates.length > 0) {
      setAutomationTemplateId(result.templates[0].id)
    }
  }, [automationTemplateId])

  const loadReadinessState = useCallback(async () => {
    if (!window.paxion) {
      setTargetPacks([])
      setExecutionSessions([])
      setObservationSnapshots([])
      setCrossAppMissions([])
      setLearningGraph({ nodes: [], edges: [], updatedAt: null })
      setEvolutionPipelines([])
      setVisionJobs([])
      return
    }

    const result = await window.paxion.readiness.load().catch(() => null)
    if (!result?.ok) {
      setTargetPacks([])
      setExecutionSessions([])
      setObservationSnapshots([])
      setCrossAppMissions([])
      setLearningGraph({ nodes: [], edges: [], updatedAt: null })
      setEvolutionPipelines([])
      setVisionJobs([])
      return
    }

    setTargetPacks(result.targetPacks)
    setExecutionSessions(result.executionSessions)
    setObservationSnapshots(result.observations)
    setCrossAppMissions(result.missions)
    setLearningGraph(result.learningGraph)
    setEvolutionPipelines(result.evolutionPipelines)
    setVisionJobs(result.visionJobs)
  }, [])

  const recordLearning = useCallback(
    async (input: { title: string; detail: string; source: string; newSkills: string[] }) => {
      if (!window.paxion) {
        return
      }

      const result = await window.paxion.learning.record(input).catch(() => null)
      if (!result?.ok) {
        return
      }

      setLearnedSkills(result.skills)
      setLearningUpdatedAt(result.updatedAt)
      if (Array.isArray(result.videoPlans)) {
        setVideoPlans(result.videoPlans)
      }
      const entry = result.entry
      if (!entry) return
      setLearningLogs((prev) => [...prev, entry].slice(-600))
    },
    [],
  )

  const setCapability = useCallback(async (key: CapabilityKey, enabled: boolean) => {
    if (!window.paxion) {
      setCapabilities((prev) => ({
        ...prev,
        [key]: enabled,
      }))
      return
    }

    const result = await window.paxion.access.set({ key, enabled }).catch(() => null)
    if (!result?.ok) {
      setAccessMessage(result?.reason ?? 'Failed to update capability.')
      return
    }

    setCapabilities(result.capabilities)
    setAccessMessage(`Capability ${key} is now ${enabled ? 'enabled' : 'disabled'}.`)
    if (adminUnlocked) {
      await loadAuditIfAllowed()
    }
  }, [adminUnlocked, loadAuditIfAllowed])

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

  const loadLibraryState = useCallback(async () => {
    if (window.paxion) {
      const loaded = await window.paxion.library.load().catch(() => null)
      if (loaded?.ok) {
        libraryStore.hydrate(loaded.docs)
        setLibDocs(libraryStore.getAll())
        setLibraryUpdatedAt(loaded.updatedAt)
      }
    } else {
      try {
        const raw = localStorage.getItem('paxion-library-state')
        if (raw) {
          const parsed = JSON.parse(raw) as {
            docs?: LibraryDocument[]
            updatedAt?: string | null
          }

          libraryStore.hydrate(Array.isArray(parsed.docs) ? parsed.docs : [])
          setLibDocs(libraryStore.getAll())
          setLibraryUpdatedAt(parsed.updatedAt ?? null)
        }
      } catch {
        // Ignore corrupted local library state and continue with fresh state.
      }
    }

    libraryLoadedRef.current = true
  }, [libraryStore])

  const persistLibraryState = useCallback(async (nextDocs: LibraryDocument[]) => {
    if (window.paxion) {
      const result = await window.paxion.library.save({ docs: nextDocs }).catch(() => null)
      if (result?.ok && result.updatedAt) {
        setLibraryUpdatedAt(result.updatedAt)
      }
      return
    }

    const payload = {
      docs: nextDocs,
      updatedAt: new Date().toISOString(),
    }

    localStorage.setItem('paxion-library-state', JSON.stringify(payload))
    setLibraryUpdatedAt(payload.updatedAt)
  }, [])

  // Keep admin session status fresh.
  useEffect(() => {
    if (!window.paxion) return

    queueMicrotask(() => {
      refreshAdminStatus()
      loadCapabilities()
      loadIntegrationStatus()
      loadLearningState()
      loadAutomationState()
      loadReadinessState()
    })

    const intervalId = window.setInterval(() => {
      refreshAdminStatus()
    }, 30 * 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [loadAutomationState, loadCapabilities, loadIntegrationStatus, loadLearningState, loadReadinessState, refreshAdminStatus])

  useEffect(() => {
    if (!adminUnlocked) return
    queueMicrotask(() => {
      loadLearningState()
      loadAutomationState()
      loadReadinessState()
    })
  }, [adminUnlocked, loadAutomationState, loadLearningState, loadReadinessState])

  // Restore workspace mission state from persistence.
  useEffect(() => {
    queueMicrotask(() => {
      loadWorkspaceState()
    })
  }, [loadWorkspaceState])

  // Restore library knowledge index from persistence.
  useEffect(() => {
    queueMicrotask(() => {
      loadLibraryState()
    })
  }, [loadLibraryState])

  // Autosave workspace mission state after local updates are initialized.
  useEffect(() => {
    if (!workspaceLoadedRef.current) return
    queueMicrotask(() => {
      persistWorkspaceState(workspaceGoal, workspacePlan)
    })
  }, [workspaceGoal, workspacePlan, persistWorkspaceState])

  // Autosave library index after initial load.
  useEffect(() => {
    if (!libraryLoadedRef.current) return
    queueMicrotask(() => {
      persistLibraryState(libDocs)
    })
  }, [libDocs, persistLibraryState])

  const selectedAction = useMemo(
    () => actionPresets.find((preset) => preset.id === selectedActionId) ?? actionPresets[0],
    [selectedActionId],
  )

  // Auto-scroll chat to bottom whenever a message is added or loading state changes.
  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatMessages, chatLoading])

  // Voice output for assistant replies (local Web Speech API when available).
  useEffect(() => {
    if (!chatVoiceEnabled || !capabilities.voiceOutput) {
      return
    }

    const latestAssistantMessage = [...chatMessages].reverse().find((m) => m.role === 'assistant')
    if (!latestAssistantMessage) {
      return
    }

    if (lastSpokenMessageIdRef.current === latestAssistantMessage.id) {
      return
    }

    if (!('speechSynthesis' in window)) {
      return
    }

    const utterance = new SpeechSynthesisUtterance(latestAssistantMessage.content.slice(0, 600))
    utterance.rate = 1
    utterance.pitch = 1
    utterance.lang = 'en-US'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    lastSpokenMessageIdRef.current = latestAssistantMessage.id
  }, [capabilities.voiceOutput, chatMessages, chatVoiceEnabled])

  function toggleChatVoiceOutput() {
    setChatVoiceEnabled((prev) => !prev)
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }

  function startVoiceInput() {
    if (!capabilities.voiceInput) {
      setChatNotice('Voice input is disabled in Access tab.')
      return
    }

    const voiceWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtorLike
      webkitSpeechRecognition?: SpeechRecognitionCtorLike
    }

    const SpeechRecognitionCtor =
      voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition
    if (!SpeechRecognitionCtor) {
      setChatNotice('Voice input is not supported on this runtime.')
      return
    }

    if (!speechRecognitionRef.current) {
      const recognition = new SpeechRecognitionCtor()
      recognition.lang = 'en-US'
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const transcript = String(event?.results?.[0]?.[0]?.transcript || '').trim()
        if (transcript) {
          setChatInput((prev) => (prev ? `${prev} ${transcript}` : transcript))
          setChatNotice('Voice captured.')
        }
      }

      recognition.onend = () => {
        setChatVoiceListening(false)
      }

      recognition.onerror = () => {
        setChatVoiceListening(false)
      }

      speechRecognitionRef.current = recognition
    }

    speechRecognitionRef.current.start()
    setChatVoiceListening(true)
    setChatNotice('Listening...')
  }

  function stopVoiceInput() {
    if (!speechRecognitionRef.current) return
    speechRecognitionRef.current.stop()
    setChatVoiceListening(false)
  }

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
      detail: actionDetail,
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

    const newSkills = inferSkills(`${result.name}\n${result.content}`)
    await recordLearning({
      title: `Knowledge ingested: ${result.name}`,
      detail:
        newSkills.length > 0
          ? `Acquired ${newSkills.length} skill signal(s) from book/document.`
          : 'Learned new reference material from document ingestion.',
      source: 'library-file',
      newSkills,
    })
  }

  async function handleWebSearch() {
    if (!window.paxion) {
      setWebSearchMessage('Web search is available only in desktop mode.')
      return
    }

    if (!webSearchQuery.trim()) {
      setWebSearchMessage('Enter a search query first.')
      return
    }

    setWebSearchLoading(true)
    setWebSearchMessage('Opening Google search in your browser...')

    const result = await window.paxion.integrations
      .googleSearch({ query: webSearchQuery.trim() })
      .catch(() => null)

    if (!result?.ok) {
      setWebSearchLoading(false)
      setWebSearchMessage(result?.reason ?? 'Web search failed.')
      return
    }

    setWebSearchLoading(false)
    setWebSearchMessage('Google opened. Review results manually, then paste approved knowledge into Library.')

    await recordLearning({
      title: `Web research launched: ${webSearchQuery.trim()}`,
      detail: 'Opened Google in browser with admin-approved desktop relay.',
      source: 'google-relay',
      newSkills: ['Web Research'],
    })
  }

  function handleAddByPaste() {
    if (!libPasteText.trim()) return
    setLibAddError('')
    const title = libPasteName || 'Pasted document'
    libraryStore.add(title, libPasteText, 'paste')
    setLibDocs(libraryStore.getAll())
    setLibAddMode(false)
    setLibPasteName('')
    setLibPasteText('')

    const newSkills = inferSkills(`${title}\n${libPasteText}`)
    void recordLearning({
      title: `Knowledge pasted: ${title}`,
      detail:
        newSkills.length > 0
          ? `Acquired ${newSkills.length} skill signal(s) from pasted knowledge.`
          : 'Stored pasted knowledge for future reasoning.',
      source: 'library-paste',
      newSkills,
    })
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

  async function createYoutubeLearningPlan() {
    if (!window.paxion) return

    const result = await window.paxion.learning
      .youtubePlanCreate({
        topic: videoTopic,
        videoUrl,
        durationMinutes: Number(videoDurationMinutes || 60),
        segmentMinutes: Number(videoSegmentMinutes || 10),
        parallelSlots: Number(videoParallelSlots || 3),
        explicitPermission: videoPermission,
      })
      .catch(() => null)

    if (!result?.ok) {
      setVideoMessage(result?.reason ?? 'Failed to create YouTube learning plan.')
      return
    }

    setVideoPlans(result.videoPlans)
    setVideoMessage(
      `Plan created: ${result.plan.topic} with ${result.plan.segments.length} segment(s).`,
    )
    setVideoPermission(false)
  }

  async function openYoutubeSegment(planId: string, segmentId: string) {
    if (!window.paxion) return
    const result = await window.paxion.learning
      .youtubeSegmentOpen({
        planId,
        segmentId,
      })
      .catch(() => null)

    if (!result?.ok) {
      setVideoMessage(result?.reason ?? 'Failed to open segment.')
      return
    }

    setVideoPlans(result.videoPlans)
    setVideoMessage('Opened segment in browser.')
  }

  async function openYoutubeParallelBatch(planId: string) {
    const plan = videoPlans.find((entry) => entry.id === planId)
    if (!plan) return

    const pending = plan.segments.filter((segment) => segment.status !== 'learned')
    const batch = pending.slice(0, Math.max(1, plan.parallelSlots))
    if (batch.length === 0) {
      setVideoMessage('No pending segments left in this plan.')
      return
    }

    for (const segment of batch) {
      await openYoutubeSegment(planId, segment.id)
    }

    setVideoMessage(`Opened ${batch.length} segment(s) in parallel batch.`)
  }

  async function completeYoutubeSegmentLearning() {
    if (!window.paxion) return
    if (!videoTargetPlanId || !videoTargetSegmentId) {
      setVideoMessage('Select plan and segment IDs for completion.')
      return
    }

    const newSkills = inferSkills(videoSegmentSkills)
    const manualSkills = videoSegmentSkills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const mergedSkills = Array.from(new Set([...newSkills, ...manualSkills]))

    const result = await window.paxion.learning
      .youtubeSegmentComplete({
        planId: videoTargetPlanId,
        segmentId: videoTargetSegmentId,
        summary: videoSegmentSummary,
        newSkills: mergedSkills,
      })
      .catch(() => null)

    if (!result?.ok) {
      setVideoMessage(result?.reason ?? 'Failed to complete segment learning.')
      return
    }

    setVideoPlans(result.videoPlans)
    setLearnedSkills(result.skills)
    setLearningUpdatedAt(result.updatedAt)
    await loadLearningState()
    setVideoMessage('Segment marked as learned and logged.')
    setVideoSegmentSummary('')
    setVideoSegmentSkills('')
  }

  function parseAutomationSteps(input: string): AutomationStepInput[] {
    const lines = input
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    return lines.map((line) => {
      const [rawAction, rawSelector = '', rawValue = ''] = line.split('|').map((s) => s.trim())
      const action = (rawAction || 'click') as AutomationStepInput['action']
      if (action === 'wait') {
        return {
          action,
          waitMs: Number(rawValue || rawSelector || 500),
        }
      }

      return {
        action,
        selector: rawSelector,
        value: rawValue,
      }
    })
  }

  async function runAutomationAdapter() {
    if (!window.paxion) return

    const steps = parseAutomationSteps(automationStepsText)
    const result = await window.paxion.automation
      .runAdapter({
        adapterId: automationAdapterId,
        targetUrl: automationTargetUrl,
        intent: automationIntent,
        steps,
        explicitPermission: automationPermission,
      })
      .catch(() => null)

    if (!result?.ok) {
      setAutomationMessage(result?.reason ?? 'Failed to run automation adapter.')
      return
    }

    setExecutionRecords(result.executionRecords)
    setAutomationTemplates(result.templates)
    setAutomationProfiles(result.profiles)
    setAutomationProfilePresets(result.presets)
    setCapabilitySuggestions(result.suggestions)
    setLearnedSkills(result.skills)
    setLearningUpdatedAt(result.updatedAt)
    await loadLearningState()
    setAutomationMessage(`Adapter ${result.adapterId} executed with ${result.records.length} record(s).`)
    setAutomationPermission(false)
  }

  async function runObserveLearnTemplate() {
    if (!window.paxion) return

    const result = await window.paxion.automation
      .observeLearn({
        templateId: automationTemplateId,
        sourceKnowledge: automationSourceKnowledge,
      })
      .catch(() => null)

    if (!result?.ok) {
      setAutomationMessage(result?.reason ?? 'Failed to run observe+learn template.')
      return
    }

    setExecutionRecords(result.executionRecords)
    setAutomationTemplates(result.templates)
    setAutomationProfiles(result.profiles)
    setAutomationProfilePresets(result.presets)
    setCapabilitySuggestions(result.suggestions)
    setLearnedSkills(result.skills)
    setLearningUpdatedAt(result.updatedAt)
    await loadLearningState()
    setAutomationMessage(
      `Template ${result.template.name} executed with ${result.records.length} observation record(s).`,
    )
  }

  function applyAutomationProfile(profileId: string) {
    const profile = automationProfiles.find((entry) => entry.id === profileId)
    if (!profile) {
      setAutomationMessage('Automation profile not found.')
      return
    }

    const variableKeys = Array.from(
      new Set(
        [
          ...(profile.variableHints ?? []),
          ...Array.from(
            `${profile.targetUrl}\n${profile.intent}\n${profile.stepTemplate.join('\n')}`.matchAll(
              profileVariablePattern,
            ),
          ).map((match) => match[1]),
        ].filter(Boolean),
      ),
    )

    setSelectedAutomationProfileId(profile.id)
    setReplayPreview(null)
    setAutomationProfileVariables(
      Object.fromEntries(variableKeys.map((key) => [key, automationProfileVariables[key] ?? ''])),
    )
    setAutomationAdapterId(profile.adapterId)
    setAutomationTargetUrl(profile.targetUrl)
    setAutomationIntent(profile.intent)
    setAutomationStepsText(profile.stepTemplate.join('\n'))
    setAutomationMessage(`Loaded profile: ${profile.name}`)
  }

  function resolveProfileTemplate(template: string, variables: Record<string, string>) {
    return template.replace(profileVariablePattern, (_full, key: string) => variables[key] ?? `{{${key}}}`)
  }

  function applyAutomationProfileVariables() {
    const profile = automationProfiles.find((entry) => entry.id === selectedAutomationProfileId)
    if (!profile) {
      setAutomationMessage('Select an automation profile before applying variables.')
      return
    }

    setAutomationAdapterId(profile.adapterId)
    setAutomationTargetUrl(resolveProfileTemplate(profile.targetUrl, automationProfileVariables))
    setAutomationIntent(resolveProfileTemplate(profile.intent, automationProfileVariables))
    setAutomationStepsText(
      profile.stepTemplate.map((step) => resolveProfileTemplate(step, automationProfileVariables)).join('\n'),
    )
    setAutomationMessage(`Applied variables for profile: ${profile.name}`)
  }

  function updateAutomationProfileVariable(key: string, value: string) {
    setAutomationProfileVariables((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  function loadAutomationPreset(presetId: string) {
    const preset = automationProfilePresets.find((entry) => entry.id === presetId)
    if (!preset) {
      setAutomationMessage('Automation preset not found.')
      return
    }

    const profile = automationProfiles.find((entry) => entry.id === preset.profileId)
    if (!profile) {
      setAutomationMessage('Preset profile is no longer available.')
      return
    }

    setSelectedAutomationProfileId(profile.id)
    setAutomationPresetName(preset.name)
    setAutomationProfileVariables(preset.variables)
    setAutomationAdapterId(profile.adapterId)
    setAutomationTargetUrl(resolveProfileTemplate(profile.targetUrl, preset.variables))
    setAutomationIntent(resolveProfileTemplate(profile.intent, preset.variables))
    setAutomationStepsText(
      profile.stepTemplate.map((step) => resolveProfileTemplate(step, preset.variables)).join('\n'),
    )
    setAutomationMessage(`Loaded preset: ${preset.name}`)
  }

  async function saveAutomationPreset() {
    if (!window.paxion) return
    if (!selectedAutomationProfileId) {
      setAutomationMessage('Select a profile before saving a preset.')
      return
    }

    const name = automationPresetName.trim()
    if (!name) {
      setAutomationMessage('Preset name is required.')
      return
    }

    const result = await window.paxion.automation
      .savePreset({
        profileId: selectedAutomationProfileId,
        name,
        variables: automationProfileVariables,
      })
      .catch(() => null)

    if (!result?.ok) {
      setAutomationMessage(result?.reason ?? 'Failed to save automation preset.')
      return
    }

    setAutomationProfilePresets(result.presets)
    setAutomationMessage(`Saved preset: ${result.preset.name}`)
  }

  async function deleteAutomationPreset(presetId: string) {
    if (!window.paxion) return
    const result = await window.paxion.automation.deletePreset({ presetId }).catch(() => null)
    if (!result?.ok) {
      setAutomationMessage(result?.reason ?? 'Failed to delete automation preset.')
      return
    }

    setAutomationProfilePresets(result.presets)
    setAutomationMessage('Deleted automation preset.')
  }

  async function enableSuggestedCapability(suggestion: CapabilitySuggestion) {
    if (!(suggestion.capability in capabilities)) {
      setAutomationMessage(`Capability suggestion is not recognized: ${suggestion.capability}`)
      return
    }

    if (!suggestion.readyToEnable) {
      setAutomationMessage(
        `Enable prerequisite capabilities first: ${suggestion.unmetPrerequisites.join(', ')}`,
      )
      return
    }

    await setCapability(suggestion.capability as CapabilityKey, true)
    const result = await window.paxion?.automation.suggestions().catch(() => null)
    if (result?.ok) {
      setCapabilitySuggestions(result.suggestions)
    }
    setAutomationMessage(`Capability ${suggestion.capability} enabled from suggestion panel.`)
  }

  function selectReplayRecord(recordId: string) {
    setReplayRecordId(recordId)
    setReplayPreview(null)
    setAutomationMessage(`Selected execution record for replay: ${recordId}`)
  }

  async function previewReplayExecutionRecord() {
    if (!window.paxion) return
    const id = replayRecordId.trim()
    if (!id) {
      setAutomationMessage('Select or enter an execution record ID to preview replay.')
      return
    }

    const result = await window.paxion.automation.previewReplay({ recordId: id }).catch(() => null)
    if (!result?.ok) {
      setReplayPreview(null)
      setAutomationMessage(result?.reason ?? 'Failed to preview replay.')
      return
    }

    setReplayPreview(result.preview)
    setAutomationMessage(`Replay preview prepared for ${result.preview.relatedRecords.length} step(s).`)
  }

  async function replayExecutionRecord() {
    if (!window.paxion) return
    const id = replayRecordId.trim()
    if (!id) {
      setAutomationMessage('Enter execution record ID to replay.')
      return
    }

    if (!replayPreview || replayPreview.sourceRecord.id !== id) {
      setAutomationMessage('Preview the replay and approve it before running.')
      return
    }

    const result = await window.paxion.automation
      .replayRecord({
        recordId: id,
        previewToken: replayPreview.previewToken,
        explicitPermission: replayPermission,
      })
      .catch(() => null)

    if (!result?.ok) {
      setAutomationMessage(result?.reason ?? 'Failed to replay execution record.')
      return
    }

    setExecutionRecords(result.executionRecords)
    setCapabilitySuggestions(result.suggestions)
    setLearningUpdatedAt(result.updatedAt)
    setReplayPreview(null)
    await loadLearningState()
    setAutomationMessage(
      `Replay completed for record: ${id} with ${result.replayRecords.length} replay step(s).`,
    )
    setReplayPermission(false)
  }

  function selectTargetPack(packId: string) {
    const pack = targetPacks.find((entry) => entry.id === packId)
    if (!pack) {
      setReadinessMessage('Target workflow pack not found.')
      return
    }

    const keys = Array.from(
      new Set(
        [
          ...(pack.variableHints ?? []),
          ...Array.from(
            `${pack.targetUrl}\n${pack.intent}\n${pack.executionSteps.join('\n')}`.matchAll(
              profileVariablePattern,
            ),
          ).map((match) => match[1]),
        ].filter(Boolean),
      ),
    )

    setSelectedTargetPackId(pack.id)
    setTargetPackVariables(Object.fromEntries(keys.map((key) => [key, targetPackVariables[key] ?? ''])))
    setReadinessMessage(`Selected target pack: ${pack.name}`)
  }

  function updateTargetPackVariable(key: string, value: string) {
    setTargetPackVariables((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  async function runTargetWorkflowPack() {
    if (!window.paxion) return
    if (!selectedTargetPackId) {
      setReadinessMessage('Select a target workflow pack first.')
      return
    }

    const result = await window.paxion.readiness
      .runTargetPack({
        packId: selectedTargetPackId,
        variables: targetPackVariables,
        explicitPermission: targetPackPermission,
      })
      .catch(() => null)

    if (!result?.ok) {
      setReadinessMessage(result?.reason ?? 'Failed to prepare target workflow pack.')
      return
    }

    setExecutionSessions(result.executionSessions)
    setLearningGraph(result.learningGraph)
    setTargetPackPermission(false)
    setReadinessMessage(`Prepared workflow session: ${result.session.packName}`)
  }

  async function verifyExecutionSessionById(sessionId: string, outcome: 'verified' | 'failed') {
    if (!window.paxion) return
    const evidence = sessionEvidenceText
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean)
    const result = await window.paxion.readiness
      .verifySession({
        sessionId,
        evidence,
        notes: sessionNotes,
        outcome,
      })
      .catch(() => null)

    if (!result?.ok) {
      setReadinessMessage(result?.reason ?? 'Failed to verify execution session.')
      return
    }

    setExecutionSessions(result.executionSessions)
    setLearningGraph(result.learningGraph)
    setSessionEvidenceText('')
    setSessionNotes('')
    setReadinessMessage(`Session ${sessionId} updated as ${result.session.status}.`)
  }

  async function rollbackExecutionSessionById(sessionId: string) {
    if (!window.paxion) return
    const result = await window.paxion.readiness
      .rollbackSession({
        sessionId,
        notes: sessionNotes,
      })
      .catch(() => null)

    if (!result?.ok) {
      setReadinessMessage(result?.reason ?? 'Failed to rollback execution session.')
      return
    }

    setExecutionSessions(result.executionSessions)
    setLearningGraph(result.learningGraph)
    setSessionNotes('')
    setReadinessMessage(`Rollback prepared for session ${sessionId}.`)
  }

  async function captureObservation() {
    if (!window.paxion) return
    const result = await window.paxion.readiness
      .captureObservation({
        title: observationTitle,
        appType: observationAppType,
        visibleText: observationVisibleText,
        notes: observationNotes,
        screenshotPath: observationScreenshotPath,
      })
      .catch(() => null)

    if (!result?.ok) {
      setReadinessMessage(result?.reason ?? 'Failed to capture observation.')
      return
    }

    setObservationSnapshots(result.observations)
    setLearningGraph(result.learningGraph)
    setLearnedSkills(result.skills)
    setObservationTitle('')
    setObservationVisibleText('')
    setObservationNotes('')
    setObservationScreenshotPath('')
    setReadinessMessage(`Captured observation: ${result.snapshot.title}`)
  }

  async function planCrossAppMission() {
    if (!window.paxion) return
    const surfaces = crossAppSurfacesText
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
    const result = await window.paxion.readiness
      .planMission({
        goal: workspaceGoal,
        surfaces,
      })
      .catch(() => null)

    if (!result?.ok) {
      setReadinessMessage(result?.reason ?? 'Failed to plan cross-app mission.')
      return
    }

    setCrossAppMissions(result.missions)
    setReadinessMessage(`Cross-app mission planned with ${result.mission.phases.length} phases.`)
  }

  async function createEvolutionPipeline() {
    if (!window.paxion) return
    const result = await window.paxion.readiness
      .createEvolutionPipeline({
        title: evolutionTitle,
        objective: evolutionObjective,
        note: 'Pipeline created from workspace control panel.',
      })
      .catch(() => null)

    if (!result?.ok) {
      setReadinessMessage(result?.reason ?? 'Failed to create evolution pipeline.')
      return
    }

    setEvolutionPipelines(result.evolutionPipelines)
    setEvolutionTitle('')
    setEvolutionObjective('')
    setReadinessMessage(`Evolution pipeline created: ${result.pipeline.title}`)
  }

  async function advanceEvolutionPipelineById(pipelineId: string) {
    if (!window.paxion) return
    const result = await window.paxion.readiness
      .advanceEvolutionPipeline({
        pipelineId,
        note: 'Advanced from workspace control panel.',
      })
      .catch(() => null)

    if (!result?.ok) {
      setReadinessMessage(result?.reason ?? 'Failed to advance evolution pipeline.')
      return
    }

    setEvolutionPipelines(result.evolutionPipelines)
    setReadinessMessage(`Evolution pipeline moved to ${result.pipeline.currentStage}.`)
  }

  async function createVisionJob() {
    if (!window.paxion) return
    const result = await window.paxion.readiness
      .createVisionJob({
        objective: visionObjective,
        screenshotPath: visionScreenshotPath,
        extractedText: visionExtractedText,
        notes: visionNotes,
      })
      .catch(() => null)

    if (!result?.ok) {
      setReadinessMessage(result?.reason ?? 'Failed to create vision/OCR job.')
      return
    }

    setVisionJobs(result.visionJobs)
    setLearningGraph(result.learningGraph)
    setVisionObjective('')
    setVisionScreenshotPath('')
    setVisionExtractedText('')
    setVisionNotes('')
    setReadinessMessage(`Vision/OCR job created: ${result.job.objective}`)
  }

  async function reviewVisionJob(jobId: string) {
    if (!window.paxion) return
    const result = await window.paxion.readiness
      .reviewVisionJob({
        jobId,
        notes: 'Reviewed from workspace control panel.',
      })
      .catch(() => null)

    if (!result?.ok) {
      setReadinessMessage(result?.reason ?? 'Failed to review vision/OCR job.')
      return
    }

    setVisionJobs(result.visionJobs)
    setLearningGraph(result.learningGraph)
    setReadinessMessage(`Vision/OCR job reviewed: ${result.job.id}`)
  }

  async function runLocalOcr() {
    if (!window.paxion) return
    const result = await window.paxion.readiness
      .runOcr({
        jobId: ocrJobId.trim() || undefined,
        imagePath: ocrImagePath.trim() || undefined,
        language: ocrLanguage.trim() || 'eng',
        notes: visionNotes,
      })
      .catch(() => null)

    if (!result?.ok) {
      setReadinessMessage(result?.reason ?? 'Failed to run local OCR.')
      return
    }

    setVisionJobs(result.visionJobs)
    setLearningGraph(result.learningGraph)
    setLearnedSkills(result.skills)
    setOcrResultText(result.extractedText)
    setReadinessMessage(
      `OCR completed (${result.language}) with confidence ${result.confidence.toFixed(1)}.`,
    )
  }

  async function createEvidenceArtifact() {
    if (!window.paxion) return
    const sessionId = evidenceSessionId.trim()
    if (!sessionId) {
      setReadinessMessage('Provide an execution session ID for evidence artifact generation.')
      return
    }

    const evidence = sessionEvidenceText
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean)
    const result = await window.paxion.readiness
      .createEvidenceArtifact({
        sessionId,
        summary: evidenceSummary,
        notes: evidenceNotes,
        evidence,
        domSnapshot: evidenceDomSnapshot,
        commandOutput: evidenceCommandOutput,
        screenshotPath: evidenceScreenshotPath,
      })
      .catch(() => null)

    if (!result?.ok) {
      setReadinessMessage(result?.reason ?? 'Failed to create evidence artifact.')
      return
    }

    setExecutionSessions(result.executionSessions)
    setLearningGraph(result.learningGraph)
    setEvidenceArtifactHash(result.artifact.payloadHash)
    setEvidenceArtifactPath(result.artifact.jsonPath)
    setReadinessMessage(`Evidence artifact created for session ${sessionId}.`)
  }

  // ── Chat tab handlers ──

  async function openDesktopChatRelay(query: string): Promise<boolean> {
    if (!window.paxion) return false
    const result = await window.paxion.integrations
      .gptChat({
        query,
      })
      .catch(() => null)

    if (!result?.ok) {
      setChatNotice(result?.reason ?? 'Desktop relay failed.')
      return false
    }

    setChatNotice('ChatGPT opened in browser. Submit your prompt there and paste response back here.')
    await recordLearning({
      title: 'Desktop ChatGPT relay opened',
      detail: 'Opened ChatGPT in browser using explicit capability and admin session.',
      source: 'chatgpt-relay',
      newSkills: ['AI Prompt Engineering'],
    })
    return true
  }

  async function sendChatMessage() {
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

    const localResponse = brain.think(text, libDocs)
    let finalReply = localResponse.reply
    const finalContextDocs = localResponse.contextDocs
    let finalReasoning = localResponse.reasoningSteps
    const finalConfidence = localResponse.confidence

    if (chatMode === 'desktop-relay') {
      if (!capabilities.chatExternalModel) {
        setChatNotice('Desktop ChatGPT relay is disabled in Access tab. Using local mode.')
      } else {
        const opened = await openDesktopChatRelay(text)
        if (opened) {
          finalReply = [
            'Desktop ChatGPT relay launched.',
            'I opened ChatGPT in your browser using your permission.',
            'Submit the same prompt there and paste the answer here if you want me to store/summarize it.',
            '',
            'Local quick answer while you relay:',
            localResponse.reply,
          ].join('\n')
          finalReasoning = [
            ...localResponse.reasoningSteps,
            'Desktop relay mode used: no API call, browser opened for manual human-style interaction.',
          ]
        }
      }
    }

    const thinkMs = 250 + Math.random() * 350
    window.setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-a`,
          role: 'assistant',
          content: finalReply,
          timestamp: new Date().toISOString(),
          contextDocs: finalContextDocs,
          reasoningSteps: finalReasoning,
          confidence: finalConfidence,
        },
      ])
      setChatLoading(false)
    }, thinkMs)
  }

  async function ingestRelayCapture() {
    const text = relayCaptureText.trim()
    if (!text) {
      setChatNotice('Paste relay output first.')
      return
    }

    const title = relayCaptureTitle.trim() || 'Relay capture'
    libraryStore.add(`Relay: ${title}`, text, 'paste')
    setLibDocs(libraryStore.getAll())

    const newSkills = inferSkills(`${title}\n${text}`)
    await recordLearning({
      title: `Relay knowledge captured: ${title}`,
      detail:
        newSkills.length > 0
          ? `Acquired ${newSkills.length} skill signal(s) from relay capture.`
          : 'Stored relay output as new knowledge.',
      source: 'relay-capture',
      newSkills,
    })

    setRelayCaptureTitle('')
    setRelayCaptureText('')
    setChatNotice('Relay output saved to Library and learning timeline.')
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

          <div className="chat-voice-row">
            <select
              className="chat-mode-select"
              value={chatMode}
              onChange={(event) => setChatMode(event.target.value as ChatMode)}
            >
              <option value="local">Local Brain</option>
              <option value="desktop-relay">Desktop ChatGPT Relay (No API)</option>
            </select>
            <button className="run-button" onClick={toggleChatVoiceOutput}>
              Voice Output: {chatVoiceEnabled && capabilities.voiceOutput ? 'ON' : 'OFF'}
            </button>
            {!chatVoiceListening ? (
              <button className="run-button" onClick={startVoiceInput}>
                Start Voice Input
              </button>
            ) : (
              <button className="run-button" onClick={stopVoiceInput}>
                Stop Voice Input
              </button>
            )}
          </div>
          {chatNotice && <p className="muted">{chatNotice}</p>}

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
                  void sendChatMessage()
                }
              }}
              placeholder="Ask Paxion anything… (Enter to send, Shift+Enter newline)"
              rows={2}
              disabled={chatLoading}
            />
            <div className="chat-input-actions">
              <button
                className="run-button"
                onClick={() => {
                  void sendChatMessage()
                }}
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

          <div className="lib-add-panel">
            <div className="control-group">
              <label>Relay capture title</label>
              <input
                value={relayCaptureTitle}
                onChange={(event) => setRelayCaptureTitle(event.target.value)}
                placeholder="Example: ChatGPT solution for workspace task"
              />
            </div>
            <div className="control-group">
              <label>Paste ChatGPT/Google output</label>
              <textarea
                className="lib-paste-area"
                value={relayCaptureText}
                onChange={(event) => setRelayCaptureText(event.target.value)}
                rows={5}
                placeholder="Paste approved output here, then store as knowledge"
              />
            </div>
            <button className="run-button" onClick={() => void ingestRelayCapture()}>
              Save Relay Knowledge
            </button>
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
      const totalWords = libDocs.reduce((acc, doc) => acc + doc.wordCount, 0)
      const estimatedChunks = Math.max(1, Math.ceil(totalWords / 130))
      const rank = rankFromDocs(libDocs.length)

      return (
        <div className="tab-content-stack">
          <div className="decision-card">
            <strong>Knowledge Core</strong>
            <p>
              Rank: {rank} | {libDocs.length} docs | {totalWords.toLocaleString()} words |{' '}
              {estimatedChunks.toLocaleString()} indexed chunks
            </p>
            <p className="muted">
              {libraryUpdatedAt
                ? `Last sync: ${libraryUpdatedAt}`
                : 'No persistence snapshot yet.'}
            </p>
          </div>

          <div className="lib-web-panel">
            <strong>Approved Web Search (Google)</strong>
            <div className="lib-web-row">
              <input
                className="lib-search"
                value={webSearchQuery}
                onChange={(event) => setWebSearchQuery(event.target.value)}
                placeholder="Open Google search in browser (manual, permission-based)"
              />
              <button className="run-button" onClick={handleWebSearch} disabled={webSearchLoading}>
                {webSearchLoading ? 'Opening...' : 'Open Google'}
              </button>
            </div>
            {webSearchMessage && <p className="muted">{webSearchMessage}</p>}
          </div>

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
          <div className="decision-card">
            <strong>Capability Registry</strong>
            <p>Admin controls what Paxion can access and execute.</p>
            <div className="capability-list">
              {(Object.keys(capabilities) as CapabilityKey[]).map((key) => (
                <div className="capability-item" key={key}>
                  <span>{key}</span>
                  <button
                    className="run-button"
                    onClick={() => {
                      void setCapability(key, !capabilities[key])
                    }}
                  >
                    {capabilities[key] ? 'Disable' : 'Enable'}
                  </button>
                </div>
              ))}
            </div>
            {accessMessage && <p className="muted">{accessMessage}</p>}
          </div>

          <div className="decision-card">
            <strong>External Integrations</strong>
            <p>
              Mode: {integrationStatus.desktopRelay ? 'Desktop Relay (No API)' : 'Unavailable'} |
              Google Relay: {integrationStatus.googleReady ? 'Ready' : 'Off'} | ChatGPT Relay:{' '}
              {integrationStatus.gptReady ? 'Ready' : 'Off'}
            </p>
            <p className="muted">
              No API keys. Paxion opens your desktop browser for ChatGPT and Google only after
              your permission through Access capabilities and active admin session.
            </p>
          </div>

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
                  setActionDetail(next.detail)
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
            <label htmlFor="action-detail">Action detail</label>
            <input
              id="action-detail"
              value={actionDetail}
              onChange={(event) => setActionDetail(event.target.value)}
              placeholder="Example: command=npm run build"
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

          <div className="decision-card">
            <strong>Learning Timeline (Simple)</strong>
            <p>
              Skills learned: {learnedSkills.length}
              {learningUpdatedAt ? ` | Updated: ${new Date(learningUpdatedAt).toLocaleString()}` : ''}
            </p>
            {learningLogs.length === 0 ? (
              <p className="muted">No learning events yet. Ingest books or relay captures to grow skills.</p>
            ) : (
              <div className="learning-log-list">
                {[...learningLogs]
                  .reverse()
                  .slice(0, 12)
                  .map((entry) => (
                    <article className="learning-log-item" key={entry.id}>
                      <strong>{entry.title}</strong>
                      <p className="muted">{entry.detail}</p>
                      {entry.newSkills.length > 0 ? (
                        <p className="muted">New skills: {entry.newSkills.join(', ')}</p>
                      ) : null}
                      <p className="muted">{new Date(entry.timestamp).toLocaleString()}</p>
                    </article>
                  ))}
              </div>
            )}
          </div>
        </div>
      )
    }

    if (activeTab === 'workspace') {
      return (
        <div className="tab-content-stack">
          <div className="decision-card">
            <strong>Skill Growth Board</strong>
            <p>
              Current unlocked skills: {learnedSkills.length}. Paxion grows by books, web research,
              and relay captures.
            </p>
            {learnedSkills.length > 0 ? (
              <p className="muted">{learnedSkills.slice(0, 10).join(' | ')}</p>
            ) : (
              <p className="muted">No skills unlocked yet. Add knowledge to start growth.</p>
            )}
          </div>

          <div className="decision-card">
            <strong>YouTube Learning Planner</strong>
            <p>
              Create segmented video learning plans with any chunk length (2 min, 5 min, 10 min,
              or custom) and open multiple segments in parallel workspaces.
            </p>
            <div className="control-group">
              <label htmlFor="yt-topic">Topic</label>
              <input
                id="yt-topic"
                value={videoTopic}
                onChange={(event) => setVideoTopic(event.target.value)}
                placeholder="Example: Python and C language core concepts"
              />
            </div>
            <div className="control-group">
              <label htmlFor="yt-url">YouTube URL</label>
              <input
                id="yt-url"
                value={videoUrl}
                onChange={(event) => setVideoUrl(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
            <div className="workspace-actions">
              <div className="control-group">
                <label htmlFor="yt-duration">Duration (min)</label>
                <input
                  id="yt-duration"
                  value={videoDurationMinutes}
                  onChange={(event) => setVideoDurationMinutes(event.target.value)}
                />
              </div>
              <div className="control-group">
                <label htmlFor="yt-segment">Segment (min)</label>
                <input
                  id="yt-segment"
                  value={videoSegmentMinutes}
                  onChange={(event) => setVideoSegmentMinutes(event.target.value)}
                  placeholder="Any value like 2, 5, 10"
                />
              </div>
              <div className="control-group">
                <label htmlFor="yt-parallel">Parallel slots</label>
                <input
                  id="yt-parallel"
                  value={videoParallelSlots}
                  onChange={(event) => setVideoParallelSlots(event.target.value)}
                />
              </div>
            </div>
            <label className="muted">
              <input
                type="checkbox"
                checked={videoPermission}
                onChange={(event) => setVideoPermission(event.target.checked)}
              />{' '}
              I give explicit permission to launch YouTube learning segments.
            </label>
            <div className="workspace-actions">
              <button className="run-button" onClick={() => void createYoutubeLearningPlan()}>
                Create Video Plan
              </button>
              <button
                className="run-button"
                onClick={() => {
                  const latest = videoPlans.at(-1)
                  if (!latest) {
                    setVideoMessage('No video plan available for batch open.')
                    return
                  }
                  void openYoutubeParallelBatch(latest.id)
                }}
              >
                Open Latest Plan Batch
              </button>
            </div>
            {videoMessage && <p className="muted">{videoMessage}</p>}

            {videoPlans.length > 0 && (
              <div className="learning-log-list">
                {[...videoPlans]
                  .reverse()
                  .slice(0, 4)
                  .map((plan) => (
                    <article className="learning-log-item" key={plan.id}>
                      <strong>{plan.topic}</strong>
                      <p className="muted">
                        Segments: {plan.segments.length} | chunk: {plan.segmentMinutes} min |
                        parallel: {plan.parallelSlots}
                      </p>
                      <div className="workspace-step-actions">
                        <button
                          className="run-button"
                          onClick={() => {
                            void openYoutubeParallelBatch(plan.id)
                          }}
                        >
                          Open Parallel Batch
                        </button>
                      </div>
                      <div className="learning-log-list">
                        {plan.segments.slice(0, 8).map((segment) => (
                          <article className="learning-log-item" key={segment.id}>
                            <strong>{segment.label}</strong>
                            <p className="muted">Status: {segment.status}</p>
                            <div className="workspace-step-actions">
                              <button
                                className="run-button"
                                onClick={() => {
                                  void openYoutubeSegment(plan.id, segment.id)
                                }}
                              >
                                Open
                              </button>
                              <button
                                className="run-button"
                                onClick={() => {
                                  setVideoTargetPlanId(plan.id)
                                  setVideoTargetSegmentId(segment.id)
                                }}
                              >
                                Mark Learned
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </article>
                  ))}
              </div>
            )}

            <div className="control-group">
              <label htmlFor="yt-plan-id">Completion plan ID</label>
              <input
                id="yt-plan-id"
                value={videoTargetPlanId}
                onChange={(event) => setVideoTargetPlanId(event.target.value)}
                placeholder="Plan ID"
              />
            </div>
            <div className="control-group">
              <label htmlFor="yt-segment-id">Completion segment ID</label>
              <input
                id="yt-segment-id"
                value={videoTargetSegmentId}
                onChange={(event) => setVideoTargetSegmentId(event.target.value)}
                placeholder="Segment ID"
              />
            </div>
            <div className="control-group">
              <label htmlFor="yt-summary">What was learned</label>
              <textarea
                id="yt-summary"
                className="lib-paste-area"
                value={videoSegmentSummary}
                onChange={(event) => setVideoSegmentSummary(event.target.value)}
                rows={3}
                placeholder="Simple summary of what Paxion learned from this segment"
              />
            </div>
            <div className="control-group">
              <label htmlFor="yt-skills">New skills (comma separated)</label>
              <input
                id="yt-skills"
                value={videoSegmentSkills}
                onChange={(event) => setVideoSegmentSkills(event.target.value)}
                placeholder="Python Basics, C Language Syntax"
              />
            </div>
            <button className="run-button" onClick={() => void completeYoutubeSegmentLearning()}>
              Save Segment Learning
            </button>
          </div>

          <div className="decision-card">
            <strong>Task-Specific UI Automation</strong>
            <p>
              Run strict allowlisted browser automation adapters (form fill and click flow) with
              explicit permission.
            </p>
            <div className="control-group">
              <label htmlFor="automation-profile">Profile (real app templates)</label>
              <select
                id="automation-profile"
                value={selectedAutomationProfileId}
                onChange={(event) => {
                  const id = event.target.value
                  if (id) {
                    applyAutomationProfile(id)
                  }
                }}
              >
                <option value="">Select profile...</option>
                {automationProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} ({profile.appType})
                  </option>
                ))}
              </select>
            </div>
            {selectedAutomationProfileId && Object.keys(automationProfileVariables).length > 0 && (
              <div className="control-group">
                <label>Profile variables</label>
                <div className="learning-log-list">
                  {Object.keys(automationProfileVariables).map((key) => (
                    <label className="muted" key={key}>
                      {key}
                      <input
                        value={automationProfileVariables[key] ?? ''}
                        onChange={(event) => updateAutomationProfileVariable(key, event.target.value)}
                        placeholder={`Value for ${key}`}
                      />
                    </label>
                  ))}
                </div>
                <button className="run-button" onClick={applyAutomationProfileVariables}>
                  Apply Profile Variables
                </button>
              </div>
            )}
            {selectedAutomationProfileId && (
              <div className="control-group">
                <label htmlFor="automation-preset-name">Preset name</label>
                <input
                  id="automation-preset-name"
                  value={automationPresetName}
                  onChange={(event) => setAutomationPresetName(event.target.value)}
                  placeholder="Example: production blog update"
                />
                <div className="workspace-actions">
                  <button className="run-button" onClick={() => void saveAutomationPreset()}>
                    Save Preset
                  </button>
                </div>
                {automationProfilePresets.filter((preset) => preset.profileId === selectedAutomationProfileId)
                  .length > 0 && (
                  <div className="learning-log-list">
                    {automationProfilePresets
                      .filter((preset) => preset.profileId === selectedAutomationProfileId)
                      .slice(0, 6)
                      .map((preset) => (
                        <article className="learning-log-item" key={preset.id}>
                          <strong>{preset.name}</strong>
                          <p className="muted">
                            Updated {new Date(preset.updatedAt).toLocaleString()}
                          </p>
                          <div className="workspace-step-actions">
                            <button className="run-button" onClick={() => loadAutomationPreset(preset.id)}>
                              Load Preset
                            </button>
                            <button
                              className="run-button"
                              onClick={() => void deleteAutomationPreset(preset.id)}
                            >
                              Delete Preset
                            </button>
                          </div>
                        </article>
                      ))}
                  </div>
                )}
              </div>
            )}
            <div className="control-group">
              <label htmlFor="automation-adapter">Adapter</label>
              <select
                id="automation-adapter"
                value={automationAdapterId}
                onChange={(event) =>
                  setAutomationAdapterId(
                    event.target.value as 'browser.formFill.basic' | 'browser.clickFlow.basic',
                  )
                }
              >
                <option value="browser.formFill.basic">browser.formFill.basic</option>
                <option value="browser.clickFlow.basic">browser.clickFlow.basic</option>
              </select>
            </div>
            <div className="control-group">
              <label htmlFor="automation-url">Target URL</label>
              <input
                id="automation-url"
                value={automationTargetUrl}
                onChange={(event) => setAutomationTargetUrl(event.target.value)}
                placeholder="https://example.com/form"
              />
            </div>
            <div className="control-group">
              <label htmlFor="automation-intent">Intent</label>
              <input
                id="automation-intent"
                value={automationIntent}
                onChange={(event) => setAutomationIntent(event.target.value)}
                placeholder="Submit signup form for approved account flow"
              />
            </div>
            <div className="control-group">
              <label htmlFor="automation-steps">Steps (action|selector|value)</label>
              <textarea
                id="automation-steps"
                className="lib-paste-area"
                value={automationStepsText}
                onChange={(event) => setAutomationStepsText(event.target.value)}
                rows={5}
                placeholder={[
                  'fill|#email|chief@paxion.ai',
                  'fill|#password|********',
                  'click|button[type="submit"]',
                  'wait||1000',
                ].join('\n')}
              />
            </div>
            <label className="muted">
              <input
                type="checkbox"
                checked={automationPermission}
                onChange={(event) => setAutomationPermission(event.target.checked)}
              />{' '}
              I give explicit permission for this automation run.
            </label>
            <div className="workspace-actions">
              <button className="run-button" onClick={() => void runAutomationAdapter()}>
                Run Adapter
              </button>
            </div>
            {capabilitySuggestions.length > 0 && (
              <div className="learning-log-list">
                {capabilitySuggestions.slice(0, 6).map((suggestion) => (
                  <article className="learning-log-item" key={suggestion.capability}>
                    <strong>Capability suggestion: {suggestion.capability}</strong>
                    <p className="muted">{suggestion.reason}</p>
                    <p className="muted">Confidence: {suggestion.confidence}%</p>
                    <p className="muted">Matched skills: {suggestion.matchedSkills.join(', ')}</p>
                    {suggestion.unmetPrerequisites.length > 0 && (
                      <p className="muted">
                        Unmet prerequisites: {suggestion.unmetPrerequisites.join(', ')}
                      </p>
                    )}
                    <p className="muted">{suggestion.recommendedAction}</p>
                    <button
                      className="run-button"
                      onClick={() => void enableSuggestedCapability(suggestion)}
                      disabled={!suggestion.readyToEnable}
                    >
                      Enable Suggested Capability
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="decision-card">
            <strong>Observe + Learn Templates</strong>
            <p>
              Apply workflow templates for code editor, CMS, and design tools using your provided
              knowledge source.
            </p>
            <div className="control-group">
              <label htmlFor="observe-template">Template</label>
              <select
                id="observe-template"
                value={automationTemplateId}
                onChange={(event) => setAutomationTemplateId(event.target.value)}
              >
                {automationTemplates.length === 0 ? (
                  <option value="">No templates loaded</option>
                ) : (
                  automationTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="control-group">
              <label htmlFor="observe-source">Source knowledge</label>
              <textarea
                id="observe-source"
                className="lib-paste-area"
                value={automationSourceKnowledge}
                onChange={(event) => setAutomationSourceKnowledge(event.target.value)}
                rows={4}
                placeholder="Example: Notes from Python + C lessons, CMS publishing guide, design heuristics"
              />
            </div>
            <button className="run-button" onClick={() => void runObserveLearnTemplate()}>
              Run Observe + Learn
            </button>
          </div>

          <div className="decision-card">
            <strong>Execution Recorder</strong>
            <p>
              Logs intended step, performed step, result, and new skill gained in simple language.
            </p>
            <div className="control-group">
              <label htmlFor="replay-record-id">Replay record ID</label>
              <input
                id="replay-record-id"
                value={replayRecordId}
                onChange={(event) => setReplayRecordId(event.target.value)}
                placeholder="exec-..."
              />
            </div>
            <label className="muted">
              <input
                type="checkbox"
                checked={replayPermission}
                onChange={(event) => setReplayPermission(event.target.checked)}
              />{' '}
              I give explicit permission to replay this record.
            </label>
            <div className="workspace-actions">
              <button className="run-button" onClick={() => void previewReplayExecutionRecord()}>
                Preview Replay
              </button>
              <button className="run-button" onClick={() => void replayExecutionRecord()}>
                Replay Record
              </button>
            </div>
            {replayPreview && replayPreview.sourceRecord.id === replayRecordId.trim() && (
              <div className="learning-log-list">
                <article className="learning-log-item">
                  <strong>Replay preview ready</strong>
                  <p className="muted">Steps to replay: {replayPreview.relatedRecords.length}</p>
                  {replayPreview.targetUrl && (
                    <p className="muted">Target URL: {replayPreview.targetUrl}</p>
                  )}
                  {replayPreview.intent && <p className="muted">Intent: {replayPreview.intent}</p>}
                  <p className="muted">
                    Preview expires at {new Date(replayPreview.expiresAt).toLocaleTimeString()}
                  </p>
                </article>
                {replayPreview.stepDiffs.slice(0, 8).map((diff) => (
                  <article className="learning-log-item" key={diff.recordId}>
                    <strong>Step diff: {diff.recordId}</strong>
                    <p className="muted">Original intended: {diff.originalIntendedStep}</p>
                    <p className="muted">Replay intended: {diff.replayIntendedStep}</p>
                    <p className="muted">Original performed: {diff.originalPerformedStep}</p>
                    <p className="muted">Replay performed: {diff.replayPerformedStep}</p>
                    <p className="muted">
                      Result change: {diff.originalResult} -&gt; {diff.replayResult}
                    </p>
                  </article>
                ))}
              </div>
            )}
            {executionRecords.length === 0 ? (
              <p className="muted">No execution records yet. Run adapter or template to populate.</p>
            ) : (
              <div className="learning-log-list">
                {[...executionRecords]
                  .reverse()
                  .slice(0, 15)
                  .map((record) => (
                    <article className="learning-log-item" key={record.id}>
                      <strong>{record.simpleLog}</strong>
                      <p className="muted">Record ID: {record.id}</p>
                      <p className="muted">Intended: {record.intendedStep}</p>
                      <p className="muted">Performed: {record.performedStep}</p>
                      <p className="muted">Result: {record.result}</p>
                      {record.newSkills.length > 0 ? (
                        <p className="muted">New skill gained: {record.newSkills.join(', ')}</p>
                      ) : (
                        <p className="muted">New skill gained: none</p>
                      )}
                      <button className="run-button" onClick={() => selectReplayRecord(record.id)}>
                        Use For Replay
                      </button>
                    </article>
                  ))}
              </div>
            )}
            {automationMessage && <p className="muted">{automationMessage}</p>}
          </div>

          <div className="decision-card">
            <strong>Target Workflow Packs</strong>
            <p>
              Prepare deterministic app-specific packs with verification and rollback steps for
              browser, design, and editor workflows.
            </p>
            <div className="control-group">
              <label htmlFor="target-pack">Target pack</label>
              <select
                id="target-pack"
                value={selectedTargetPackId}
                onChange={(event) => {
                  const nextId = event.target.value
                  if (nextId) {
                    selectTargetPack(nextId)
                  }
                }}
              >
                <option value="">Select target pack...</option>
                {targetPacks.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.name} ({pack.surface})
                  </option>
                ))}
              </select>
            </div>
            {selectedTargetPackId && Object.keys(targetPackVariables).length > 0 && (
              <div className="control-group">
                <label>Target variables</label>
                <div className="learning-log-list">
                  {Object.keys(targetPackVariables).map((key) => (
                    <label className="muted" key={key}>
                      {key}
                      <input
                        value={targetPackVariables[key] ?? ''}
                        onChange={(event) => updateTargetPackVariable(key, event.target.value)}
                        placeholder={`Value for ${key}`}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
            <label className="muted">
              <input
                type="checkbox"
                checked={targetPackPermission}
                onChange={(event) => setTargetPackPermission(event.target.checked)}
              />{' '}
              I give explicit permission to prepare this target workflow pack.
            </label>
            <div className="workspace-actions">
              <button className="run-button" onClick={() => void runTargetWorkflowPack()}>
                Prepare Target Pack
              </button>
            </div>
            {executionSessions.length > 0 && (
              <div className="learning-log-list">
                {[...executionSessions]
                  .reverse()
                  .slice(0, 6)
                  .map((session) => (
                    <article className="learning-log-item" key={session.id}>
                      <strong>{session.packName}</strong>
                      <p className="muted">Status: {session.status}</p>
                      <p className="muted">Intent: {session.intent}</p>
                      <p className="muted">Verification checks: {session.verificationChecks.length}</p>
                      <div className="workspace-step-actions">
                        <button
                          className="run-button"
                          onClick={() => {
                            setEvidenceSessionId(session.id)
                            setEvidenceSummary(`Evidence summary for ${session.packName}`)
                            setEvidenceScreenshotPath(session.targetUrl)
                          }}
                        >
                          Use In Evidence
                        </button>
                        <button
                          className="run-button"
                          onClick={() => void verifyExecutionSessionById(session.id, 'verified')}
                        >
                          Verify Pass
                        </button>
                        <button
                          className="run-button"
                          onClick={() => void verifyExecutionSessionById(session.id, 'failed')}
                        >
                          Mark Failed
                        </button>
                        <button
                          className="run-button"
                          onClick={() => void rollbackExecutionSessionById(session.id)}
                        >
                          Prepare Rollback
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
            )}
            <div className="control-group">
              <label htmlFor="session-evidence">Verification evidence</label>
              <textarea
                id="session-evidence"
                className="lib-paste-area"
                value={sessionEvidenceText}
                onChange={(event) => setSessionEvidenceText(event.target.value)}
                rows={3}
                placeholder="One evidence item per line"
              />
            </div>
            <div className="control-group">
              <label htmlFor="session-notes">Verification / rollback notes</label>
              <textarea
                id="session-notes"
                className="lib-paste-area"
                value={sessionNotes}
                onChange={(event) => setSessionNotes(event.target.value)}
                rows={3}
                placeholder="Summary of what was verified or why rollback is needed"
              />
            </div>
          </div>

          <div className="decision-card">
            <strong>Evidence Artifact Pipeline</strong>
            <p>Create hashed evidence bundles from session outputs, notes, and optional OCR/DOM data.</p>
            <div className="control-group">
              <label htmlFor="evidence-session-id">Session ID</label>
              <input
                id="evidence-session-id"
                value={evidenceSessionId}
                onChange={(event) => setEvidenceSessionId(event.target.value)}
                placeholder="session-..."
              />
            </div>
            <div className="control-group">
              <label htmlFor="evidence-summary">Summary</label>
              <textarea
                id="evidence-summary"
                className="lib-paste-area"
                value={evidenceSummary}
                onChange={(event) => setEvidenceSummary(event.target.value)}
                rows={3}
                placeholder="High-level evidence summary"
              />
            </div>
            <div className="control-group">
              <label htmlFor="evidence-notes">Notes</label>
              <textarea
                id="evidence-notes"
                className="lib-paste-area"
                value={evidenceNotes}
                onChange={(event) => setEvidenceNotes(event.target.value)}
                rows={3}
              />
            </div>
            <div className="control-group">
              <label htmlFor="evidence-dom">DOM / state snapshot</label>
              <textarea
                id="evidence-dom"
                className="lib-paste-area"
                value={evidenceDomSnapshot}
                onChange={(event) => setEvidenceDomSnapshot(event.target.value)}
                rows={3}
              />
            </div>
            <div className="control-group">
              <label htmlFor="evidence-command">Command output</label>
              <textarea
                id="evidence-command"
                className="lib-paste-area"
                value={evidenceCommandOutput}
                onChange={(event) => setEvidenceCommandOutput(event.target.value)}
                rows={3}
              />
            </div>
            <div className="control-group">
              <label htmlFor="evidence-screenshot">Screenshot path</label>
              <input
                id="evidence-screenshot"
                value={evidenceScreenshotPath}
                onChange={(event) => setEvidenceScreenshotPath(event.target.value)}
                placeholder="Optional local image path for screenshot hash"
              />
            </div>
            <button className="run-button" onClick={() => void createEvidenceArtifact()}>
              Create Evidence Artifact
            </button>
            {evidenceArtifactHash && (
              <p className="muted">
                Evidence hash: {evidenceArtifactHash.slice(0, 20)}... | path: {evidenceArtifactPath}
              </p>
            )}
          </div>

          <div className="decision-card">
            <strong>Observation Capture</strong>
            <p>Store real app-state observations and inferred skills for later graph learning.</p>
            <div className="control-group">
              <label htmlFor="observation-title">Observation title</label>
              <input
                id="observation-title"
                value={observationTitle}
                onChange={(event) => setObservationTitle(event.target.value)}
                placeholder="Example: WordPress editor publish screen"
              />
            </div>
            <div className="control-group">
              <label htmlFor="observation-app-type">App type</label>
              <input
                id="observation-app-type"
                value={observationAppType}
                onChange={(event) => setObservationAppType(event.target.value)}
                placeholder="code-editor, cms, design"
              />
            </div>
            <div className="control-group">
              <label htmlFor="observation-visible">Visible state / OCR text</label>
              <textarea
                id="observation-visible"
                className="lib-paste-area"
                value={observationVisibleText}
                onChange={(event) => setObservationVisibleText(event.target.value)}
                rows={3}
              />
            </div>
            <div className="control-group">
              <label htmlFor="observation-notes">Notes</label>
              <textarea
                id="observation-notes"
                className="lib-paste-area"
                value={observationNotes}
                onChange={(event) => setObservationNotes(event.target.value)}
                rows={3}
              />
            </div>
            <div className="control-group">
              <label htmlFor="observation-path">Screenshot path</label>
              <input
                id="observation-path"
                value={observationScreenshotPath}
                onChange={(event) => setObservationScreenshotPath(event.target.value)}
                placeholder="Optional local screenshot path"
              />
            </div>
            <button className="run-button" onClick={() => void captureObservation()}>
              Save Observation
            </button>
            {observationSnapshots.length > 0 && (
              <div className="learning-log-list">
                {[...observationSnapshots]
                  .reverse()
                  .slice(0, 5)
                  .map((snapshot) => (
                    <article className="learning-log-item" key={snapshot.id}>
                      <strong>{snapshot.title}</strong>
                      <p className="muted">{snapshot.appType}</p>
                      <p className="muted">Skills: {snapshot.inferredSkills.join(', ') || 'none'}</p>
                    </article>
                  ))}
              </div>
            )}
          </div>

          <div className="decision-card">
            <strong>Cross-App Mission Planner</strong>
            <p>Create multi-surface plans that connect browser, editor, design, and workspace phases.</p>
            <div className="control-group">
              <label htmlFor="cross-app-surfaces">Surfaces (comma separated)</label>
              <input
                id="cross-app-surfaces"
                value={crossAppSurfacesText}
                onChange={(event) => setCrossAppSurfacesText(event.target.value)}
                placeholder="browser, editor, workspace"
              />
            </div>
            <button className="run-button" onClick={() => void planCrossAppMission()}>
              Plan Cross-App Mission
            </button>
            {crossAppMissions.length > 0 && (
              <div className="learning-log-list">
                {[...crossAppMissions]
                  .reverse()
                  .slice(0, 4)
                  .map((mission) => (
                    <article className="learning-log-item" key={mission.id}>
                      <strong>{mission.goal}</strong>
                      <p className="muted">Surfaces: {mission.surfaces.join(', ')}</p>
                      <p className="muted">Phases: {mission.phases.length}</p>
                      <p className="muted">
                        Recommended packs: {mission.recommendedPacks.map((pack) => pack.name).join(', ') || 'none'}
                      </p>
                    </article>
                  ))}
              </div>
            )}
          </div>

          <div className="decision-card">
            <strong>Learning Graph</strong>
            <p>
              Graph nodes: {learningGraph.nodes.length} | edges: {learningGraph.edges.length}
              {learningGraph.updatedAt ? ` | updated ${new Date(learningGraph.updatedAt).toLocaleString()}` : ''}
            </p>
            {learningGraph.nodes.length > 0 && (
              <div className="learning-log-list">
                {learningGraph.nodes.slice(0, 8).map((node) => (
                  <article className="learning-log-item" key={node.id}>
                    <strong>{node.label}</strong>
                    <p className="muted">{node.kind}</p>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="decision-card">
            <strong>Self-Evolution Pipeline</strong>
            <p>Create staged self-evolution flows with proposal, scaffold, test, review, and deploy stages.</p>
            <div className="control-group">
              <label htmlFor="evolution-title">Pipeline title</label>
              <input
                id="evolution-title"
                value={evolutionTitle}
                onChange={(event) => setEvolutionTitle(event.target.value)}
                placeholder="Example: add safer browser verification module"
              />
            </div>
            <div className="control-group">
              <label htmlFor="evolution-objective">Objective</label>
              <textarea
                id="evolution-objective"
                className="lib-paste-area"
                value={evolutionObjective}
                onChange={(event) => setEvolutionObjective(event.target.value)}
                rows={3}
              />
            </div>
            <button className="run-button" onClick={() => void createEvolutionPipeline()}>
              Create Evolution Pipeline
            </button>
            {evolutionPipelines.length > 0 && (
              <div className="learning-log-list">
                {[...evolutionPipelines]
                  .reverse()
                  .slice(0, 5)
                  .map((pipeline) => (
                    <article className="learning-log-item" key={pipeline.id}>
                      <strong>{pipeline.title}</strong>
                      <p className="muted">Current stage: {pipeline.currentStage}</p>
                      <button
                        className="run-button"
                        onClick={() => void advanceEvolutionPipelineById(pipeline.id)}
                      >
                        Advance Stage
                      </button>
                    </article>
                  ))}
              </div>
            )}
          </div>

          <div className="decision-card">
            <strong>Vision / OCR Queue</strong>
            <p>Create local screenshot review jobs and feed extracted text into the learning graph.</p>
            <div className="control-group">
              <label htmlFor="vision-objective">Objective</label>
              <input
                id="vision-objective"
                value={visionObjective}
                onChange={(event) => setVisionObjective(event.target.value)}
                placeholder="Example: read modal text from admin panel screenshot"
              />
            </div>
            <div className="control-group">
              <label htmlFor="vision-path">Screenshot path</label>
              <input
                id="vision-path"
                value={visionScreenshotPath}
                onChange={(event) => setVisionScreenshotPath(event.target.value)}
                placeholder="Optional local image path"
              />
            </div>
            <div className="control-group">
              <label htmlFor="vision-text">Extracted text</label>
              <textarea
                id="vision-text"
                className="lib-paste-area"
                value={visionExtractedText}
                onChange={(event) => setVisionExtractedText(event.target.value)}
                rows={3}
              />
            </div>
            <div className="control-group">
              <label htmlFor="vision-notes">Notes</label>
              <textarea
                id="vision-notes"
                className="lib-paste-area"
                value={visionNotes}
                onChange={(event) => setVisionNotes(event.target.value)}
                rows={2}
              />
            </div>
            <button className="run-button" onClick={() => void createVisionJob()}>
              Queue Vision Job
            </button>
            <div className="control-group">
              <label htmlFor="ocr-job-id">OCR job ID (optional)</label>
              <input
                id="ocr-job-id"
                value={ocrJobId}
                onChange={(event) => setOcrJobId(event.target.value)}
                placeholder="vision-..."
              />
            </div>
            <div className="control-group">
              <label htmlFor="ocr-image-path">OCR image path (optional if job selected)</label>
              <input
                id="ocr-image-path"
                value={ocrImagePath}
                onChange={(event) => setOcrImagePath(event.target.value)}
                placeholder="Local screenshot path"
              />
            </div>
            <div className="control-group">
              <label htmlFor="ocr-language">OCR language</label>
              <input
                id="ocr-language"
                value={ocrLanguage}
                onChange={(event) => setOcrLanguage(event.target.value)}
                placeholder="eng"
              />
            </div>
            <button className="run-button" onClick={() => void runLocalOcr()}>
              Run Local OCR
            </button>
            {ocrResultText && (
              <div className="control-group">
                <label htmlFor="ocr-result">OCR result</label>
                <textarea
                  id="ocr-result"
                  className="lib-paste-area"
                  value={ocrResultText}
                  onChange={(event) => setOcrResultText(event.target.value)}
                  rows={4}
                />
              </div>
            )}
            {visionJobs.length > 0 && (
              <div className="learning-log-list">
                {[...visionJobs]
                  .reverse()
                  .slice(0, 5)
                  .map((job) => (
                    <article className="learning-log-item" key={job.id}>
                      <strong>{job.objective}</strong>
                      <p className="muted">Status: {job.status}</p>
                      <p className="muted">Skills: {job.inferredSkills.join(', ') || 'none'}</p>
                      <button className="run-button" onClick={() => void reviewVisionJob(job.id)}>
                        Mark Reviewed
                      </button>
                    </article>
                  ))}
              </div>
            )}
            {readinessMessage && <p className="muted">{readinessMessage}</p>}
          </div>

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
        <span>Version: v0.16.0-ocr-evidence</span>
      </footer>
    </div>
  )
}

export default App
