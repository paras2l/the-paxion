import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { PaxionBrain } from './brain/engine'
import { FOUNDATION_KNOWLEDGE_PACKS } from './brain/foundationKnowledge'
import { rankFromDocs } from './brain/knowledge'
import type { ChatMessage } from './chat/types'
import { LibraryStore } from './library/libraryStore'
import type { LibraryDocument } from './library/types'
import {
  deriveProviderHealth,
  loadModelRouterConfig,
  saveModelRouterConfig,
  type ModelProviderId,
  type ModelRouterConfig,
  type RoutingProfile,
} from './core/models/router'
import { deriveDeviceProfile, routeActionRequest } from './core/device/actionRouter'
import { createPolicySnapshot } from './core/policy/policyAdapter'
import { ApprovalStore } from './security/approvals'
import { AuditLedger } from './security/audit'
import ControlShell from './ui/control/ControlShell'
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

const KNOWLEDGE_BOOTSTRAP_SOURCES: Array<{ name: string; url: string; type: 'google-web' | 'github' }> = [
  {
    name: 'AI Basics (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
    type: 'google-web',
  },
  {
    name: 'Machine Learning Basics (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Machine_learning',
    type: 'google-web',
  },
  {
    name: 'Software Engineering (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Software_engineering',
    type: 'google-web',
  },
  {
    name: 'Computer Security (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Computer_security',
    type: 'google-web',
  },
  {
    name: 'Data Structures (Wikipedia)',
    url: 'https://en.wikipedia.org/wiki/Data_structure',
    type: 'google-web',
  },
  {
    name: 'JavaScript Guide (MDN)',
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide',
    type: 'google-web',
  },
  {
    name: 'Python Tutorial Index (Python Docs)',
    url: 'https://docs.python.org/3/tutorial/index.html',
    type: 'google-web',
  },
  {
    name: 'JavaScript Algorithms (GitHub README)',
    url: 'https://raw.githubusercontent.com/trekhleb/javascript-algorithms/master/README.md',
    type: 'github',
  },
  {
    name: 'OSSU Computer Science (GitHub README)',
    url: 'https://raw.githubusercontent.com/ossu/computer-science/master/README.md',
    type: 'github',
  },
  {
    name: 'Developer Roadmap (GitHub README)',
    url: 'https://raw.githubusercontent.com/kamranahmedse/developer-roadmap/master/README.md',
    type: 'github',
  },
]

const BRAIN_PROFILE_DOC_NAME = '[Brain Memory] Unified Knowledge Profile'

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
  emergencyCallRelay: boolean
}

type CapabilityKey = keyof CapabilityState

type FeatureFlagState = {
  desktopAdapterEnabled: boolean
  cloudRelayEnabled: boolean
  memoryNormalizationEnabled: boolean
}

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

type BeforeInstallPromptEventLike = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type AssistantMode = 'chat' | 'voice'
type UiTheme = 'night' | 'day'
type WorkspaceTopicTab = 'overview' | 'polyglot' | 'youtube' | 'automation'

type PolyglotLanguage = 'python' | 'c' | 'cpp' | 'java' | 'julia' | 'r' | 'javascript'

type PolyglotRuntimeStatus = {
  language: string
  available: boolean
  command: string | null
  detail: string
}

type PolyglotRunResult = {
  ok: boolean
  reason: string
  language: string
  stage: 'setup' | 'compile' | 'run'
  stdout: string
  stderr: string
  exitCode: number | null
  timedOut: boolean
  commands: string[]
  artifactPath: string | null
  skills?: string[]
  updatedAt?: string | null
}

type PolyglotBrainMeshItem = {
  language: string
  ok: boolean
  reason: string
  detail?: Record<string, unknown> | null
  stdout?: string
  stderr?: string
  commands: string[]
  timedOut?: boolean
  artifactPath?: string | null
}

type PolyglotBrainMeshResult = {
  ok: boolean
  objective: string
  results: PolyglotBrainMeshItem[]
  summary: string
  completedCount: number
  attemptedCount: number
  skills?: string[]
  updatedAt?: string | null
}

type IntegrationStatus = {
  desktopRelay: boolean
  googleReady: boolean
  gptReady: boolean
  requiresAdminApproval: boolean
}

type VoiceRuntimeProfile = {
  duplexEnabled: boolean
  interruptionHandling: string
  personaMemory: string
  prosody: string
}

type WakewordRuntimeStatus = {
  provider: string
  executablePath: string
  executablePresent: boolean
  modelPath: string
  modelPresent: boolean
  accessKeyConfigured: boolean
  alwaysOn: boolean
  sensitivity: number
  detectionMode: string
  keyword: string
  status: string
  estimatedLatencyMs: number
  updatedAt: string | null
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

type SttToolStatus = {
  available: boolean
  command: string | null
  detail: string
}

type VideoSttStatus = {
  ready: boolean
  tools: {
    ytDlp: SttToolStatus
    ffmpeg: SttToolStatus
    whisper: SttToolStatus
  }
  updatedAt: string | null
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
  compatibilityProfiles?: Array<{
    appKey: string
    constraints: string[]
    selectors?: Record<string, string>
    fallbackSelectors?: string[]
  }>
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
  appKey?: string
  appVersion?: string
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
  compatibilityProfile?: Record<string, unknown> | null
  stepStates?: Array<{
    id: string
    index: number
    title: string
    status: string
    evidenceRefs: string[]
    attestationHash: string | null
    updatedAt: string
  }>
  rollbackTransactions?: Array<Record<string, unknown>>
  latestAttestationHash?: string | null
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
  governance?: {
    minTestsForReview: number
    minTestsForDeploy: number
    requiredPolicySignatures: number
    signatures: Array<{ signature: string; signer: string; signedAt: string; note: string }>
    metrics: { testsPassed: number; lintPassed: boolean; buildPassed: boolean }
  }
}

type GraphQueryPage = {
  cursor: number
  nextCursor: number | null
  limit: number
  totalNodes: number
  totalEdges: number
}

type GraphIndexStats = {
  totalSourceNodes: number
  totalSourceEdges: number
  distinctKinds: number
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

const POLYGLOT_LANGUAGE_LABELS: Record<PolyglotLanguage, string> = {
  python: 'Python',
  c: 'C',
  cpp: 'C++',
  java: 'Java',
  julia: 'Julia',
  r: 'R',
  javascript: 'JavaScript',
}

const POLYGLOT_TEMPLATES: Record<PolyglotLanguage, string> = {
  python: ['name = "Paxion"', 'print(f"Hello from Python, {name}.")'].join('\n'),
  c: [
    '#include <stdio.h>',
    '',
    'int main(void) {',
    '  printf("Hello from C.\\n");',
    '  return 0;',
    '}',
  ].join('\n'),
  cpp: [
    '#include <iostream>',
    '',
    'int main() {',
    '  std::cout << "Hello from C++" << std::endl;',
    '  return 0;',
    '}',
  ].join('\n'),
  java: [
    'public class Main {',
    '  public static void main(String[] args) {',
    '    System.out.println("Hello from Java");',
    '  }',
    '}',
  ].join('\n'),
  julia: ['name = "Paxion"', 'println("Hello from Julia, $name.")'].join('\n'),
  r: ['name <- "Paxion"', 'cat(sprintf("Hello from R, %s\\n", name))'].join('\n'),
  javascript: ['const name = "Paxion"', 'console.log(`Hello from JavaScript, ${name}.`)'].join('\n'),
}

function parseCliArgsText(text: string): string[] {
  return (text.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((part) => part.replace(/^['"]|['"]$/g, ''))
}

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
  libraryIngestWeb: true,
  chatExternalModel: false,
  voiceInput: true,
  voiceOutput: true,
  emergencyCallRelay: true,
}

const defaultIntegrationStatus: IntegrationStatus = {
  desktopRelay: true,
  googleReady: false,
  gptReady: false,
  requiresAdminApproval: true,
}

const defaultFeatureFlags: FeatureFlagState = {
  desktopAdapterEnabled: false,
  cloudRelayEnabled: false,
  memoryNormalizationEnabled: true,
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
  const [routerConfig, setRouterConfig] = useState<ModelRouterConfig>(() => loadModelRouterConfig())
  const [selectedActionId, setSelectedActionId] = useState(actionPresets[0].id)
  const [targetPath, setTargetPath] = useState(actionPresets[0].targetPath)
  const [actionDetail, setActionDetail] = useState(actionPresets[0].detail)
  const [adminCodeword, setAdminCodeword] = useState('')
  const [lastDecision, setLastDecision] = useState<string>('No action evaluated yet.')
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [adminExpiresAt, setAdminExpiresAt] = useState<number | null>(null)
  const [adminMessage, setAdminMessage] = useState('')
  const [pwaInstallEvent, setPwaInstallEvent] = useState<BeforeInstallPromptEventLike | null>(null)
  const [pwaInstallMessage, setPwaInstallMessage] = useState('')
  const [pwaInstalled, setPwaInstalled] = useState(false)
  const [capabilities, setCapabilities] = useState<CapabilityState>(defaultCapabilityState)
  const [featureFlags, setFeatureFlags] = useState<FeatureFlagState>(defaultFeatureFlags)
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
  const [videoSttStatus, setVideoSttStatus] = useState<VideoSttStatus | null>(null)
  const [videoSttLoading, setVideoSttLoading] = useState(false)
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
  const [targetAppKey, setTargetAppKey] = useState('')
  const [targetAppVersion, setTargetAppVersion] = useState('')
  const [nativeActionSessionId, setNativeActionSessionId] = useState('')
  const [nativeActionStepId, setNativeActionStepId] = useState('step-1')
  const [nativeActionType, setNativeActionType] = useState<'click' | 'fill' | 'select' | 'extractText' | 'command'>('click')
  const [nativeActionSelector, setNativeActionSelector] = useState('')
  const [nativeActionFallbackSelectors, setNativeActionFallbackSelectors] = useState('')
  const [nativeActionCommand, setNativeActionCommand] = useState('')
  const [nativeActionDomSnapshot, setNativeActionDomSnapshot] = useState('')
  const [nativeActionPermission, setNativeActionPermission] = useState(false)
  const [graphQueryText, setGraphQueryText] = useState('')
  const [graphQueryKinds, setGraphQueryKinds] = useState('')
  const [graphQueryEdgeKind, setGraphQueryEdgeKind] = useState('')
  const [graphCursor, setGraphCursor] = useState(0)
  const [graphPage, setGraphPage] = useState<GraphQueryPage | null>(null)
  const [graphIndexStats, setGraphIndexStats] = useState<GraphIndexStats | null>(null)
  const [governancePipelineId, setGovernancePipelineId] = useState('')
  const [governanceSignatureNote, setGovernanceSignatureNote] = useState('')
  const [governanceTestsPassed, setGovernanceTestsPassed] = useState('5')
  const [governanceLintPassed, setGovernanceLintPassed] = useState(true)
  const [governanceBuildPassed, setGovernanceBuildPassed] = useState(true)
  const [attestationFingerprint, setAttestationFingerprint] = useState('')
  const [attestationLastHash, setAttestationLastHash] = useState('')
  const [attestationRotationReason, setAttestationRotationReason] = useState('Routine rotation')
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
  const [foundationKnowledgeMessage, setFoundationKnowledgeMessage] = useState('')
  const [libraryUpdatedAt, setLibraryUpdatedAt] = useState<string | null>(null)
  const [webSearchQuery, setWebSearchQuery] = useState('')
  const [webSearchLoading, setWebSearchLoading] = useState(false)
  const [webSearchMessage, setWebSearchMessage] = useState('')
  const [webIngestUrl, setWebIngestUrl] = useState('')
  const [webIngestLoading, setWebIngestLoading] = useState(false)
  const [webIngestMessage, setWebIngestMessage] = useState('')
  const [knowledgeBootstrapLoading, setKnowledgeBootstrapLoading] = useState(false)
  const [knowledgeBootstrapMessage, setKnowledgeBootstrapMessage] = useState('')
  const [youtubeIngestUrl, setYoutubeIngestUrl] = useState('')
  const [youtubeIngestLoading, setYoutubeIngestLoading] = useState(false)
  const [youtubeIngestMessage, setYoutubeIngestMessage] = useState('')
  const [uiTheme, setUiTheme] = useState<UiTheme>(() => {
    const saved = localStorage.getItem('paxion-ui-theme')
    return saved === 'day' ? 'day' : 'night'
  })
  const libraryLoadedRef = useRef(false)

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatNotice, setChatNotice] = useState('')
  const [chatUserName, setChatUserName] = useState('')
  const [chatFriendlyTone, setChatFriendlyTone] = useState(false)
  const [relayCaptureTitle, setRelayCaptureTitle] = useState('')
  const [relayCaptureText, setRelayCaptureText] = useState('')
  const [chatVoiceListening, setChatVoiceListening] = useState(false)
  const [chatVoicePending, setChatVoicePending] = useState<'idle' | 'starting' | 'stopping'>('idle')
  const [chatVoiceEnabled, setChatVoiceEnabled] = useState(true)
  const [assistantMode, setAssistantMode] = useState<AssistantMode>('chat')
  const [wakePhrase, setWakePhrase] = useState('paxion wakeup')
  const [closeToTrayEnabled, setCloseToTrayEnabled] = useState(true)
  const [voiceLoopEnabled, setVoiceLoopEnabled] = useState(false)
  const [callProvider, setCallProvider] = useState<'desktop-relay' | 'twilio' | 'sip'>('desktop-relay')
  const [callFromNumber, setCallFromNumber] = useState('')
  const [twilioAccountSid, setTwilioAccountSid] = useState('')
  const [twilioAuthToken, setTwilioAuthToken] = useState('')
  const [twilioSecretStatus, setTwilioSecretStatus] = useState('Not loaded')
  const [sipUri, setSipUri] = useState('')
  const [sipUsername, setSipUsername] = useState('')
  const [sipPassword, setSipPassword] = useState('')
  const [terminalPacks, setTerminalPacks] = useState<Array<Record<string, unknown>>>([])
  const [terminalPackName, setTerminalPackName] = useState('')
  const [terminalPackCommands, setTerminalPackCommands] = useState('')
  const [terminalPackSimulation, setTerminalPackSimulation] = useState<Record<string, unknown> | null>(null)
  const [bridgeEnabled, setBridgeEnabled] = useState(false)
  const [bridgeHost, setBridgeHost] = useState('0.0.0.0')
  const [bridgePort, setBridgePort] = useState('8731')
  const [bridgeSecret, setBridgeSecret] = useState('')
  const [bridgePendingRequests, setBridgePendingRequests] = useState<Array<Record<string, unknown>>>([])
  const [bridgeMessage, setBridgeMessage] = useState('')
  const [bridgeOneTimeToken, setBridgeOneTimeToken] = useState('')
  const [threatDashboard, setThreatDashboard] = useState<Record<string, unknown> | null>(null)
  const [voiceProfile, setVoiceProfile] = useState<VoiceRuntimeProfile>({
    duplexEnabled: true,
    interruptionHandling: 'barge-in',
    personaMemory: 'friendly-technical',
    prosody: 'balanced',
  })
  const [wakewordStatus, setWakewordStatus] = useState<WakewordRuntimeStatus>({
    provider: 'browser-fallback',
    executablePath: '',
    executablePresent: false,
    modelPath: '',
    modelPresent: false,
    accessKeyConfigured: false,
    alwaysOn: false,
    sensitivity: 0.55,
    detectionMode: 'keyword-spotting',
    keyword: 'paxion wakeup',
    status: 'not-configured',
    estimatedLatencyMs: 450,
    updatedAt: null,
  })
  const [wakewordAccessKey, setWakewordAccessKey] = useState('')
  const [voiceRuntimeMessage, setVoiceRuntimeMessage] = useState('')
  const [relayMode, setRelayMode] = useState('disabled')
  const [cloudRelayEndpoint, setCloudRelayEndpoint] = useState('')
  const [cloudRelayToken, setCloudRelayToken] = useState('')
  const [cloudRelayDeviceId, setCloudRelayDeviceId] = useState('paxion-primary')
  const [cloudRelayPollingEnabled, setCloudRelayPollingEnabled] = useState(false)
  const [cloudRelayTokenConfigured, setCloudRelayTokenConfigured] = useState(false)
  const [cloudRelayRequests, setCloudRelayRequests] = useState<Array<Record<string, unknown>>>([])
  const [cloudRelayMessage, setCloudRelayMessage] = useState('')
  const [cloudRelayLastSyncAt, setCloudRelayLastSyncAt] = useState<string | null>(null)
  const [perceptionEnabled, setPerceptionEnabled] = useState(false)
  const [perceptionLabelHints, setPerceptionLabelHints] = useState('person, screen')
  const [perceptionFrames, setPerceptionFrames] = useState<Array<Record<string, unknown>>>([])
  const [perceptionSummary, setPerceptionSummary] = useState('')
  const [perceptionSceneGraph, setPerceptionSceneGraph] = useState<Record<string, unknown> | null>(null)
  const [perceptionMessage, setPerceptionMessage] = useState('')
  const [weeklyOptimizationMessage, setWeeklyOptimizationMessage] = useState('')
  const [weeklyOptimizationAutoTune, setWeeklyOptimizationAutoTune] = useState(true)
  const [weeklyOptimizationReport, setWeeklyOptimizationReport] = useState<Record<string, unknown> | null>(null)
  const [showThought, setShowThought] = useState<string | null>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const perceptionVideoRef = useRef<HTMLVideoElement | null>(null)
  const perceptionStreamRef = useRef<MediaStream | null>(null)
  const perceptionIntervalRef = useRef<number | null>(null)
  const lastSpokenMessageIdRef = useRef<string | null>(null)
  const voiceLoopEnabledRef = useRef(false)
  const wakeArmedRef = useRef(true)
  const voiceCommandInFlightRef = useRef(false)
  const suppressVoiceAutoRestartRef = useRef(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', uiTheme)
    localStorage.setItem('paxion-ui-theme', uiTheme)
  }, [uiTheme])

  // Workspace mission executor state
  const [workspaceGoal, setWorkspaceGoal] = useState('')
  const [workspacePlan, setWorkspacePlan] = useState<WorkspaceStep[]>([])
  const [workspaceRunning, setWorkspaceRunning] = useState(false)
  const [workspaceMessage, setWorkspaceMessage] = useState('')
  const [workspaceQueuePaused, setWorkspaceQueuePaused] = useState(false)
  const [workspaceQueueStopped, setWorkspaceQueueStopped] = useState(false)
  const [workspaceTopicTab, setWorkspaceTopicTab] = useState<WorkspaceTopicTab>('overview')
  const [workspaceUpdatedAt, setWorkspaceUpdatedAt] = useState<string | null>(null)
  const [polyglotLanguage, setPolyglotLanguage] = useState<PolyglotLanguage>('python')
  const [polyglotCode, setPolyglotCode] = useState(POLYGLOT_TEMPLATES.python)
  const [polyglotArgsText, setPolyglotArgsText] = useState('')
  const [polyglotStdin, setPolyglotStdin] = useState('')
  const [polyglotTimeoutMs, setPolyglotTimeoutMs] = useState('20000')
  const [polyglotRuntimes, setPolyglotRuntimes] = useState<PolyglotRuntimeStatus[]>([])
  const [polyglotStatusUpdatedAt, setPolyglotStatusUpdatedAt] = useState<string | null>(null)
  const [polyglotRunning, setPolyglotRunning] = useState(false)
  const [polyglotMessage, setPolyglotMessage] = useState('')
  const [polyglotResult, setPolyglotResult] = useState<PolyglotRunResult | null>(null)
  const [polyglotBrainObjective, setPolyglotBrainObjective] = useState('Strengthen Paxion architecture with the best role for each language.')
  const [polyglotBrainRunning, setPolyglotBrainRunning] = useState(false)
  const [polyglotBrainResult, setPolyglotBrainResult] = useState<PolyglotBrainMeshResult | null>(null)
  const workspaceLoadedRef = useRef(false)
  const workspaceQueuePausedRef = useRef(false)
  const workspaceQueueStoppedRef = useRef(false)

  const activeTabMeta = useMemo(
    () => tabs.find((tab) => tab.id === activeTab) ?? tabs[0],
    [activeTab],
  )
  const policySnapshot = useMemo(() => createPolicySnapshot(), [])
  const providerHealth = useMemo(
    () => deriveProviderHealth(routerConfig.providers),
    [routerConfig.providers],
  )
  const gatewayChannels = useMemo(
    () => [
      {
        id: 'webchat',
        label: 'WebChat',
        status: 'connected' as const,
        detail: 'Browser control UI is active in this runtime.',
      },
      {
        id: 'telegram',
        label: 'Telegram',
        status: capabilities.chatExternalModel ? ('pending' as const) : ('disabled' as const),
        detail: capabilities.chatExternalModel
          ? 'Adapter staged for MVP wiring.'
          : 'Enable chatExternalModel in Access to start setup.',
      },
      {
        id: 'discord',
        label: 'Discord',
        status: capabilities.chatExternalModel ? ('pending' as const) : ('disabled' as const),
        detail: capabilities.chatExternalModel
          ? 'Channel contract prepared for gateway integration.'
          : 'Adapter disabled by capability toggle.',
      },
      {
        id: 'whatsapp',
        label: 'WhatsApp',
        status: capabilities.chatExternalModel ? ('pending' as const) : ('disabled' as const),
        detail: capabilities.chatExternalModel
          ? 'Pairing and allowlist setup queued in next phase.'
          : 'Adapter disabled by capability toggle.',
      },
    ],
    [capabilities.chatExternalModel],
  )
  const controlWorkspaceMissions = useMemo(
    () =>
      crossAppMissions.slice(0, 20).map((mission) => {
        const normalizedStatus: 'planning' | 'ready' | 'executing' | 'completed' | 'failed' =
          mission.status === 'ready' ||
          mission.status === 'executing' ||
          mission.status === 'completed' ||
          mission.status === 'failed'
            ? mission.status
            : 'planning'

        return {
          id: mission.id,
          title: mission.goal,
          description: `Surfaces: ${mission.surfaces.join(', ') || 'unspecified'}`,
          status: normalizedStatus,
          steps: mission.phases.length,
          createdAt: mission.createdAt,
          updatedAt: mission.createdAt,
        }
      }),
    [crossAppMissions],
  )
  const controlTotalWords = useMemo(
    () =>
      libDocs.reduce((sum, doc) => {
        const words = doc.content.trim().split(/\s+/).filter(Boolean).length
        return sum + words
      }, 0),
    [libDocs],
  )
  const selectedPolyglotRuntime = useMemo(
    () => polyglotRuntimes.find((runtime) => runtime.language === polyglotLanguage) ?? null,
    [polyglotLanguage, polyglotRuntimes],
  )
  const isWebRuntime = typeof window !== 'undefined' && !window.paxion
  const currentDeviceProfile = useMemo(
    () =>
      deriveDeviceProfile({
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        isWebRuntime,
      }),
    [isWebRuntime],
  )
  const isMobileDevice = currentDeviceProfile.class === 'mobile' || currentDeviceProfile.class === 'tablet'

  const approvalStore = useMemo(() => new ApprovalStore(), [])
  const auditLedger = useMemo(() => new AuditLedger(), [])
  const brain = useMemo(() => new PaxionBrain(), [])

  useEffect(() => {
    saveModelRouterConfig(routerConfig)
  }, [routerConfig])

  const updateRoutingProfile = useCallback((profile: RoutingProfile) => {
    setRouterConfig((prev) => ({ ...prev, defaultProfile: profile }))
  }, [])

  const updateProviderEnabled = useCallback((id: ModelProviderId, enabled: boolean) => {
    setRouterConfig((prev) => ({
      ...prev,
      providers: prev.providers.map((provider) =>
        provider.id === id ? { ...provider, enabled } : provider,
      ),
    }))
  }, [])

  const updateProviderKey = useCallback((id: ModelProviderId, apiKey: string) => {
    setRouterConfig((prev) => ({
      ...prev,
      providers: prev.providers.map((provider) =>
        provider.id === id ? { ...provider, apiKey } : provider,
      ),
    }))
  }, [])


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

  const loadFeatureFlags = useCallback(async () => {
    if (!window.paxion?.features?.load) {
      setFeatureFlags(defaultFeatureFlags)
      return
    }

    const result = await window.paxion.features.load().catch(() => null)
    if (!result?.ok || !result.flags) {
      return
    }

    setFeatureFlags((prev) => ({
      ...prev,
      desktopAdapterEnabled: Boolean(result.flags.desktopAdapterEnabled),
      cloudRelayEnabled: Boolean(result.flags.cloudRelayEnabled),
      memoryNormalizationEnabled: Boolean(result.flags.memoryNormalizationEnabled),
    }))
  }, [])

  const setFeatureFlag = useCallback(async (patch: Partial<FeatureFlagState>) => {
    if (!window.paxion?.features?.set) {
      setFeatureFlags((prev) => ({ ...prev, ...patch }))
      return
    }

    const result = await window.paxion.features.set(patch).catch(() => null)
    if (!result?.ok || !result.flags) {
      return
    }

    setFeatureFlags({
      desktopAdapterEnabled: Boolean(result.flags.desktopAdapterEnabled),
      cloudRelayEnabled: Boolean(result.flags.cloudRelayEnabled),
      memoryNormalizationEnabled: Boolean(result.flags.memoryNormalizationEnabled),
    })
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

  const refreshPolyglotStatus = useCallback(async () => {
    if (!window.paxion) {
      setPolyglotMessage('Polyglot runtime detection is available only in desktop mode.')
      setPolyglotRuntimes([])
      return
    }

    const result = await window.paxion.polyglot.status().catch(() => null)
    if (!result?.ok) {
      setPolyglotMessage('Failed to detect local runtimes.')
      return
    }

    setPolyglotRuntimes(result.runtimes)
    setPolyglotStatusUpdatedAt(result.updatedAt)
    setPolyglotMessage('Local runtime scan complete.')
  }, [])

  useEffect(() => {
    if (activeTab === 'workspace' && workspaceTopicTab === 'polyglot' && polyglotRuntimes.length === 0) {
      void refreshPolyglotStatus()
    }
  }, [activeTab, workspaceTopicTab, polyglotRuntimes.length, refreshPolyglotStatus])

  const loadReadinessState = useCallback(async () => {
    if (!window.paxion) {
      setTargetPacks([])
      setExecutionSessions([])
      setObservationSnapshots([])
      setCrossAppMissions([])
      setLearningGraph({ nodes: [], edges: [], updatedAt: null })
      setEvolutionPipelines([])
      setVisionJobs([])
      setGraphPage(null)
      setGraphIndexStats(null)
      setAttestationFingerprint('')
      setAttestationLastHash('')
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
      setGraphPage(null)
      setGraphIndexStats(null)
      return
    }

    setTargetPacks(result.targetPacks)
    setExecutionSessions(result.executionSessions)
    setObservationSnapshots(result.observations)
    setCrossAppMissions(result.missions)
    setLearningGraph(result.learningGraph)
    setEvolutionPipelines(result.evolutionPipelines)
    setVisionJobs(result.visionJobs)
    const attestation = await window.paxion.readiness.attestationStatus().catch(() => null)
    if (attestation?.ok) {
      setAttestationFingerprint(attestation.status.publicKeyFingerprint)
      setAttestationLastHash(attestation.status.lastEntryHash)
    }
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
      loadFeatureFlags()
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
  }, [loadAutomationState, loadCapabilities, loadFeatureFlags, loadIntegrationStatus, loadLearningState, loadReadinessState, refreshAdminStatus])

  useEffect(() => {
    if (!adminUnlocked) return
    queueMicrotask(() => {
      loadLearningState()
      loadAutomationState()
      loadReadinessState()
      void loadFeatureFlags()
      void loadVoiceSecretStatus()
      void loadVoiceRuntimeState()
      void loadTerminalPacks()
      void loadBridgeStatus()
      void loadRelayStatus()
      void loadThreatDashboard()
      void loadWeeklyOptimizationStatus()
    })
  }, [adminUnlocked, loadAutomationState, loadFeatureFlags, loadLearningState, loadReadinessState])

  // Restore workspace mission state from persistence.
  useEffect(() => {
    queueMicrotask(() => {
      loadWorkspaceState()
    })
  }, [loadWorkspaceState])

  useEffect(() => {
    const storedMode = localStorage.getItem('paxion-assistant-mode')
    if (storedMode === 'voice' || storedMode === 'chat') {
      setAssistantMode(storedMode)
    }
    const storedWake = localStorage.getItem('paxion-wake-phrase')
    if (storedWake && storedWake.trim()) {
      setWakePhrase(storedWake.trim().toLowerCase())
    }
    const storedName = localStorage.getItem('paxion-chat-user-name')
    if (storedName && storedName.trim()) {
      setChatUserName(storedName.trim())
    }
    const storedTone = localStorage.getItem('paxion-chat-friendly-tone')
    if (storedTone === '1') {
      setChatFriendlyTone(true)
    }

    if (window.paxion?.assistant) {
      void window.paxion.assistant.getRuntime().then((runtime) => {
        if (typeof runtime?.closeToTrayEnabled === 'boolean') {
          setCloseToTrayEnabled(runtime.closeToTrayEnabled)
        }
      }).catch(() => undefined)
    }

    if (window.paxion?.voice?.getProvider) {
      void window.paxion.voice.getProvider().then((providerState) => {
        const provider = providerState?.provider
        if (provider === 'desktop-relay' || provider === 'twilio' || provider === 'sip') {
          setCallProvider(provider)
        }
        if (typeof providerState?.fromNumber === 'string') {
          setCallFromNumber(providerState.fromNumber)
        }
      }).catch(() => undefined)
    }

    void loadVoiceRuntimeState()
    void loadRelayStatus()
    void loadWeeklyOptimizationStatus()
  }, [])

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setPwaInstallEvent(event as BeforeInstallPromptEventLike)
      setPwaInstallMessage('Install Paxion on this device for faster mobile access.')
    }

    const onAppInstalled = () => {
      setPwaInstalled(true)
      setPwaInstallEvent(null)
      setPwaInstallMessage('Paxion has been installed on this device.')
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('paxion-assistant-mode', assistantMode)
  }, [assistantMode])

  useEffect(() => {
    localStorage.setItem('paxion-wake-phrase', wakePhrase)
  }, [wakePhrase])

  useEffect(() => {
    if (!capabilities.voiceInput) {
      voiceLoopEnabledRef.current = false
      setVoiceLoopEnabled(false)
      if (chatVoiceListening) {
        stopVoiceInput()
      }
      return
    }

    if (assistantMode === 'voice') {
      wakeArmedRef.current = true
      voiceLoopEnabledRef.current = true
      setVoiceLoopEnabled(true)
      startVoiceInput(true)
      return
    }

    if (closeToTrayEnabled) {
      wakeArmedRef.current = true
      voiceLoopEnabledRef.current = true
      setVoiceLoopEnabled(true)
      startVoiceInput(true)
      setChatNotice('Background wake listener armed. Say wake phrase to activate voice mode.')
      return
    }

    voiceLoopEnabledRef.current = false
    setVoiceLoopEnabled(false)
    if (chatVoiceListening) {
      stopVoiceInput()
    }
  }, [assistantMode, closeToTrayEnabled, capabilities.voiceInput])

  useEffect(() => {
    if (!adminUnlocked || relayMode !== 'cloud' || !cloudRelayPollingEnabled || !window.paxion?.relay?.sync) {
      return
    }
    const poller = window.setInterval(() => {
      void syncCloudRelayQueue()
    }, 12000)
    return () => {
      window.clearInterval(poller)
    }
  }, [adminUnlocked, relayMode, cloudRelayPollingEnabled])

  useEffect(() => {
    return () => {
      stopPerceptionRuntime()
    }
  }, [])

  async function setCloseToTrayMode(enabled: boolean) {
    setCloseToTrayEnabled(enabled)
    if (!window.paxion?.assistant) {
      return
    }
    const result = await window.paxion.assistant
      .setRuntime({ closeToTrayEnabled: enabled })
      .catch(() => null)
    if (!result) {
      setChatNotice('Failed to update close-to-tray runtime setting.')
      return
    }
    setCloseToTrayEnabled(Boolean(result.closeToTrayEnabled))
  }

  async function loadVoiceSecretStatus() {
    if (!window.paxion?.voice?.getSecrets) {
      return
    }
    const result = await window.paxion.voice.getSecrets().catch(() => null)
    if (!result?.ok) {
      setTwilioSecretStatus(result?.reason || 'Failed to load voice secret status.')
      return
    }
    setCallFromNumber(String(result.twilioFromNumber || ''))
    setSipUri(String(result.sipUri || ''))
    setSipUsername(String(result.sipUsername || ''))
    setTwilioSecretStatus(
      `Twilio SID: ${result.hasTwilioSid ? 'set' : 'missing'} | Token: ${result.hasTwilioToken ? 'set' : 'missing'} | SIP: ${result.hasSipUri ? 'set' : 'missing'}`,
    )
  }

  async function saveVoiceSecrets() {
    if (!window.paxion?.voice?.setSecrets) {
      setTwilioSecretStatus('Voice secret API unavailable in this runtime.')
      return
    }
    const result = await window.paxion.voice
      .setSecrets({
        twilioAccountSid,
        twilioAuthToken,
        twilioFromNumber: callFromNumber,
        sipUri,
        sipUsername,
        sipPassword,
      })
      .catch(() => null)
    if (!result?.ok) {
      setTwilioSecretStatus(result?.reason || 'Failed to save encrypted voice credentials.')
      return
    }
    setTwilioAccountSid('')
    setTwilioAuthToken('')
    setSipPassword('')
    setTwilioSecretStatus('Encrypted credentials saved at rest.')
    await loadVoiceSecretStatus()
  }

  async function loadTerminalPacks() {
    if (!window.paxion?.terminal?.listPacks) {
      return
    }
    const result = await window.paxion.terminal.listPacks().catch(() => null)
    if (!result?.ok) {
      setAccessMessage(result?.reason || 'Failed to load terminal command packs.')
      return
    }
    setTerminalPacks(Array.isArray(result.packs) ? result.packs : [])
  }

  async function createTerminalPack() {
    if (!window.paxion?.terminal?.createPack) {
      return
    }
    const commands = terminalPackCommands
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean)
    if (commands.length === 0) {
      setAccessMessage('Provide at least one command for signed pack creation.')
      return
    }
    const result = await window.paxion.terminal
      .createPack({
        name: terminalPackName || 'Custom signed pack',
        commands,
        active: true,
      })
      .catch(() => null)
    if (!result?.ok) {
      setAccessMessage(result?.reason || 'Failed to create signed terminal pack.')
      return
    }
    setTerminalPackName('')
    setTerminalPackCommands('')
    setAccessMessage('Signed command pack created and activated.')
    await loadTerminalPacks()
  }

  async function setTerminalPackActivation(packId: string, active: boolean) {
    if (!window.paxion?.terminal?.activatePack) {
      return
    }
    const result = await window.paxion.terminal.activatePack({ packId, active }).catch(() => null)
    if (!result?.ok) {
      setAccessMessage(result?.reason || 'Failed to update pack activation.')
      return
    }
    await loadTerminalPacks()
  }

  async function loadBridgeStatus() {
    if (!window.paxion?.bridge?.status) {
      return
    }
    const result = await window.paxion.bridge.status().catch(() => null)
    if (!result?.ok) {
      setBridgeMessage(result?.reason || 'Failed to load bridge status.')
      return
    }
    setBridgeEnabled(Boolean(result.enabled))
    setBridgeHost(String(result.host || '0.0.0.0'))
    setBridgePort(String(result.port || 8731))
    setBridgePendingRequests(Array.isArray(result.pendingRequests) ? result.pendingRequests : [])
    if (result.hasSecret && !bridgeSecret) {
      setBridgeSecret('********')
    }
  }

  async function loadThreatDashboard() {
    if (!window.paxion?.security?.threatDashboard) {
      return
    }
    const result = await window.paxion.security.threatDashboard().catch(() => null)
    if (!result?.ok) {
      return
    }
    setThreatDashboard(result.dashboard || null)
  }

  async function loadVoiceRuntimeState() {
    if (window.paxion?.voiceQuality?.status) {
      const result = await window.paxion.voiceQuality.status().catch(() => null)
      const profile = result?.state?.profile as Partial<VoiceRuntimeProfile> | undefined
      setVoiceProfile({
        duplexEnabled: Boolean(profile?.duplexEnabled ?? true),
        interruptionHandling: String(profile?.interruptionHandling || 'barge-in'),
        personaMemory: String(profile?.personaMemory || 'friendly-technical'),
        prosody: String(profile?.prosody || 'balanced'),
      })
    }

    if (window.paxion?.wakeword?.status) {
      const result = await window.paxion.wakeword.status().catch(() => null)
      const status = (result?.status || {}) as Partial<WakewordRuntimeStatus>
      setWakewordStatus({
        provider: String(status.provider || 'browser-fallback'),
        executablePath: String(status.executablePath || ''),
        executablePresent: Boolean(status.executablePresent),
        modelPath: String(status.modelPath || ''),
        modelPresent: Boolean(status.modelPresent),
        accessKeyConfigured: Boolean(status.accessKeyConfigured),
        alwaysOn: Boolean(status.alwaysOn),
        sensitivity: Number(status.sensitivity || 0.55),
        detectionMode: String(status.detectionMode || 'keyword-spotting'),
        keyword: String(status.keyword || 'paxion wakeup'),
        status: String(status.status || 'not-configured'),
        estimatedLatencyMs: Number(status.estimatedLatencyMs || 450),
        updatedAt: typeof status.updatedAt === 'string' ? status.updatedAt : null,
      })
    }
  }

  async function saveVoiceRuntimeProfile() {
    if (!window.paxion?.voiceQuality?.update) {
      setVoiceRuntimeMessage('Voice quality API unavailable in this runtime.')
      return
    }
    const result = await window.paxion.voiceQuality
      .update({
        duplexEnabled: voiceProfile.duplexEnabled,
        interruptionHandling: voiceProfile.interruptionHandling,
        personaMemory: voiceProfile.personaMemory,
        prosody: voiceProfile.prosody,
      })
      .catch(() => null)
    if (!result?.ok) {
      setVoiceRuntimeMessage(result?.reason || 'Failed to save voice quality profile.')
      return
    }
    setVoiceRuntimeMessage('Voice quality profile saved.')
    await loadVoiceRuntimeState()
  }

  async function saveWakewordRuntime() {
    if (!window.paxion?.wakeword?.configure) {
      setVoiceRuntimeMessage('Wake-word API unavailable in this runtime.')
      return
    }
    const result = await window.paxion.wakeword
      .configure({
        provider: wakewordStatus.provider,
        keyword: wakePhrase,
        executablePath: wakewordStatus.executablePath,
        modelPath: wakewordStatus.modelPath,
        accessKey: wakewordAccessKey,
        sensitivity: wakewordStatus.sensitivity,
        alwaysOn: closeToTrayEnabled || assistantMode === 'voice',
        detectionMode: wakewordStatus.detectionMode,
      })
      .catch(() => null)
    if (!result?.ok) {
      setVoiceRuntimeMessage(result?.reason || 'Failed to save wake-word runtime.')
      return
    }
    setWakewordAccessKey('')
    setVoiceRuntimeMessage('Wake-word runtime updated.')
    await loadVoiceRuntimeState()
  }

  async function loadRelayStatus() {
    if (!window.paxion?.relay?.status) {
      return
    }
    const result = await window.paxion.relay.status().catch(() => null)
    if (!result?.ok) {
      setCloudRelayMessage(result?.reason || 'Failed to load cloud relay state.')
      return
    }
    const relay = (result.relay || {}) as Record<string, unknown>
    const config = (relay.config || {}) as Record<string, unknown>
    setRelayMode(String(config.mode || 'disabled'))
    setCloudRelayEndpoint(String(config.endpoint || ''))
    setCloudRelayDeviceId(String(config.deviceId || 'paxion-primary'))
    setCloudRelayPollingEnabled(Boolean(config.pollingEnabled))
    setCloudRelayTokenConfigured(Boolean(config.tokenConfigured))
    setCloudRelayRequests(Array.isArray(relay.requests) ? (relay.requests as Array<Record<string, unknown>>) : [])
    setCloudRelayLastSyncAt(typeof relay.lastCloudSyncAt === 'string' ? relay.lastCloudSyncAt : null)
  }

  async function loadWeeklyOptimizationStatus() {
    if (!window.paxion?.optimization?.status) {
      return
    }
    const result = await window.paxion.optimization.status().catch(() => null)
    if (!result?.ok) {
      setWeeklyOptimizationMessage(result?.reason || 'Failed to load weekly optimization status.')
      return
    }
    const optimization = (result.optimization || {}) as Record<string, unknown>
    setWeeklyOptimizationAutoTune(optimization.autoTune !== false)
    const reports = Array.isArray(optimization.reports) ? optimization.reports : []
    const latest = reports.length > 0 ? reports[reports.length - 1] : null
    setWeeklyOptimizationReport((latest || null) as Record<string, unknown> | null)
  }

  async function runWeeklyOptimization() {
    if (!window.paxion?.optimization?.run) {
      setWeeklyOptimizationMessage('Weekly optimization is unavailable in this runtime.')
      return
    }
    const result = await window.paxion.optimization
      .run({
        autoTune: weeklyOptimizationAutoTune,
      })
      .catch(() => null)
    if (!result?.ok) {
      setWeeklyOptimizationMessage(result?.reason || 'Failed to run weekly optimization.')
      return
    }
    setWeeklyOptimizationMessage('Weekly optimization completed successfully.')
    setWeeklyOptimizationReport((result.report || null) as Record<string, unknown> | null)
    await loadVoiceRuntimeState()
    await loadRelayStatus()
  }

  async function saveCloudRelayConfig() {
    if (!window.paxion?.relay?.configure) {
      setCloudRelayMessage('Cloud relay API unavailable in this runtime.')
      return
    }
    const result = await window.paxion.relay
      .configure({
        mode: relayMode,
        endpoint: cloudRelayEndpoint,
        deviceId: cloudRelayDeviceId,
        pollingEnabled: cloudRelayPollingEnabled,
        token: cloudRelayToken,
      })
      .catch(() => null)
    if (!result?.ok) {
      setCloudRelayMessage(result?.reason || 'Failed to save cloud relay configuration.')
      return
    }
    setCloudRelayToken('')
    setCloudRelayMessage('Cloud relay configuration saved.')
    await loadRelayStatus()
  }

  async function syncCloudRelayQueue() {
    if (!window.paxion?.relay?.sync) {
      setCloudRelayMessage('Cloud relay sync is unavailable in this runtime.')
      return
    }
    const result = await window.paxion.relay.sync().catch(() => null)
    if (!result?.ok) {
      setCloudRelayMessage(result?.reason || 'Failed to sync cloud relay queue.')
      return
    }
    setCloudRelayMessage('Cloud relay queue synced.')
    await loadRelayStatus()
  }

  async function submitCloudRelayPing() {
    if (!window.paxion?.relay?.submit) {
      setCloudRelayMessage('Cloud relay submit is unavailable in this runtime.')
      return
    }
    const result = await window.paxion.relay
      .submit({
        request: {
          actionId: 'assistant.remoteHeartbeat',
          detail: 'Connectivity probe from Paxion desktop runtime.',
          deviceId: cloudRelayDeviceId,
          requestedAt: new Date().toISOString(),
        },
      })
      .catch(() => null)
    if (!result?.ok) {
      setCloudRelayMessage(result?.reason || 'Failed to submit cloud relay request.')
      return
    }
    setCloudRelayMessage('Cloud relay heartbeat request submitted.')
    await loadRelayStatus()
  }

  async function completeCloudRelayRequest(requestId: string) {
    if (!window.paxion?.relay?.complete) {
      return
    }
    const result = await window.paxion.relay
      .complete({
        requestId,
        state: 'completed',
        result: {
          completedAt: new Date().toISOString(),
          deviceId: cloudRelayDeviceId,
          runtime: 'desktop',
        },
      })
      .catch(() => null)
    if (!result?.ok) {
      setCloudRelayMessage(result?.reason || 'Failed to complete cloud relay request.')
      return
    }
    setCloudRelayMessage(`Cloud relay request ${requestId} completed.`)
    await loadRelayStatus()
  }

  function parsePerceptionLabels() {
    return perceptionLabelHints
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  async function capturePerceptionFrame(realtime = false) {
    if (!window.paxion?.perception?.groundFrame) {
      setPerceptionMessage('Perception runtime is only available in Electron.')
      return
    }
    const video = perceptionVideoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) {
      setPerceptionMessage('Camera stream is not ready yet.')
      return
    }
    const labels = parsePerceptionLabels()
    const summary = `Live frame ${new Date().toLocaleTimeString()} at ${video.videoWidth}x${video.videoHeight}${labels.length ? ` with focus on ${labels.join(', ')}` : ''}.`
    const frameResult = await window.paxion.perception
      .groundFrame({
        frameId: `frame-${Date.now().toString(36)}`,
        summary,
        confidence: realtime ? 0.72 : 0.8,
        realtime,
        labels,
        width: video.videoWidth,
        height: video.videoHeight,
        source: 'browser-camera',
      })
      .catch(() => null)
    if (!frameResult?.ok) {
      setPerceptionMessage(frameResult?.reason || 'Failed to ground perception frame.')
      return
    }
    const frame = (frameResult.frame || {}) as Record<string, unknown>
    setPerceptionFrames((prev) => [frame, ...prev].slice(0, 6))
    setPerceptionSummary(String(frame.summary || summary))

    if (window.paxion?.perception?.sceneGraph && labels.length > 0) {
      const relations = labels.length > 1 ? labels.slice(1).map((label) => `${labels[0]}-near-${label}`) : [`${labels[0]}-visible`]
      const sceneResult = await window.paxion.perception
        .sceneGraph({
          objects: labels,
          relations,
          grounding: 'browser-camera-runtime',
        })
        .catch(() => null)
      if (sceneResult?.ok) {
        setPerceptionSceneGraph((sceneResult.sceneGraph || null) as Record<string, unknown> | null)
      }
    }

    setPerceptionMessage(realtime ? 'Realtime perception frame updated.' : 'Perception snapshot captured.')
  }

  async function startPerceptionRuntime() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPerceptionMessage('Camera access is not available in this runtime.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      perceptionStreamRef.current = stream
      const video = perceptionVideoRef.current
      if (video) {
        video.srcObject = stream
        await video.play().catch(() => undefined)
      }
      if (perceptionIntervalRef.current) {
        window.clearInterval(perceptionIntervalRef.current)
      }
      perceptionIntervalRef.current = window.setInterval(() => {
        void capturePerceptionFrame(true)
      }, 2500)
      setPerceptionEnabled(true)
      setPerceptionMessage('Realtime perception runtime started.')
      void capturePerceptionFrame(true)
    } catch {
      setPerceptionMessage('Failed to start realtime perception runtime.')
    }
  }

  function stopPerceptionRuntime() {
    if (perceptionIntervalRef.current) {
      window.clearInterval(perceptionIntervalRef.current)
      perceptionIntervalRef.current = null
    }
    const stream = perceptionStreamRef.current
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      perceptionStreamRef.current = null
    }
    const video = perceptionVideoRef.current
    if (video) {
      video.srcObject = null
    }
    setPerceptionEnabled(false)
    setPerceptionMessage('Realtime perception runtime stopped.')
  }

  async function simulateTerminalPack() {
    if (!window.paxion?.terminal?.simulatePack) {
      return
    }
    const commands = terminalPackCommands
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean)
    const result = await window.paxion.terminal.simulatePack({ commands }).catch(() => null)
    if (!result?.ok) {
      setAccessMessage(result?.reason || 'Failed to simulate command pack policy.')
      return
    }
    setTerminalPackSimulation(result.simulation || null)
  }

  async function rotateBridgeSecret() {
    if (!window.paxion?.bridge?.rotateSecret) {
      return
    }
    const result = await window.paxion.bridge.rotateSecret().catch(() => null)
    if (!result?.ok) {
      setBridgeMessage(result?.reason || 'Failed to rotate bridge secret.')
      return
    }
    setBridgeSecret(String(result.secret || ''))
    setBridgeMessage('Bridge secret rotated.')
    await loadBridgeStatus()
  }

  async function issueBridgeOneTimeToken() {
    if (!window.paxion?.bridge?.issueToken) {
      return
    }
    const result = await window.paxion.bridge.issueToken({ purpose: 'remote-command', ttlMs: 120000 }).catch(() => null)
    if (!result?.ok) {
      setBridgeMessage(result?.reason || 'Failed to issue one-time token.')
      return
    }
    setBridgeOneTimeToken(String((result.token as Record<string, unknown> | undefined)?.token || ''))
    setBridgeMessage('One-time bridge token issued.')
  }

  async function startMobileBridge() {
    if (!window.paxion?.bridge?.start) {
      setBridgeMessage('Bridge API unavailable in this runtime.')
      return
    }
    const result = await window.paxion.bridge
      .start({
        host: bridgeHost,
        port: Number(bridgePort || 8731),
        secret: bridgeSecret === '********' ? '' : bridgeSecret,
      })
      .catch(() => null)
    if (!result?.ok) {
      setBridgeMessage(result?.reason || 'Failed to start mobile bridge.')
      return
    }
    setBridgeEnabled(Boolean(result.enabled))
    setBridgeSecret(String(result.secret || bridgeSecret || ''))
    setBridgeMessage(`Bridge started on ${result.host}:${result.port}.`)
    await loadBridgeStatus()
  }

  async function stopMobileBridge() {
    if (!window.paxion?.bridge?.stop) {
      return
    }
    const result = await window.paxion.bridge.stop().catch(() => null)
    if (!result?.ok) {
      setBridgeMessage(result?.reason || 'Failed to stop mobile bridge.')
      return
    }
    setBridgeEnabled(false)
    setBridgeMessage('Bridge stopped.')
    await loadBridgeStatus()
  }

  async function decideBridgeRequest(requestId: string, approved: boolean) {
    if (!window.paxion?.bridge?.approve) {
      return
    }
    const result = await window.paxion.bridge
      .approve({
        requestId,
        approved,
        adminCodeword,
      })
      .catch(() => null)
    if (!result?.ok) {
      setBridgeMessage(result?.reason || 'Failed to process bridge request.')
      return
    }
    setBridgeMessage(`Bridge request ${requestId} ${approved ? 'approved' : 'rejected'}.`)
    await loadBridgeStatus()
  }

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
  const selectedActionRequest = useMemo<ActionRequest>(
    () => ({
      actionId: selectedAction.id,
      category: selectedAction.category,
      targetPath,
      detail: actionDetail,
    }),
    [actionDetail, selectedAction.category, selectedAction.id, targetPath],
  )
  const activeRouteDecision = useMemo(
    () =>
      routeActionRequest(selectedActionRequest, currentDeviceProfile, {
        cloudRelayEnabled: featureFlags.cloudRelayEnabled,
        desktopAdapterEnabled: featureFlags.desktopAdapterEnabled,
        emergencyCallRelayEnabled: capabilities.emergencyCallRelay,
      }),
    [capabilities.emergencyCallRelay, currentDeviceProfile, featureFlags.cloudRelayEnabled, featureFlags.desktopAdapterEnabled, selectedActionRequest],
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
    const speakRate = 1.0  // default; voice quality profile uses voiceProfile.prosody for pitch
    utterance.rate = speakRate
    utterance.pitch =
      voiceProfile.prosody === 'calm' ? 0.85
      : voiceProfile.prosody === 'energetic' ? 1.15
      : voiceProfile.prosody === 'emphatic' ? 1.05
      : 1.0
    utterance.lang = 'en-US'
    // Persona-based voice selection (best-effort browser API)
    const availableVoices = window.speechSynthesis.getVoices()
    if (availableVoices.length > 0) {
      const personaKeyword =
        voiceProfile.personaMemory === 'formal' ? 'david'
        : voiceProfile.personaMemory === 'casual' ? 'zira'
        : voiceProfile.personaMemory === 'warm' ? 'hazel'
        : 'google'
      const matched = availableVoices.find((v) =>
        v.lang.startsWith('en') && v.name.toLowerCase().includes(personaKeyword)
      )
      if (matched) utterance.voice = matched
    }
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

  async function installPaxionWebApp() {
    if (!pwaInstallEvent) {
      setPwaInstallMessage('Open the browser menu and use Add to Home Screen / Install App.')
      return
    }
    await pwaInstallEvent.prompt().catch(() => undefined)
    const choice = await pwaInstallEvent.userChoice.catch(() => null)
    if (choice?.outcome === 'accepted') {
      setPwaInstalled(true)
      setPwaInstallEvent(null)
      setPwaInstallMessage('Paxion install accepted.')
      return
    }
    setPwaInstallMessage('Install was dismissed. You can try again anytime.')
  }

  async function relayVoiceCall(commandText: string) {
    if (!window.paxion?.voice) {
      setChatNotice('Voice call relay is only available in Electron runtime.')
      return
    }

    if (!capabilities.emergencyCallRelay) {
      setChatNotice('Emergency call relay is disabled in Access tab.')
      return
    }

    const emergency = /\bemergency\b|\bhelp\b|\bsos\b/i.test(commandText)
    const match = commandText.match(/\bcall\s+(.+)$/i)
    const targetRaw = String(match?.[1] || '').trim()
    const phoneLike = targetRaw.replace(/[^0-9+]/g, '')
    const payload = phoneLike
      ? { number: phoneLike, emergency }
      : { contact: targetRaw, emergency }

    const result = await window.paxion.voice.call({
      ...payload,
      provider: callProvider,
      fromNumber: callFromNumber,
      message: emergency ? 'Emergency call initiated by Paxion voice runtime.' : 'Paxion initiated a voice command call.',
    }).catch(() => null)
    if (!result?.ok) {
      setChatNotice(result?.reason ?? 'Voice call relay failed.')
      return
    }

    setChatMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}-a-call`,
        role: 'assistant',
        content: result.reason || 'Call relay opened.',
        timestamp: new Date().toISOString(),
        contextDocs: [],
        reasoningSteps: ['Voice call command routed to desktop call relay adapter.'],
        confidence: 'high',
      },
    ])
  }

  function compactKnowledgeForPrompt(maxChars = 3600): string {
    const merged = libDocs
      .slice(0, 8)
      .map((doc) => `${doc.name}: ${doc.content.slice(0, 420)}`)
      .join('\n')
    return merged.slice(0, maxChars)
  }

  async function runAdvancedVoiceCommand(commandText: string): Promise<boolean> {
    const text = String(commandText || '').trim()
    if (!text || !window.paxion) {
      return false
    }

    if (/\bcheck\s+nmap\b|\bnmap\s+version\b/i.test(text) && window.paxion.terminal?.run) {
      const runResult = await window.paxion.terminal.run({ command: 'nmap --version' }).catch(() => null)
      setChatMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-a-nmap`,
          role: 'assistant',
          content: runResult?.ok
            ? 'Nmap check completed via terminal execution.'
            : `Nmap check blocked: ${runResult?.reason || 'unknown reason'}`,
          timestamp: new Date().toISOString(),
          contextDocs: [],
          reasoningSteps: ['Mapped natural nmap check command to guarded terminal execution path.'],
          confidence: runResult?.ok ? 'high' : 'medium',
        },
      ])
      return true
    }

    const terminalMatch = text.match(/^(run\s+terminal|terminal\s+run|terminal)\s+(.+)$/i)
    if (terminalMatch?.[2] && window.paxion.terminal?.run) {
      const command = terminalMatch[2].trim()
      const runResult = await window.paxion.terminal.run({ command }).catch(() => null)
      setChatMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-a-terminal`,
          role: 'assistant',
          content: runResult?.ok
            ? `Terminal command executed: ${command}`
            : `Terminal command blocked: ${runResult?.reason || 'unknown reason'}`,
          timestamp: new Date().toISOString(),
          contextDocs: [],
          reasoningSteps: ['Voice command mapped to terminal execution engine with policy gate.'],
          confidence: runResult?.ok ? 'high' : 'medium',
        },
      ])
      return true
    }

    const workflowMatch = text.match(/^(make|create|generate)\s+(ai\s+)?workflow\s*(for)?\s*(.+)?$/i)
    if (workflowMatch && window.paxion.workflow?.generate) {
      const goal = String(workflowMatch[4] || text).trim() || text
      const result = await window.paxion.workflow
        .generate({
          goal,
          knowledgeText: compactKnowledgeForPrompt(),
        })
        .catch(() => null)

      const stepsCount = Array.isArray(result?.workflow?.steps) ? result.workflow.steps.length : 0
      setChatMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-a-workflow`,
          role: 'assistant',
          content: result?.ok
            ? `AI workflow generated for: ${goal}. Planned ${stepsCount} step(s).`
            : `Workflow generation failed: ${result?.reason || 'unknown reason'}`,
          timestamp: new Date().toISOString(),
          contextDocs: [],
          reasoningSteps: ['Voice command mapped to workflow synthesis engine.'],
          confidence: result?.ok ? 'high' : 'medium',
        },
      ])
      return true
    }

    const creativeMatch = text.match(/^(creative|ideate|brainstorm|research\s+idea)\s*(for)?\s*(.+)?$/i)
    if (creativeMatch && window.paxion.creative?.ideate) {
      const objective = String(creativeMatch[3] || text).trim() || text
      const result = await window.paxion.creative
        .ideate({
          domain: 'general',
          objective,
          knowledgeText: compactKnowledgeForPrompt(),
        })
        .catch(() => null)

      const ideasCount = Array.isArray(result?.lab?.hypotheses) ? result.lab.hypotheses.length : 0
      setChatMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-a-creative`,
          role: 'assistant',
          content: result?.ok
            ? `Creative lab generated ${ideasCount} hypothesis candidate(s) for: ${objective}.`
            : `Creative ideation failed: ${result?.reason || 'unknown reason'}`,
          timestamp: new Date().toISOString(),
          contextDocs: [],
          reasoningSteps: ['Voice command mapped to creative research ideation engine.'],
          confidence: result?.ok ? 'high' : 'medium',
        },
      ])
      return true
    }

    return false
  }

  async function handleVoiceTranscript(transcriptInput: string) {
    const transcript = String(transcriptInput || '').trim()
    if (!transcript) {
      return
    }

    const wake = wakePhrase.trim().toLowerCase()
    const lower = transcript.toLowerCase()
    const hasWake = wake && lower.includes(wake)

    if (assistantMode === 'voice') {
      if (wakeArmedRef.current && !hasWake) {
        return
      }

      if (hasWake) {
        wakeArmedRef.current = false
        setChatNotice('Wake phrase accepted. Listening for your command...')
      }

      const commandText = hasWake ? transcript.slice(lower.indexOf(wake) + wake.length).trim() : transcript
      if (!commandText) {
        return
      }

      if (voiceCommandInFlightRef.current || chatLoading) {
        setChatNotice('Voice command queued. Waiting for current task...')
        return
      }

      voiceCommandInFlightRef.current = true
      try {
        if (/\b(stop listening|sleep mode|go to chat mode|disable voice mode)\b/i.test(commandText)) {
          setAssistantMode('chat')
          voiceLoopEnabledRef.current = false
          setVoiceLoopEnabled(false)
          stopVoiceInput()
          setChatNotice('Voice mode disabled. Back to chat mode.')
          return
        }

        if (/\bcall\b/i.test(commandText)) {
          await relayVoiceCall(commandText)
        } else {
          const handled = await runAdvancedVoiceCommand(commandText)
          if (!handled) {
            await sendChatMessage(commandText)
          }
        }
      } finally {
        voiceCommandInFlightRef.current = false
        wakeArmedRef.current = true
      }
      return
    }

    if (hasWake) {
      setAssistantMode('voice')
      const commandText = transcript.slice(lower.indexOf(wake) + wake.length).trim()
      setChatNotice('Wake phrase accepted. Voice mode activated.')
      if (commandText) {
        if (voiceCommandInFlightRef.current || chatLoading) {
          return
        }
        voiceCommandInFlightRef.current = true
        try {
          if (/\bcall\b/i.test(commandText)) {
            await relayVoiceCall(commandText)
          } else {
            const handled = await runAdvancedVoiceCommand(commandText)
            if (!handled) {
              await sendChatMessage(commandText)
            }
          }
        } finally {
          voiceCommandInFlightRef.current = false
        }
      }
      return
    }

    setChatInput((prev) => (prev ? `${prev} ${transcript}` : transcript))
    setChatNotice('Voice captured.')
  }

  function startVoiceInput(commandLoop = false) {
    if (chatVoicePending === 'starting' || chatVoiceListening) {
      return
    }

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
      recognition.continuous = commandLoop
      recognition.interimResults = false

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        const results = Array.isArray(event?.results) ? event.results : []
        const lastResult = results.length > 0 ? results[results.length - 1] : null
        const transcript = String((lastResult as unknown as Array<{ transcript?: string }>)?.[0]?.transcript || '').trim()
        void handleVoiceTranscript(transcript)
      }

      recognition.onend = () => {
        setChatVoiceListening(false)
        setChatVoicePending('idle')
        if (suppressVoiceAutoRestartRef.current) {
          suppressVoiceAutoRestartRef.current = false
          return
        }
        if (voiceLoopEnabledRef.current) {
          window.setTimeout(() => {
            if (voiceLoopEnabledRef.current) {
              startVoiceInput(true)
            }
          }, 180)
        }
      }

      recognition.onerror = () => {
        setChatVoiceListening(false)
        setChatVoicePending('idle')
        if (suppressVoiceAutoRestartRef.current) {
          suppressVoiceAutoRestartRef.current = false
          return
        }
        if (voiceLoopEnabledRef.current) {
          window.setTimeout(() => {
            if (voiceLoopEnabledRef.current) {
              startVoiceInput(true)
            }
          }, 450)
        }
      }

      speechRecognitionRef.current = recognition
    }

    speechRecognitionRef.current.continuous = commandLoop
    try {
      setChatVoicePending('starting')
      speechRecognitionRef.current.start()
      setChatVoiceListening(true)
      setChatVoicePending('idle')
      setChatNotice(commandLoop ? 'Voice mode active. Say wake phrase and command.' : 'Listening...')
    } catch {
      setChatVoicePending('idle')
      // Ignore duplicate start attempts from rapid onend/onerror restarts.
    }
  }

  function stopVoiceInput() {
    if (!speechRecognitionRef.current) return
    suppressVoiceAutoRestartRef.current = true
    voiceLoopEnabledRef.current = false
    setVoiceLoopEnabled(false)
    setChatVoicePending('stopping')
    speechRecognitionRef.current.stop()
    setChatVoiceListening(false)
    setChatVoicePending('idle')
    setChatNotice('Voice input stopped.')
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

  function buildConceptDistillation(title: string, content: string): string | null {
    const normalized = content.replace(/\s+/g, ' ').trim()
    if (normalized.length < 320) {
      return null
    }

    const stop = new Set([
      'the', 'and', 'for', 'that', 'with', 'this', 'from', 'have', 'were', 'what', 'when', 'where',
      'which', 'their', 'there', 'about', 'into', 'would', 'could', 'should', 'also', 'than',
      'your', 'they', 'them', 'then', 'been', 'being', 'will', 'just', 'some', 'more', 'very',
      'much', 'only', 'because', 'while', 'after', 'before', 'under', 'over', 'each', 'same',
    ])

    const words = normalized
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stop.has(w))

    const frequency = new Map<string, number>()
    for (const word of words) {
      frequency.set(word, (frequency.get(word) ?? 0) + 1)
    }

    const topKeywords = [...frequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([w]) => w)

    const sentences = normalized
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 50)

    const scored = sentences
      .map((sentence) => {
        const low = sentence.toLowerCase()
        const score = topKeywords.reduce((acc, kw) => acc + (low.includes(kw) ? 1 : 0), 0)
        return { sentence, score }
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    if (scored.length === 0) {
      return null
    }

    const highlights = scored
      .map((item) => `- ${item.sentence.replace(/\s+/g, ' ').slice(0, 220)}${item.sentence.length > 220 ? '...' : ''}`)
      .join('\n')

    const concepts = topKeywords.slice(0, 6).map((k) => `- ${k}`).join('\n')

    return [
      `Concept Distillation: ${title}`,
      '',
      'Primary concepts:',
      concepts,
      '',
      'Core understanding (concept-level):',
      highlights,
      '',
      'Answering policy:',
      '- Explain concepts first in simple language.',
      '- Use raw evidence only when user asks for trace/citation.',
      '- If confidence is low, ask for more targeted source material.',
    ].join('\n')
  }

  function buildBrainKnowledgeProfile(): string | null {
    const docs = libraryStore.getAll().filter((doc) => doc.name !== BRAIN_PROFILE_DOC_NAME)
    if (docs.length === 0) {
      return null
    }

    const totalWordCount = docs.reduce((acc, doc) => acc + doc.wordCount, 0)
    const sourceCounts = docs.reduce(
      (acc, doc) => {
        if (doc.source === 'file') {
          acc.file += 1
        } else {
          acc.paste += 1
        }
        return acc
      },
      { file: 0, paste: 0 },
    )

    const stopWords = new Set([
      'the', 'and', 'for', 'that', 'with', 'this', 'from', 'have', 'were', 'what', 'when', 'where',
      'which', 'their', 'there', 'about', 'into', 'would', 'could', 'should', 'also', 'than',
      'your', 'they', 'them', 'then', 'been', 'being', 'will', 'just', 'some', 'more', 'very',
      'much', 'only', 'because', 'while', 'after', 'before', 'under', 'over', 'each', 'same',
      'using', 'used', 'make', 'made', 'into', 'across', 'between', 'other', 'these', 'those',
      'such', 'through', 'within', 'without', 'need', 'needs', 'like', 'than',
    ])

    const frequencies = new Map<string, number>()
    for (const doc of docs) {
      const words = doc.content
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 3 && !stopWords.has(word))
      for (const word of words) {
        frequencies.set(word, (frequencies.get(word) ?? 0) + 1)
      }
    }

    const topConcepts = [...frequencies.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word, count]) => `- ${word}: ${count}`)
      .join('\n')

    const newestDocs = docs
      .slice()
      .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
      .slice(0, 12)
      .map((doc) => `- ${doc.name} (${doc.wordCount.toLocaleString()} words)`)
      .join('\n')

    return [
      'Brain Memory Profile',
      `Updated: ${new Date().toISOString()}`,
      '',
      'Knowledge growth:',
      `- Source documents consumed: ${docs.length}`,
      `- Total words absorbed: ${totalWordCount.toLocaleString()}`,
      `- Added from files: ${sourceCounts.file}`,
      `- Added from web/paste pipelines: ${sourceCounts.paste}`,
      '',
      'Top learned concepts:',
      topConcepts || '- (insufficient data yet)',
      '',
      'Most recent absorbed documents:',
      newestDocs || '- (none)',
      '',
      'Runtime behavior:',
      '- Treat this profile as rolling memory and update it whenever new knowledge is ingested or removed.',
      '- Prioritize concept-level synthesis with confidence calibration from source evidence.',
    ].join('\n')
  }

  function syncBrainKnowledgeProfile(options?: { updateState?: boolean }) {
    const profile = buildBrainKnowledgeProfile()
    const existing = libraryStore.getAll().find((doc) => doc.name === BRAIN_PROFILE_DOC_NAME)

    if (!profile) {
      if (existing) {
        libraryStore.remove(existing.id)
      }
      if (options?.updateState !== false) {
        setLibDocs(libraryStore.getAll())
      }
      return
    }

    if (existing) {
      libraryStore.remove(existing.id)
    }
    libraryStore.add(BRAIN_PROFILE_DOC_NAME, profile, 'paste')

    if (options?.updateState !== false) {
      setLibDocs(libraryStore.getAll())
    }
  }

  function ingestLibraryKnowledge(
    name: string,
    content: string,
    source: LibraryDocument['source'],
    options?: { distill?: boolean; updateState?: boolean; syncBrain?: boolean },
  ) {
    libraryStore.add(name, content, source)

    const isBrainProfileDoc = name.trim().toLowerCase() === BRAIN_PROFILE_DOC_NAME.toLowerCase()
    const shouldDistill = options?.distill !== false && !isBrainProfileDoc
    if (shouldDistill) {
      const distilled = buildConceptDistillation(name, content)
      if (distilled) {
        const conceptName = `[Concept] ${name}`
        const exists = libraryStore
          .getAll()
          .some((doc) => doc.name.toLowerCase() === conceptName.toLowerCase())
        if (!exists) {
          libraryStore.add(conceptName, distilled, 'paste')
        }
      }
    }

    if (options?.syncBrain !== false) {
      syncBrainKnowledgeProfile({ updateState: false })
    }

    if (options?.updateState !== false) {
      setLibDocs(libraryStore.getAll())
    }
  }

  async function integrateAllKnowledgePacks() {
    const existingNames = new Set(libraryStore.getAll().map((doc) => doc.name.toLowerCase()))
    let imported = 0

    for (const pack of FOUNDATION_KNOWLEDGE_PACKS) {
      const normalizedName = pack.name.toLowerCase()
      if (existingNames.has(normalizedName)) {
        continue
      }

      ingestLibraryKnowledge(pack.name, pack.content, 'paste', { updateState: false, syncBrain: false })
      existingNames.add(normalizedName)
      imported += 1
    }

    syncBrainKnowledgeProfile({ updateState: false })
    setLibDocs(libraryStore.getAll())

    if (imported === 0) {
      setFoundationKnowledgeMessage('All built-in knowledge packs are already integrated.')
      return
    }

    await recordLearning({
      title: 'All built-in knowledge packs integrated',
      detail: `Integrated ${imported} built-in knowledge packs for stronger baseline reasoning.`,
      source: 'foundation-knowledge',
      newSkills: ['General Reasoning', 'Cross-Domain Knowledge', 'Broad Baseline Context'],
    })

    setFoundationKnowledgeMessage(`Integrated ${imported} built-in knowledge packs into Library.`)
  }

  async function handleAddByFile() {
    if (!window.paxion) return
    setLibAddError('')
    const result = await window.paxion.library.pickFile()
    if (!result) return
    if ('error' in result) {
      setLibAddError(result.error)
      return
    }
    ingestLibraryKnowledge(result.name, result.content, 'file')
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

  async function handleIngestFromWebUrl() {
    if (!window.paxion) {
      setWebIngestMessage('Website ingestion is available only in desktop mode.')
      return
    }

    if (!webIngestUrl.trim()) {
      setWebIngestMessage('Enter a website URL first.')
      return
    }

    setWebIngestLoading(true)
    setWebIngestMessage('Fetching and extracting website text...')

    const result = await window.paxion.library
      .ingestWebUrl({ url: webIngestUrl.trim() })
      .catch(() => null)

    if (!result?.ok || !result.content || !result.name) {
      setWebIngestLoading(false)
      setWebIngestMessage(result?.reason ?? 'Website ingestion failed.')
      return
    }

    ingestLibraryKnowledge(result.name, result.content, 'paste')
    setWebIngestLoading(false)
    setWebIngestUrl('')
    setWebIngestMessage(`Imported: ${result.name}`)

    const newSkills = inferSkills(`${result.name}\n${result.content}`)
    await recordLearning({
      title: `Knowledge ingested from web: ${result.name}`,
      detail:
        newSkills.length > 0
          ? `Acquired ${newSkills.length} skill signal(s) from website ingestion.`
          : 'Ingested website content into local knowledge library.',
      source: 'library-web',
      newSkills,
    })
  }

  async function handleAutoKnowledgeBootstrap() {
    if (!window.paxion) {
      setKnowledgeBootstrapMessage('Auto bootstrap is available only in desktop mode.')
      return
    }

    setKnowledgeBootstrapLoading(true)
    setKnowledgeBootstrapMessage('Ingesting Google + GitHub knowledge packs...')

    const existingNames = new Set(libraryStore.getAll().map((doc) => doc.name.toLowerCase()))
    let imported = 0
    let skipped = 0
    let failed = 0

    for (const source of KNOWLEDGE_BOOTSTRAP_SOURCES) {
      const result = await window.paxion.library.ingestWebUrl({ url: source.url }).catch(() => null)
      if (!result?.ok || !result.content) {
        failed += 1
        continue
      }

      const bootstrapName = `[Bootstrap:${source.type}] ${source.name}`
      const normalizedName = bootstrapName.toLowerCase()
      if (existingNames.has(normalizedName)) {
        skipped += 1
        continue
      }

      ingestLibraryKnowledge(bootstrapName, result.content, 'paste', { updateState: false, syncBrain: false })
      existingNames.add(normalizedName)
      imported += 1
      await sleep(60)
    }

    syncBrainKnowledgeProfile({ updateState: false })
    setLibDocs(libraryStore.getAll())
    setKnowledgeBootstrapLoading(false)
    setKnowledgeBootstrapMessage(`Bootstrap complete. Imported ${imported}, skipped ${skipped}, failed ${failed}.`)

    if (imported > 0) {
      await recordLearning({
        title: 'Google + GitHub knowledge bootstrap integrated',
        detail: `Imported ${imported} curated packs from web and GitHub sources for broader baseline understanding.`,
        source: 'knowledge-bootstrap',
        newSkills: ['Broad Web Grounding', 'GitHub Knowledge Grounding', 'General Baseline Knowledge'],
      })
    }
  }

  async function handleIngestFromYoutube() {
    if (!window.paxion) {
      setYoutubeIngestMessage('YouTube ingestion is available only in desktop mode.')
      return
    }

    if (!youtubeIngestUrl.trim()) {
      setYoutubeIngestMessage('Enter a YouTube URL first.')
      return
    }

    setYoutubeIngestLoading(true)
    setYoutubeIngestMessage('Fetching YouTube transcript...')

    const result = await window.paxion.library
      .ingestYoutube({ url: youtubeIngestUrl.trim() })
      .catch(() => null)

    if (!result?.ok || !result.content || !result.name) {
      setYoutubeIngestLoading(false)
      setYoutubeIngestMessage(result?.reason ?? 'YouTube transcript ingestion failed.')
      return
    }

    ingestLibraryKnowledge(result.name, result.content, 'paste')
    if (Array.isArray(result.segments) && result.segments.length > 0) {
      result.segments.forEach((segment) => {
        ingestLibraryKnowledge(segment.name, segment.content, 'paste', {
          distill: false,
          updateState: false,
          syncBrain: false,
        })
      })
      syncBrainKnowledgeProfile({ updateState: false })
      setLibDocs(libraryStore.getAll())
    }
    setYoutubeIngestLoading(false)
    setYoutubeIngestUrl('')
    setYoutubeIngestMessage(
      result.segments && result.segments.length > 0
        ? `Imported transcript and ${result.segments.length} learning segments.`
        : result.segmentCount
          ? `Imported transcript (${result.segmentCount} line segment${result.segmentCount === 1 ? '' : 's'}).`
          : `Imported: ${result.name}`,
    )

    const newSkills = inferSkills(`${result.name}\n${result.content}`)
    await recordLearning({
      title: `Knowledge ingested from YouTube: ${result.name}`,
      detail:
        newSkills.length > 0
          ? `Acquired ${newSkills.length} skill signal(s) from YouTube transcript.`
          : 'Stored YouTube transcript into local knowledge library.',
      source: 'library-youtube',
      newSkills,
    })
  }

  function handleAddByPaste() {
    if (!libPasteText.trim()) return
    setLibAddError('')
    const title = libPasteName || 'Pasted document'
    ingestLibraryKnowledge(title, libPasteText, 'paste')
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
    syncBrainKnowledgeProfile({ updateState: false })
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

  async function refreshYoutubeSttStatus() {
    if (!window.paxion) {
      setVideoMessage('STT readiness check is available only in desktop mode.')
      return
    }

    setVideoSttLoading(true)
    const result = await window.paxion.learning.sttStatus().catch(() => null)
    setVideoSttLoading(false)

    if (!result?.ok) {
      setVideoMessage('Failed to detect STT tool readiness.')
      return
    }

    setVideoSttStatus({
      ready: result.ready,
      tools: result.tools,
      updatedAt: result.updatedAt,
    })
    setVideoMessage(result.ready ? 'STT fallback is ready.' : 'STT fallback is missing one or more tools.')
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

  async function autoLearnYoutubeSegment(planId: string, segmentId: string) {
    if (!window.paxion) return
    const result = await window.paxion.learning
      .youtubeSegmentAutoLearn({
        planId,
        segmentId,
      })
      .catch(() => null)

    if (!result?.ok) {
      setVideoMessage(result?.reason ?? 'Failed to auto-learn this segment.')
      return
    }

    ingestLibraryKnowledge(result.docName, result.content, 'paste')
    setVideoPlans(result.videoPlans)
    setLearnedSkills(result.skills)
    setLearningUpdatedAt(result.updatedAt)
    setVideoMessage(`AI consumed segment: ${result.segmentLabel}. Knowledge stored in Library + Brain.`)
  }

  async function autoLearnYoutubeBatch(planId: string) {
    const plan = videoPlans.find((entry) => entry.id === planId)
    if (!plan) return

    const pending = plan.segments.filter((segment) => segment.status !== 'learned')
    const batch = pending.slice(0, Math.max(1, plan.parallelSlots))
    if (batch.length === 0) {
      setVideoMessage('No pending segments left in this plan.')
      return
    }

    let completed = 0
    for (const segment of batch) {
      const result = await window.paxion?.learning
        .youtubeSegmentAutoLearn({
          planId,
          segmentId: segment.id,
        })
        .catch(() => null)
      if (!result?.ok) {
        continue
      }
      ingestLibraryKnowledge(result.docName, result.content, 'paste')
      setVideoPlans(result.videoPlans)
      setLearnedSkills(result.skills)
      setLearningUpdatedAt(result.updatedAt)
      completed += 1
    }

    if (completed === 0) {
      setVideoMessage('AI could not auto-learn this batch (likely missing public transcript).')
      return
    }

    setVideoMessage(`AI auto-learned ${completed} segment(s) in this batch and stored knowledge.`)
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

  const automationFlowPreview = useMemo(() => {
    const parsedSteps = parseAutomationSteps(automationStepsText)
    const trimmedIntent = automationIntent.trim()
    const target = automationTargetUrl.trim()
    const safeSteps = parsedSteps.slice(0, 10)
    const actionSummary = safeSteps.reduce(
      (acc, step) => {
        acc[step.action] = (acc[step.action] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    const nodes = [
      {
        id: 'node-trigger',
        kind: 'trigger',
        title: 'Manual Trigger',
        detail: 'Run Adapter in workspace',
      },
      {
        id: 'node-intent',
        kind: 'intent',
        title: 'Mission Intent',
        detail: trimmedIntent || 'Define what outcome this flow should produce.',
      },
      ...safeSteps.map((step, index) => {
        const stepTitle = `Step ${index + 1}: ${step.action}`
        const stepDetail =
          step.action === 'wait'
            ? `Pause for ${Math.max(0, Number(step.waitMs ?? 500))}ms`
            : `${step.selector || '(selector missing)'}${step.value ? ` -> ${step.value}` : ''}`

        return {
          id: `node-step-${index + 1}`,
          kind: 'step',
          title: stepTitle,
          detail: stepDetail,
        }
      }),
      {
        id: 'node-verify',
        kind: 'verify',
        title: 'Verification Gate',
        detail: 'Execution records + suggested capabilities',
      },
    ]

    const connectors = nodes.slice(0, -1).map((node, idx) => `${node.id}:${nodes[idx + 1].id}`)
    const hasIntent = trimmedIntent.length > 0
    const hasTarget = /^https?:\/\//i.test(target)
    const hasStepCount = parsedSteps.length > 0
    const readiness = [hasIntent, hasTarget, hasStepCount].filter(Boolean).length

    return {
      parsedSteps,
      nodes,
      connectors,
      actionSummary,
      readiness,
      target,
      hasIntent,
      hasTarget,
      hasStepCount,
    }
  }, [automationIntent, automationStepsText, automationTargetUrl])

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

  async function loadPolyglotStarter(language: PolyglotLanguage) {
    setPolyglotLanguage(language)
    setPolyglotResult(null)

    if (!window.paxion) {
      setPolyglotCode(POLYGLOT_TEMPLATES[language])
      setPolyglotMessage(`Loaded fallback ${POLYGLOT_LANGUAGE_LABELS[language]} starter template.`)
      return
    }

    const result = await window.paxion.polyglot.starter({ language }).catch(() => null)
    if (!result?.ok || !result.content) {
      setPolyglotCode(POLYGLOT_TEMPLATES[language])
      setPolyglotMessage(
        result?.reason ?? `Loaded fallback ${POLYGLOT_LANGUAGE_LABELS[language]} starter template.`,
      )
      return
    }

    setPolyglotCode(result.content)
    setPolyglotMessage(`Loaded repo starter: ${result.name}`)
  }

  async function runPolyglotLab() {
    if (!window.paxion) {
      setPolyglotMessage('Polyglot runtime execution is available only in desktop mode.')
      return
    }

    setPolyglotRunning(true)
    setPolyglotMessage(`Running ${POLYGLOT_LANGUAGE_LABELS[polyglotLanguage]} code...`)

    const result = await window.paxion.polyglot
      .run({
        language: polyglotLanguage,
        code: polyglotCode,
        stdin: polyglotStdin,
        args: parseCliArgsText(polyglotArgsText),
        timeoutMs: Number(polyglotTimeoutMs || 20000),
      })
      .catch(() => null)

    if (!result) {
      setPolyglotRunning(false)
      setPolyglotMessage('Polyglot execution failed before a result returned.')
      return
    }

    setPolyglotResult(result)
    setPolyglotRunning(false)
    setPolyglotMessage(result.reason)
    await loadLearningState()
  }

  async function runPolyglotBrainMesh() {
    if (!window.paxion) {
      setPolyglotMessage('Polyglot brain mesh is available only in desktop mode.')
      return
    }

    setPolyglotBrainRunning(true)
    setPolyglotMessage('Running polyglot brain mesh...')

    const result = await window.paxion.polyglot
      .brainMesh({
        objective: polyglotBrainObjective,
        languages: ['python', 'c', 'cpp', 'java', 'julia', 'r', 'javascript'],
      })
      .catch(() => null)

    if (!result) {
      setPolyglotBrainRunning(false)
      setPolyglotMessage('Polyglot brain mesh failed before a result returned.')
      return
    }

    setPolyglotBrainResult(result)
    setPolyglotBrainRunning(false)
    setPolyglotMessage(result.summary)
    await loadLearningState()
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
        appKey: targetAppKey.trim() || undefined,
        appVersion: targetAppVersion.trim() || undefined,
      })
      .catch(() => null)

    if (!result?.ok) {
      setReadinessMessage(result?.reason ?? 'Failed to prepare target workflow pack.')
      return
    }

    setExecutionSessions(result.executionSessions)
    setLearningGraph(result.learningGraph)
    setTargetPackPermission(false)
    setNativeActionSessionId(result.session.id)
    setEvidenceSessionId(result.session.id)
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

  async function executeRollbackTransactionById(sessionId: string) {
    if (!window.paxion) return
    const result = await window.paxion.readiness
      .executeRollback({
        sessionId,
        notes: sessionNotes,
      })
      .catch(() => null)

    if (!result?.ok) {
      setReadinessMessage(result?.reason ?? 'Failed to execute rollback transaction.')
      return
    }

    setExecutionSessions(result.executionSessions)
    setLearningGraph(result.learningGraph)
    setSessionNotes('')
    setReadinessMessage(`Rollback transaction ${String(result.transaction.id || '')} completed.`)
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
    setGovernancePipelineId(result.pipeline.id)
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
        sessionId: evidenceSessionId.trim() || undefined,
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

  async function runNativeActionExecution() {
    if (!window.paxion) return
    const sessionId = nativeActionSessionId.trim()
    const fallbackSelectors = nativeActionFallbackSelectors
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean)

    const result = await window.paxion.readiness
      .executeNativeAction({
        sessionId: sessionId || undefined,
        stepId: nativeActionStepId.trim() || undefined,
        action: nativeActionType,
        selector: nativeActionSelector.trim() || undefined,
        fallbackSelectors,
        command: nativeActionCommand.trim() || undefined,
        appType: observationAppType,
        appKey: targetAppKey.trim() || undefined,
        appVersion: targetAppVersion.trim() || undefined,
        intendedStep: `Native ${nativeActionType} via Workspace`,
        domSnapshot: nativeActionDomSnapshot,
        explicitPermission: nativeActionPermission,
      })
      .catch(() => null)

    if (!result?.ok) {
      setReadinessMessage(result?.reason ?? 'Failed to execute native action.')
      return
    }

    setExecutionSessions(result.executionSessions ?? [])
    setLearningGraph(result.learningGraph ?? { nodes: [], edges: [], updatedAt: null })
    setNativeActionPermission(false)
    if (result.commandOutput) {
      setEvidenceCommandOutput(result.commandOutput)
    }
    setReadinessMessage(`Native action executed: ${nativeActionType}.`)
  }

  async function queryLearningGraph(cursorOverride?: number) {
    if (!window.paxion) return
    const kinds = graphQueryKinds
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
    const cursor = typeof cursorOverride === 'number' ? cursorOverride : graphCursor
    const result = await window.paxion.readiness
      .queryGraph({
        text: graphQueryText,
        kinds,
        edgeKind: graphQueryEdgeKind.trim() || undefined,
        cursor,
        limit: 40,
      })
      .catch(() => null)

    if (!result?.ok) {
      setReadinessMessage(result?.reason ?? 'Failed to query learning graph.')
      return
    }

    setLearningGraph(result.learningGraph)
    setGraphCursor(cursor)
    setGraphPage(result.page)
    setGraphIndexStats(result.indexStats)
    setReadinessMessage(`Graph query returned ${result.learningGraph.nodes.length} node(s).`)
  }

  async function signGovernanceForPipeline(pipelineId: string) {
    if (!window.paxion) return
    const result = await window.paxion.readiness
      .signGovernancePolicy({
        pipelineId,
        note: governanceSignatureNote || 'Approved for progression gate.',
        testsPassed: Number(governanceTestsPassed || '0'),
        lintPassed: governanceLintPassed,
        buildPassed: governanceBuildPassed,
      })
      .catch(() => null)

    if (!result?.ok) {
      setReadinessMessage(result?.reason ?? 'Failed to sign governance policy.')
      return
    }

    setEvolutionPipelines(result.evolutionPipelines)
    setReadinessMessage(`Governance signature recorded for pipeline ${pipelineId}.`)
  }

  async function refreshAttestationStatus() {
    if (!window.paxion) return
    const result = await window.paxion.readiness.attestationStatus().catch(() => null)
    if (!result?.ok) {
      return
    }
    setAttestationFingerprint(result.status.publicKeyFingerprint)
    setAttestationLastHash(result.status.lastEntryHash)
  }

  async function rotateAttestationKeyNow() {
    if (!window.paxion) return
    const result = await window.paxion.readiness
      .rotateAttestationKey({ reason: attestationRotationReason })
      .catch(() => null)
    if (!result?.ok) {
      setReadinessMessage(result?.reason ?? 'Failed to rotate attestation key.')
      return
    }
    await refreshAttestationStatus()
    setReadinessMessage('Attestation key rotated and chain anchor updated.')
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

    setChatNotice('ChatGPT opened in browser. Ask there directly, then paste the answer here if you want me to save it.')
    await recordLearning({
      title: 'Desktop ChatGPT relay opened',
      detail: 'Opened ChatGPT in browser using explicit capability and admin session.',
      source: 'chatgpt-relay',
      newSkills: ['AI Prompt Engineering'],
    })
    return true
  }

  function extractDeclaredName(text: string): string | null {
    const match = text.match(/(?:my name is|call me)\s+([a-z][a-z\s'-]{1,30})(?:[,.!]|\s|$)/i)
    if (!match?.[1]) {
      return null
    }

    const normalized = match[1]
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\b(friend|bro|chief|sir|boss)\b/gi, '')
      .trim()

    if (!normalized) {
      return null
    }

    return normalized
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ')
  }

  function personalizeReply(reply: string): string {
    if (!chatUserName && !chatFriendlyTone) {
      return reply
    }
    let nextReply = reply

    if (chatUserName) {
      nextReply = nextReply
        .replace(/Paro the Chief/gi, chatUserName)
        .replace(/\bChief\b/gi, chatUserName)
        .replace(/\bParo\b/gi, chatUserName)
    }

    if (chatFriendlyTone) {
      nextReply = nextReply
        .replace(/System online\.?\s*/gi, '')
        .replace(/Access granted\.?\s*/gi, '')
    }

    return nextReply
  }

  async function sendChatMessage(overrideText?: string) {
    const text = typeof overrideText === 'string' ? overrideText.trim() : chatInput.trim()
    if (!text || chatLoading) return

    const declaredName = extractDeclaredName(text)
    if (declaredName) {
      setChatUserName(declaredName)
      localStorage.setItem('paxion-chat-user-name', declaredName)
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      contextDocs: [],
    }

    setChatMessages((prev) => [...prev, userMsg])
    if (typeof overrideText !== 'string') {
      setChatInput('')
    }
    setChatLoading(true)

    const asksForStoredName = /\b(what is my name|what's my name|who am i|tell me my name|remember my name|do you know my name|you know my name|u know my name|know my name)\b/i.test(text)
    const wantsChatGptRelay = /\b(chatgpt|chat gpt)\b/i.test(text) && /\b(chat|ask|talk|open|use|connect|relay)\b/i.test(text)
    const asksFriendlyTone = /\b(no need to be formal|be casual|talk casually|be my friend|talk like a friend)\b/i.test(text)

    if (wantsChatGptRelay) {
      const opened = await openDesktopChatRelay(text)
      window.setTimeout(() => {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-a`,
            role: 'assistant',
            content: opened
              ? 'ChatGPT is open in your browser now. Ask there directly, and if you want, paste the answer back so I can learn it.'
              : 'I could not open ChatGPT relay right now. Check desktop mode and relay settings, then try again.',
            timestamp: new Date().toISOString(),
            contextDocs: [],
            reasoningSteps: ['Detected direct ChatGPT command and routed immediately to desktop relay (bypassed library search).'],
            confidence: opened ? 'high' : 'low',
          },
        ])
        setChatLoading(false)
      }, 120)
      return
    }

    if (asksFriendlyTone) {
      setChatFriendlyTone(true)
      localStorage.setItem('paxion-chat-friendly-tone', '1')
      window.setTimeout(() => {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-a`,
            role: 'assistant',
            content: chatUserName
              ? `Done, ${chatUserName}. I will keep it friendly and casual from now on.`
              : 'Done. I will keep it friendly and casual from now on.',
            timestamp: new Date().toISOString(),
            contextDocs: [],
            reasoningSteps: ['Detected tone preference and persisted friendly mode in local settings.'],
            confidence: 'high',
          },
        ])
        setChatLoading(false)
      }, 140)
      return
    }

    if (asksForStoredName) {
      const rememberedName = declaredName || chatUserName
      const reply = rememberedName
        ? `Your name is ${rememberedName}. I have it saved and I will address you by that name.`
        : 'You have not told me your name yet. Say: "My name is ..." and I will remember it.'

      window.setTimeout(() => {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-a`,
            role: 'assistant',
            content: reply,
            timestamp: new Date().toISOString(),
            contextDocs: [],
            reasoningSteps: ['Profile memory check executed from local conversation memory.'],
            confidence: rememberedName ? 'high' : 'medium',
          },
        ])
        setChatLoading(false)
      }, 160)
      return
    }

    if (declaredName) {
      window.setTimeout(() => {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-a`,
            role: 'assistant',
            content: `Perfect, ${declaredName}. I will call you ${declaredName} from now on.`,
            timestamp: new Date().toISOString(),
            contextDocs: [],
            reasoningSteps: ['Detected explicit self-identification and persisted profile name in local storage.'],
            confidence: 'high',
          },
        ])
        setChatLoading(false)
      }, 160)
      return
    }

    const localResponse = brain.think(text, libDocs)
    let finalReply = personalizeReply(localResponse.reply)
    const finalContextDocs = localResponse.contextDocs
    let finalReasoning = localResponse.reasoningSteps
    let finalConfidence = localResponse.confidence

    if (libDocs.length === 0 && localResponse.confidence === 'none') {
      finalReply = [
        chatUserName ? `I hear you, ${chatUserName}.` : 'I hear you.',
        'I can still chat with you right now.',
        'For accurate factual answers, add docs in Library so I can cite your own data.',
      ].join(' ')
      finalReasoning = [
        ...localResponse.reasoningSteps,
        'Library is empty, switched to conversational fallback instead of hard rejection.',
      ]
      finalConfidence = 'medium'
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
    ingestLibraryKnowledge(`Relay: ${title}`, text, 'paste')

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
          <div className="chat-layout">
            <aside className="chat-left-column">
              <div className="decision-card">
                <strong>Brain Status</strong>
                <p className="muted">Voice loop: {voiceLoopEnabled ? 'Active' : 'Idle'}</p>
                <p className="muted">Wake phrase: {wakePhrase || 'paxion wakeup'}</p>
                {chatUserName && <p className="muted">Friend profile: {chatUserName}</p>}
                {chatFriendlyTone && <p className="muted">Tone mode: Friendly</p>}
                {chatNotice && <p className="muted">{chatNotice}</p>}
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
            </aside>

            <section className="chat-main-column">
              <div className="chat-messages" ref={chatScrollRef}>
                {chatMessages.length === 0 ? (
                  <p className="muted chat-empty">
                    Paxion is online. You can chat immediately.
                    Add Library documents to improve factual depth and source-cited answers.
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
            </section>

            <aside className="chat-right-column">
              <div className="chat-voice-row">
                <button
                  className="run-button"
                  onClick={() => setAssistantMode((prev) => (prev === 'chat' ? 'voice' : 'chat'))}
                >
                  Assistant Mode: {assistantMode === 'voice' ? 'Voice' : 'Chat'}
                </button>
                <button className="run-button" onClick={toggleChatVoiceOutput}>
                  Voice Output: {chatVoiceEnabled && capabilities.voiceOutput ? 'ON' : 'OFF'}
                </button>
                <button
                  className="run-button"
                  onClick={() => {
                    void setCloseToTrayMode(!closeToTrayEnabled)
                  }}
                >
                  Close To Tray: {closeToTrayEnabled ? 'ON' : 'OFF'}
                </button>
                {!chatVoiceListening ? (
                  <button
                    className="run-button"
                    onClick={() => startVoiceInput(assistantMode === 'voice')}
                    disabled={chatVoicePending !== 'idle'}
                  >
                    {chatVoicePending === 'starting' ? 'Starting Voice...' : 'Start Voice Input'}
                  </button>
                ) : (
                  <button className="run-button" onClick={stopVoiceInput} disabled={chatVoicePending !== 'idle'}>
                    {chatVoicePending === 'stopping' ? 'Stopping Voice...' : 'Stop Voice Input'}
                  </button>
                )}
              </div>
              <div className="chat-voice-row">
                <input
                  className="input"
                  value={wakePhrase}
                  onChange={(event) => setWakePhrase(event.target.value.toLowerCase())}
                  placeholder="Wake phrase (example: paxion wakeup)"
                />
                <select
                  className="chat-mode-select"
                  value={callProvider}
                  onChange={(event) => {
                    const provider = event.target.value as 'desktop-relay' | 'twilio' | 'sip'
                    setCallProvider(provider)
                    if (window.paxion?.voice?.setProvider) {
                      void window.paxion.voice.setProvider({
                        provider,
                        fromNumber: callFromNumber,
                      })
                    }
                  }}
                >
                  <option value="desktop-relay">Call Provider: Desktop Relay</option>
                  <option value="twilio">Call Provider: Twilio</option>
                  <option value="sip">Call Provider: SIP</option>
                </select>
                <input
                  className="input"
                  value={callFromNumber}
                  onChange={(event) => setCallFromNumber(event.target.value)}
                  placeholder="Provider from number (for Twilio)"
                />
                <button
                  className="run-button"
                  onClick={() => {
                    const phrase = wakePhrase.trim().toLowerCase()
                    if (!phrase) {
                      setWakePhrase('paxion wakeup')
                    }
                    if (window.paxion?.voice?.setProvider) {
                      void window.paxion.voice.setProvider({
                        provider: callProvider,
                        fromNumber: callFromNumber,
                      })
                    }
                    setChatNotice(`Wake phrase set to "${(phrase || 'paxion wakeup')}".`)
                  }}
                >
                  Save Wake Phrase
                </button>
                <button
                  className="run-button"
                  onClick={() => {
                    if (window.paxion?.assistant) {
                      void window.paxion.assistant.showWindow()
                    }
                    setActiveTab('chat')
                    setAssistantMode('voice')
                    setChatNotice('Voice assistant ready. Say wake phrase then command.')
                  }}
                >
                  Arm Wake Runtime
                </button>
              </div>
              {isWebRuntime && isMobileDevice && (
                <div className="decision-card">
                  <p className="muted">
                    Mobile companion mode active. Voice chat works in browser-supported engines; desktop-only actions
                    (tray runtime, native automation, direct dialer relay) require the Electron app or future cloud backend.
                  </p>
                  <p className="muted">
                    Active route for selected action <strong>{selectedAction.id}</strong>: <strong>{activeRouteDecision.mode}</strong>
                  </p>
                  <p className="muted">Reason: {activeRouteDecision.reason}</p>
                  <div className="workspace-actions">
                    {!pwaInstalled && (
                      <button className="run-button" onClick={() => void installPaxionWebApp()}>
                        Install On Phone
                      </button>
                    )}
                  </div>
                  {pwaInstallMessage && <p className="muted">{pwaInstallMessage}</p>}
                </div>
              )}
            </aside>
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
            <div className="workspace-actions">
              <button className="run-button" onClick={() => void integrateAllKnowledgePacks()}>
                Integrate All Knowledge Packs
              </button>
            </div>
            {foundationKnowledgeMessage && <p className="muted">{foundationKnowledgeMessage}</p>}
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

            <strong>Ingest From Website URL</strong>
            <div className="lib-web-row">
              <input
                className="lib-search"
                value={webIngestUrl}
                onChange={(event) => setWebIngestUrl(event.target.value)}
                placeholder="Paste article URL from Google results"
              />
              <button
                className="run-button"
                onClick={() => void handleIngestFromWebUrl()}
                disabled={webIngestLoading}
              >
                {webIngestLoading ? 'Ingesting...' : 'Ingest URL'}
              </button>
            </div>
            {webIngestMessage && <p className="muted">{webIngestMessage}</p>}

            <strong>Auto Bootstrap (Google + GitHub Curated Packs)</strong>
            <div className="lib-web-row">
              <button
                className="run-button"
                onClick={() => void handleAutoKnowledgeBootstrap()}
                disabled={knowledgeBootstrapLoading}
              >
                {knowledgeBootstrapLoading ? 'Bootstrapping...' : 'One-Click Add All Packs'}
              </button>
            </div>
            {knowledgeBootstrapMessage && <p className="muted">{knowledgeBootstrapMessage}</p>}

            <strong>Ingest From YouTube</strong>
            <div className="lib-web-row">
              <input
                className="lib-search"
                value={youtubeIngestUrl}
                onChange={(event) => setYoutubeIngestUrl(event.target.value)}
                placeholder="Paste YouTube video URL to import transcript"
              />
              <button
                className="run-button"
                onClick={() => void handleIngestFromYoutube()}
                disabled={youtubeIngestLoading}
              >
                {youtubeIngestLoading ? 'Ingesting...' : 'Ingest YouTube'}
              </button>
            </div>
            {youtubeIngestMessage && <p className="muted">{youtubeIngestMessage}</p>}
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
            <strong>Threat Dashboard</strong>
            <p className="muted">Real-time risk scoring across capabilities, bridge traffic, and active request posture.</p>
            <div className="workspace-actions">
              <button className="run-button" onClick={() => void loadThreatDashboard()}>
                Refresh Threat View
              </button>
            </div>
            {threatDashboard ? (
              <div className="capability-list">
                <div className="capability-item">
                  <span>Global threat level</span>
                  <strong>{String(threatDashboard.level || 'unknown')} ({String(threatDashboard.score || '0')})</strong>
                </div>
                <div className="capability-item">
                  <span>Pending bridge requests</span>
                  <strong>{String(threatDashboard.pendingBridgeRequests || '0')}</strong>
                </div>
                <div className="capability-item">
                  <span>Active signed command packs</span>
                  <strong>{String(threatDashboard.activeSignedCommandPacks || '0')}</strong>
                </div>
              </div>
            ) : (
              <p className="muted">Threat view not loaded yet.</p>
            )}
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

          <div className="decision-card">
            <strong>Telephony Credentials (Encrypted At Rest)</strong>
            <p className="muted">Store Twilio/SIP credentials encrypted with OS secure storage.</p>
            <div className="control-group">
              <label>Twilio Account SID</label>
              <input
                type="password"
                value={twilioAccountSid}
                onChange={(event) => setTwilioAccountSid(event.target.value)}
                placeholder="ACxxxxxxxx"
              />
            </div>
            <div className="control-group">
              <label>Twilio Auth Token</label>
              <input
                type="password"
                value={twilioAuthToken}
                onChange={(event) => setTwilioAuthToken(event.target.value)}
                placeholder="Twilio auth token"
              />
            </div>
            <div className="control-group">
              <label>Twilio From Number</label>
              <input
                value={callFromNumber}
                onChange={(event) => setCallFromNumber(event.target.value)}
                placeholder="+1234567890"
              />
            </div>
            <div className="control-group">
              <label>SIP URI</label>
              <input
                value={sipUri}
                onChange={(event) => setSipUri(event.target.value)}
                placeholder="sip:provider.example"
              />
            </div>
            <div className="control-group">
              <label>SIP Username</label>
              <input
                value={sipUsername}
                onChange={(event) => setSipUsername(event.target.value)}
                placeholder="sip user"
              />
            </div>
            <div className="control-group">
              <label>SIP Password</label>
              <input
                type="password"
                value={sipPassword}
                onChange={(event) => setSipPassword(event.target.value)}
                placeholder="sip password"
              />
            </div>
            <div className="workspace-actions">
              <button className="run-button" onClick={() => void loadVoiceSecretStatus()}>
                Refresh Secret Status
              </button>
              <button className="run-button" onClick={() => void saveVoiceSecrets()}>
                Save Encrypted Credentials
              </button>
            </div>
            <p className="muted">{twilioSecretStatus}</p>
          </div>

          <div className="decision-card">
            <strong>Policy-Signed Terminal Command Packs</strong>
            <p className="muted">Expand terminal capability with signed command allowlists.</p>
            <div className="control-group">
              <label>Pack Name</label>
              <input
                value={terminalPackName}
                onChange={(event) => setTerminalPackName(event.target.value)}
                placeholder="Example: Network Diagnostics Pack"
              />
            </div>
            <div className="control-group">
              <label>Commands (one per line)</label>
              <textarea
                value={terminalPackCommands}
                onChange={(event) => setTerminalPackCommands(event.target.value)}
                rows={4}
                placeholder={"nmap --help\nnmap --version"}
              />
            </div>
            <div className="workspace-actions">
              <button className="run-button" onClick={() => void loadTerminalPacks()}>
                Refresh Packs
              </button>
              <button className="run-button" onClick={() => void simulateTerminalPack()}>
                Simulate Policy
              </button>
              <button className="run-button" onClick={() => void createTerminalPack()}>
                Create Signed Pack
              </button>
            </div>
            {terminalPackSimulation && (
              <p className="muted">
                Simulation risk: {String(terminalPackSimulation.riskScore || '0')} | Recommendation: {String(terminalPackSimulation.recommendation || 'unknown')}
              </p>
            )}
            <div className="capability-list">
              {terminalPacks.length === 0 ? (
                <p className="muted">No signed packs yet.</p>
              ) : (
                terminalPacks.map((pack) => {
                  const id = String(pack.id || '')
                  const active = Boolean(pack.active)
                  const commandCount = Array.isArray(pack.commands) ? pack.commands.length : 0
                  return (
                    <div className="capability-item" key={id || Math.random().toString(36)}>
                      <span>{String(pack.name || 'Unnamed pack')} ({commandCount} commands)</span>
                      <button
                        className="run-button"
                        onClick={() => {
                          void setTerminalPackActivation(id, !active)
                        }}
                      >
                        {active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="decision-card">
            <strong>Mobile-to-Desktop Secure Bridge</strong>
            <p className="muted">Phone commands enter pending queue and require admin approval ticket.</p>
            <div className="control-group">
              <label>Bridge Host</label>
              <input value={bridgeHost} onChange={(event) => setBridgeHost(event.target.value)} />
            </div>
            <div className="control-group">
              <label>Bridge Port</label>
              <input value={bridgePort} onChange={(event) => setBridgePort(event.target.value)} />
            </div>
            <div className="control-group">
              <label>Bridge Secret</label>
              <input
                type="password"
                value={bridgeSecret}
                onChange={(event) => setBridgeSecret(event.target.value)}
                placeholder="set shared secret (or leave empty for auto)"
              />
            </div>
            <div className="workspace-actions">
              <button className="run-button" onClick={() => void loadBridgeStatus()}>
                Refresh Bridge
              </button>
              <button className="run-button" onClick={() => void rotateBridgeSecret()}>
                Rotate Secret
              </button>
              <button className="run-button" onClick={() => void issueBridgeOneTimeToken()}>
                Issue One-Time Token
              </button>
              {!bridgeEnabled ? (
                <button className="run-button" onClick={() => void startMobileBridge()}>
                  Start Bridge
                </button>
              ) : (
                <button className="run-button" onClick={() => void stopMobileBridge()}>
                  Stop Bridge
                </button>
              )}
            </div>
            {bridgeMessage && <p className="muted">{bridgeMessage}</p>}
            {bridgeOneTimeToken && <p className="muted">One-time token: {bridgeOneTimeToken}</p>}
            <p className="muted">Pending remote requests: {bridgePendingRequests.length}</p>
            <div className="capability-list">
              {bridgePendingRequests.map((row) => {
                const id = String(row.id || '')
                const status = String(row.status || 'pending')
                const actionId = String((row.request as Record<string, unknown> | undefined)?.actionId || 'unknown')
                return (
                  <div className="capability-item" key={id || Math.random().toString(36)}>
                    <span>{actionId} [{status}]</span>
                    {status === 'pending' ? (
                      <div className="workspace-actions">
                        <button className="run-button" onClick={() => void decideBridgeRequest(id, true)}>
                          Approve
                        </button>
                        <button className="run-button" onClick={() => void decideBridgeRequest(id, false)}>
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Voice Quality Profile ─────────────────────────────────── */}
          <div className="decision-card">
            <strong>Voice Quality Profile</strong>
            <p className="muted">Tune persona, prosody, speed, and interruption handling for spoken output.</p>
            <div className="control-group">
              <label>Persona</label>
              <select
                value={voiceProfile.personaMemory}
                onChange={(e) =>
                  setVoiceProfile((prev) => ({ ...prev, personaMemory: e.target.value }))
                }
              >
                <option value="friendly-technical">Friendly-Technical</option>
                <option value="formal">Formal</option>
                <option value="casual">Casual</option>
                <option value="warm">Warm</option>
              </select>
            </div>
            <div className="control-group">
              <label>Prosody</label>
              <select
                value={voiceProfile.prosody}
                onChange={(e) =>
                  setVoiceProfile((prev) => ({ ...prev, prosody: e.target.value }))
                }
              >
                <option value="balanced">Balanced</option>
                <option value="calm">Calm</option>
                <option value="energetic">Energetic</option>
                <option value="emphatic">Emphatic</option>
              </select>
            </div>
            <div className="capability-item">
              <span>Full-duplex voice mode</span>
              <input
                type="checkbox"
                checked={voiceProfile.duplexEnabled}
                onChange={(e) =>
                  setVoiceProfile((prev) => ({ ...prev, duplexEnabled: e.target.checked }))
                }
              />
            </div>
            <div className="control-group">
              <label>Interruption handling</label>
              <select
                value={voiceProfile.interruptionHandling}
                onChange={(e) =>
                  setVoiceProfile((prev) => ({ ...prev, interruptionHandling: e.target.value }))
                }
              >
                <option value="polite">Polite (finish sentence)</option>
                <option value="barge-in">Barge-in (cancel immediately)</option>
                <option value="queue">Queue following utterance</option>
              </select>
            </div>
            <div className="workspace-actions">
              <button className="run-button" onClick={() => void saveVoiceRuntimeProfile()}>
                Save Voice Quality Profile
              </button>
            </div>
            {voiceRuntimeMessage && <p className="muted">{voiceRuntimeMessage}</p>}
          </div>

          {/* ── Wake-word Provider ───────────────────────────────────────── */}
          <div className="decision-card">
            <strong>Wake-word Provider</strong>
            <p className="muted">Configure the always-on hotword engine. Native engines require provider binaries on disk.</p>
            <div className="control-group">
              <label>Provider</label>
              <select
                value={wakewordStatus.provider}
                onChange={(e) =>
                  setWakewordStatus((prev) => ({ ...prev, provider: e.target.value }))
                }
              >
                <option value="browser-fallback">Browser fallback (SpeechRecognition)</option>
                <option value="picovoice-porcupine">Picovoice Porcupine</option>
                <option value="openWakeWord">openWakeWord</option>
                <option value="whisper-streaming">Whisper streaming</option>
              </select>
            </div>
            <div className="control-group">
              <label>Model path</label>
              <input
                value={wakewordStatus.modelPath}
                onChange={(e) =>
                  setWakewordStatus((prev) => ({ ...prev, modelPath: e.target.value }))
                }
                placeholder="/path/to/model.ppn"
              />
            </div>
            <div className="control-group">
              <label>Access key (Picovoice)</label>
              <input
                type="password"
                value={wakewordAccessKey}
                onChange={(e) => setWakewordAccessKey(e.target.value)}
                placeholder="Picovoice access key"
              />
            </div>
            <div className="capability-item">
              <span>Always-on detection</span>
              <input
                type="checkbox"
                checked={wakewordStatus.alwaysOn}
                onChange={(e) =>
                  setWakewordStatus((prev) => ({ ...prev, alwaysOn: e.target.checked }))
                }
              />
            </div>
            <div className="control-group">
              <label>Sensitivity — {wakewordStatus.sensitivity.toFixed(2)}</label>
              <input
                type="range"
                min={0.1}
                max={0.99}
                step={0.01}
                value={wakewordStatus.sensitivity}
                onChange={(e) =>
                  setWakewordStatus((prev) => ({ ...prev, sensitivity: parseFloat(e.target.value) }))
                }
              />
            </div>
            <div className="workspace-actions">
              <button className="run-button" onClick={() => void saveWakewordRuntime()}>
                Apply Wake-word Config
              </button>
            </div>
            <div className="capability-list">
              <div className="capability-item">
                <span>Status</span>
                <strong>{wakewordStatus.status}</strong>
              </div>
              <div className="capability-item">
                <span>Provider</span>
                <strong>{wakewordStatus.provider}</strong>
              </div>
              <div className="capability-item">
                <span>Executable present</span>
                <strong>{wakewordStatus.executablePresent ? 'Yes' : 'No'}</strong>
              </div>
              <div className="capability-item">
                <span>Model present</span>
                <strong>{wakewordStatus.modelPresent ? 'Yes' : 'No'}</strong>
              </div>
              <div className="capability-item">
                <span>Est. latency</span>
                <strong>{wakewordStatus.estimatedLatencyMs} ms</strong>
              </div>
            </div>
            {voiceRuntimeMessage && <p className="muted">{voiceRuntimeMessage}</p>}
          </div>

          {/* ── Cloud Relay (internet remote access) ─────────────────────── */}
          <div className="decision-card">
            <strong>Cloud Relay — Internet Remote Access</strong>
            <p className="muted">
              Deploy <code>relay/server.cjs</code> to any public host, then connect here.
              Once configured, you can send commands from mobile or any browser.
            </p>
            <div className="control-group">
              <label>Relay endpoint</label>
              <input
                value={cloudRelayEndpoint}
                onChange={(e) => setCloudRelayEndpoint(e.target.value)}
                placeholder="https://your-relay.example.com"
              />
            </div>
            <div className="control-group">
              <label>Relay token (encrypted at rest)</label>
              <input
                type="password"
                value={cloudRelayToken}
                onChange={(e) => setCloudRelayToken(e.target.value)}
                placeholder="shared secret token"
              />
            </div>
            <div className="control-group">
              <label>Device ID</label>
              <input
                value={cloudRelayDeviceId}
                onChange={(e) => setCloudRelayDeviceId(e.target.value)}
                placeholder="paxion-desktop-1"
              />
            </div>
            <div className="control-group">
              <label>Mode</label>
              <select
                value={relayMode}
                onChange={(e) => setRelayMode(e.target.value)}
              >
                <option value="disabled">Disabled</option>
                <option value="cloud">Cloud relay</option>
                <option value="local-only">Local-only bridge</option>
              </select>
            </div>
            <div className="capability-item">
              <span>Auto-poll queue (every 12 s)</span>
              <input
                type="checkbox"
                checked={cloudRelayPollingEnabled}
                onChange={(e) => setCloudRelayPollingEnabled(e.target.checked)}
              />
            </div>
            <div className="capability-item">
              <span>Token configured</span>
              <strong>{cloudRelayTokenConfigured ? 'Yes' : 'No'}</strong>
            </div>
            <div className="workspace-actions">
              <button className="run-button" onClick={() => void saveCloudRelayConfig()}>
                Save Cloud Relay Config
              </button>
              <button className="run-button" onClick={() => void syncCloudRelayQueue()}>
                Sync Queue Now
              </button>
              <button className="run-button" onClick={() => void submitCloudRelayPing()}>
                Send Heartbeat
              </button>
            </div>
            {cloudRelayMessage && <p className="muted">{cloudRelayMessage}</p>}
            {cloudRelayLastSyncAt && (
              <p className="muted">Last sync: {cloudRelayLastSyncAt}</p>
            )}
            <p className="muted">
              Pending cloud requests: {cloudRelayRequests.length}
            </p>
            <div className="capability-list">
              {cloudRelayRequests.map((row) => {
                const id = String(row.id ?? Math.random())
                const status = String(row.status ?? 'pending')
                const actionId = String(
                  (row.request as Record<string, unknown> | undefined)?.actionId ?? 'unknown'
                )
                return (
                  <div className="capability-item" key={id}>
                    <span>{actionId} [{status}]</span>
                    {status === 'pending' && (
                      <button
                        className="run-button"
                        onClick={() => void completeCloudRelayRequest(id)}
                      >
                        Complete
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Realtime Multimodal Perception ───────────────────────────── */}
          <div className="decision-card">
            <strong>Realtime Multimodal Perception</strong>
            <p className="muted">
              Capture webcam frames and ground them into the scene graph every 2.5 seconds.
              Requires camera permission. Works best in Electron (full desktop).
            </p>
            <div className="control-group">
              <label>Label hints (comma-separated)</label>
              <input
                value={perceptionLabelHints}
                onChange={(e) => setPerceptionLabelHints(e.target.value)}
                placeholder="person, screen, desk"
              />
            </div>
            <div className="workspace-actions">
              {!perceptionEnabled ? (
                <button className="run-button" onClick={() => void startPerceptionRuntime()}>
                  Start Perception
                </button>
              ) : (
                <button className="run-button" onClick={() => stopPerceptionRuntime()}>
                  Stop Perception
                </button>
              )}
              <button className="run-button" onClick={() => void capturePerceptionFrame(false)}>
                Capture Snapshot
              </button>
            </div>
            <div className="capability-list">
              <div className="capability-item">
                <span>Status</span>
                <strong>{perceptionEnabled ? 'Active' : 'Idle'}</strong>
              </div>
              <div className="capability-item">
                <span>Frames grounded</span>
                <strong>{perceptionFrames.length}</strong>
              </div>
              {perceptionSceneGraph && (
                <div className="capability-item">
                  <span>Scene graph objects</span>
                  <strong>
                    {Array.isArray((perceptionSceneGraph as { objects?: unknown[] }).objects)
                      ? ((perceptionSceneGraph as { objects?: unknown[] }).objects || []).length
                      : 0}
                  </strong>
                </div>
              )}
              {perceptionSummary && (
                <div className="capability-item">
                  <span>Latest frame</span>
                  <strong style={{ fontSize: '0.8em' }}>{perceptionSummary.slice(0, 80)}</strong>
                </div>
              )}
            </div>
            {perceptionMessage && <p className="muted">{perceptionMessage}</p>}
            {/* Hidden elements used by perception capture loop */}
            <video ref={perceptionVideoRef} style={{ display: 'none' }} autoPlay muted playsInline />
          </div>

            <div className="decision-card">
              <strong>Weekly Self-Evaluation + Auto-Tuning</strong>
              <p className="muted">
                Reviews recent runtime quality and applies safe tuning to voice, wake-word, and relay settings.
              </p>
              <div className="capability-item">
                <span>Auto-apply tuning changes</span>
                <input
                  type="checkbox"
                  checked={weeklyOptimizationAutoTune}
                  onChange={(event) => setWeeklyOptimizationAutoTune(event.target.checked)}
                />
              </div>
              <div className="workspace-actions">
                <button className="run-button" onClick={() => void loadWeeklyOptimizationStatus()}>
                  Refresh Optimizer Status
                </button>
                <button className="run-button" onClick={() => void runWeeklyOptimization()}>
                  Run Weekly Optimization
                </button>
              </div>
              {weeklyOptimizationMessage && <p className="muted">{weeklyOptimizationMessage}</p>}
              {weeklyOptimizationReport ? (
                <div className="capability-list">
                  <div className="capability-item">
                    <span>Last run</span>
                    <strong>{String(weeklyOptimizationReport.generatedAt || 'unknown')}</strong>
                  </div>
                  <div className="capability-item">
                    <span>Applied changes</span>
                    <strong>
                      {Array.isArray(weeklyOptimizationReport.applied)
                        ? weeklyOptimizationReport.applied.length
                        : 0}
                    </strong>
                  </div>
                  <div className="capability-item">
                    <span>Recommendations</span>
                    <strong>
                      {Array.isArray(weeklyOptimizationReport.recommendations)
                        ? weeklyOptimizationReport.recommendations.length
                        : 0}
                    </strong>
                  </div>
                </div>
              ) : (
                <p className="muted">No weekly optimization report yet.</p>
              )}
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
          <div className="workspace-top-tabs" role="tablist" aria-label="Workspace topics">
              <button
                role="tab"
                aria-selected={workspaceTopicTab === 'overview'}
                className={workspaceTopicTab === 'overview' ? 'workspace-top-tab is-active' : 'workspace-top-tab'}
                onClick={() => setWorkspaceTopicTab('overview')}
              >
                Overview
              </button>
              <button
                role="tab"
                aria-selected={workspaceTopicTab === 'polyglot'}
                className={workspaceTopicTab === 'polyglot' ? 'workspace-top-tab is-active' : 'workspace-top-tab'}
                onClick={() => setWorkspaceTopicTab('polyglot')}
              >
                Polyglot Lab
              </button>
              <button
                role="tab"
                aria-selected={workspaceTopicTab === 'youtube'}
                className={workspaceTopicTab === 'youtube' ? 'workspace-top-tab is-active' : 'workspace-top-tab'}
                onClick={() => setWorkspaceTopicTab('youtube')}
              >
                YouTube Learning
              </button>
              <button
                role="tab"
                aria-selected={workspaceTopicTab === 'automation'}
                className={workspaceTopicTab === 'automation' ? 'workspace-top-tab is-active' : 'workspace-top-tab'}
                onClick={() => setWorkspaceTopicTab('automation')}
              >
                Automation & Missions
              </button>
          </div>

          {workspaceTopicTab === 'overview' && (
          <div className="workspace-topic-layout">
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
          </div>
          )}

          {workspaceTopicTab === 'polyglot' && (
          <div className="workspace-topic-layout workspace-topic-polyglot">
          <div className="decision-card polyglot-lab-card">
            <strong>Polyglot Runtime Lab</strong>
            <p>
              Run real local code in Python, C, C++, Java, Julia, R, and JavaScript from inside Paxion.
              Each language uses the runtime or compiler available on your machine.
            </p>
            <div className="workspace-actions">
              <button className="run-button" onClick={() => void refreshPolyglotStatus()}>
                Detect Local Runtimes
              </button>
              <button className="run-button" onClick={() => loadPolyglotStarter(polyglotLanguage)}>
                Load Starter
              </button>
              <button className="run-button" onClick={() => void runPolyglotBrainMesh()} disabled={polyglotBrainRunning}>
                {polyglotBrainRunning ? 'Running Brain Mesh...' : 'Run Brain Mesh'}
              </button>
              <button className="run-button" onClick={() => void runPolyglotLab()} disabled={polyglotRunning}>
                {polyglotRunning ? 'Running...' : 'Run Code'}
              </button>
            </div>
            {polyglotMessage && <p className="muted">{polyglotMessage}</p>}
            {polyglotStatusUpdatedAt && (
              <p className="muted">Runtime scan updated {new Date(polyglotStatusUpdatedAt).toLocaleTimeString()}</p>
            )}

            <div className="polyglot-status-grid">
              {(polyglotRuntimes.length > 0
                ? polyglotRuntimes
                : (Object.keys(POLYGLOT_LANGUAGE_LABELS) as PolyglotLanguage[]).map((language) => ({
                    language,
                    available: false,
                    command: null,
                    detail: 'Not scanned yet.',
                  }))
              ).map((runtime) => (
                <article className={runtime.available ? 'polyglot-runtime-card is-ready' : 'polyglot-runtime-card'} key={runtime.language}>
                  <strong>{POLYGLOT_LANGUAGE_LABELS[runtime.language as PolyglotLanguage] ?? runtime.language}</strong>
                  <p className="muted">{runtime.available ? 'Available' : 'Unavailable'}</p>
                  <p className="muted">{runtime.command ?? 'No runtime detected'}</p>
                  <p className="muted">{runtime.detail}</p>
                </article>
              ))}
            </div>

            <div className="polyglot-lab-grid">
              <div className="polyglot-side-panel">
                <div className="control-group">
                  <label htmlFor="polyglot-brain-objective">Brain mesh objective</label>
                  <textarea
                    id="polyglot-brain-objective"
                    className="lib-paste-area polyglot-stdin"
                    value={polyglotBrainObjective}
                    onChange={(event) => setPolyglotBrainObjective(event.target.value)}
                    rows={4}
                    placeholder="Describe what you want the language modules to advise on"
                  />
                </div>
                <div className="control-group">
                  <label htmlFor="polyglot-language">Language</label>
                  <select
                    id="polyglot-language"
                    value={polyglotLanguage}
                    onChange={(event) => setPolyglotLanguage(event.target.value as PolyglotLanguage)}
                  >
                    {Object.entries(POLYGLOT_LANGUAGE_LABELS).map(([language, label]) => (
                      <option key={language} value={language}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="control-group">
                  <label htmlFor="polyglot-args">Program args</label>
                  <input
                    id="polyglot-args"
                    value={polyglotArgsText}
                    onChange={(event) => setPolyglotArgsText(event.target.value)}
                    placeholder="Example: input.txt 42 --mode=test"
                  />
                </div>
                <div className="control-group">
                  <label htmlFor="polyglot-timeout">Timeout (ms)</label>
                  <input
                    id="polyglot-timeout"
                    value={polyglotTimeoutMs}
                    onChange={(event) => setPolyglotTimeoutMs(event.target.value)}
                    placeholder="20000"
                  />
                </div>
                <div className="control-group">
                  <label htmlFor="polyglot-stdin">STDIN</label>
                  <textarea
                    id="polyglot-stdin"
                    className="lib-paste-area polyglot-stdin"
                    value={polyglotStdin}
                    onChange={(event) => setPolyglotStdin(event.target.value)}
                    rows={6}
                    placeholder="Optional standard input for your program"
                  />
                </div>
                <div className="decision-card polyglot-runtime-focus">
                  <strong>Selected Runtime</strong>
                  <p className="muted">{selectedPolyglotRuntime?.command ?? 'Runtime not detected yet.'}</p>
                  <p className="muted">{selectedPolyglotRuntime?.detail ?? 'Run detection to see local toolchain details.'}</p>
                </div>
              </div>

              <div className="polyglot-editor-panel">
                <div className="control-group">
                  <label htmlFor="polyglot-code">Code</label>
                  <textarea
                    id="polyglot-code"
                    className="lib-paste-area polyglot-code-editor"
                    value={polyglotCode}
                    onChange={(event) => setPolyglotCode(event.target.value)}
                    rows={18}
                  />
                </div>
              </div>
            </div>

            {polyglotBrainResult && (
              <div className="polyglot-result-stack">
                <article className="learning-log-item">
                  <strong>Brain mesh summary</strong>
                  <p className="muted">Objective: {polyglotBrainResult.objective}</p>
                  <p className="muted">Completed: {polyglotBrainResult.completedCount}/{polyglotBrainResult.attemptedCount}</p>
                  <p className="muted">{polyglotBrainResult.summary}</p>
                </article>
                <div className="learning-log-list">
                  {polyglotBrainResult.results.map((item) => (
                    <article className="learning-log-item" key={`${item.language}-${item.reason}`}>
                      <strong>
                        {POLYGLOT_LANGUAGE_LABELS[item.language as PolyglotLanguage] ?? item.language} {item.ok ? 'active' : 'unavailable'}
                      </strong>
                      <p className="muted">{item.reason}</p>
                      {item.detail && (
                        <>
                          <p className="muted">Role: {String(item.detail.role ?? 'n/a')}</p>
                          <p className="muted">Recommendation: {String(item.detail.recommendation ?? 'n/a')}</p>
                          <p className="muted">
                            Strengths: {Array.isArray(item.detail.strengths) ? item.detail.strengths.join(', ') : 'n/a'}
                          </p>
                          <p className="muted">
                            Focus: {Array.isArray(item.detail.focusAreas) ? item.detail.focusAreas.join(', ') : 'n/a'}
                          </p>
                        </>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            )}

            {polyglotResult && (
              <div className="polyglot-result-stack">
                <article className="learning-log-item">
                  <strong>
                    {POLYGLOT_LANGUAGE_LABELS[polyglotResult.language as PolyglotLanguage] ?? polyglotResult.language} {polyglotResult.ok ? 'completed' : 'failed'}
                  </strong>
                  <p className="muted">Stage: {polyglotResult.stage}</p>
                  <p className="muted">Exit code: {polyglotResult.exitCode ?? 'n/a'}</p>
                  <p className="muted">Timed out: {polyglotResult.timedOut ? 'yes' : 'no'}</p>
                  {polyglotResult.artifactPath && <p className="muted">Artifact: {polyglotResult.artifactPath}</p>}
                  {polyglotResult.commands.length > 0 && (
                    <div className="polyglot-command-list">
                      {polyglotResult.commands.map((command) => (
                        <p className="muted" key={command}>{command}</p>
                      ))}
                    </div>
                  )}
                </article>
                <div className="polyglot-output-grid">
                  <article className="polyglot-output-card">
                    <strong>STDOUT</strong>
                    <pre className="polyglot-output">{polyglotResult.stdout || 'No stdout.'}</pre>
                  </article>
                  <article className="polyglot-output-card">
                    <strong>STDERR</strong>
                    <pre className="polyglot-output">{polyglotResult.stderr || 'No stderr.'}</pre>
                  </article>
                </div>
              </div>
            )}
          </div>
          </div>
          )}

          {workspaceTopicTab === 'youtube' && (
          <div className="workspace-topic-layout workspace-topic-youtube">
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
                placeholder="Example: Python, C, C++, Java, Julia, R, JavaScript core concepts"
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
              <button className="run-button" onClick={() => void refreshYoutubeSttStatus()} disabled={videoSttLoading}>
                {videoSttLoading ? 'Checking STT...' : 'Check STT Readiness'}
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

            {videoSttStatus && (
              <div className="decision-card">
                <strong>Speech-to-Text Readiness</strong>
                <p className="muted">
                  Status: {videoSttStatus.ready ? 'Ready' : 'Missing tools'}
                  {videoSttStatus.updatedAt ? ` | Checked: ${videoSttStatus.updatedAt}` : ''}
                </p>
                <div className="capability-list">
                  <div className="capability-item">
                    <span>yt-dlp</span>
                    <strong>{videoSttStatus.tools.ytDlp.available ? 'Ready' : 'Missing'}</strong>
                  </div>
                  <p className="muted">{videoSttStatus.tools.ytDlp.detail}</p>
                  <div className="capability-item">
                    <span>ffmpeg</span>
                    <strong>{videoSttStatus.tools.ffmpeg.available ? 'Ready' : 'Missing'}</strong>
                  </div>
                  <p className="muted">{videoSttStatus.tools.ffmpeg.detail}</p>
                  <div className="capability-item">
                    <span>whisper</span>
                    <strong>{videoSttStatus.tools.whisper.available ? 'Ready' : 'Missing'}</strong>
                  </div>
                  <p className="muted">{videoSttStatus.tools.whisper.detail}</p>
                </div>
              </div>
            )}

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
                        <button
                          className="run-button"
                          onClick={() => {
                            void autoLearnYoutubeBatch(plan.id)
                          }}
                        >
                          AI Learn Batch
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
                                  void autoLearnYoutubeSegment(plan.id, segment.id)
                                }}
                              >
                                AI Learn Segment
                              </button>
                              <button
                                className="run-button"
                                onClick={() => {
                                  setVideoTargetPlanId(plan.id)
                                  setVideoTargetSegmentId(segment.id)
                                }}
                              >
                                Manual Mark
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
                placeholder="Python Basics, C pointers, C++ STL, Java OOP, Julia arrays, R tidyverse, JavaScript async"
              />
            </div>
            <button className="run-button" onClick={() => void completeYoutubeSegmentLearning()}>
              Save Segment Learning
            </button>
          </div>
          </div>
          )}

          {workspaceTopicTab === 'automation' && (
          <div className="workspace-topic-layout workspace-topic-automation">
          <section className="automation-canvas-shell" aria-label="Automation flow canvas preview">
            <header className="automation-canvas-head">
              <div>
                <strong>Automation Canvas</strong>
                <p className="muted">
                  N8N-style flow preview generated from your intent and step script before execution.
                </p>
              </div>
              <div className="automation-readiness">
                <span className={automationFlowPreview.hasIntent ? 'status-chip is-ready' : 'status-chip'}>
                  Intent {automationFlowPreview.hasIntent ? 'ready' : 'missing'}
                </span>
                <span className={automationFlowPreview.hasTarget ? 'status-chip is-ready' : 'status-chip'}>
                  URL {automationFlowPreview.hasTarget ? 'ready' : 'missing'}
                </span>
                <span className={automationFlowPreview.hasStepCount ? 'status-chip is-ready' : 'status-chip'}>
                  Steps {automationFlowPreview.hasStepCount ? 'ready' : 'missing'}
                </span>
              </div>
            </header>

            <div className="automation-metrics">
              <article className="automation-metric-card">
                <span>Adapter</span>
                <strong>{automationAdapterId}</strong>
              </article>
              <article className="automation-metric-card">
                <span>Readiness</span>
                <strong>{automationFlowPreview.readiness}/3</strong>
              </article>
              <article className="automation-metric-card">
                <span>Parsed steps</span>
                <strong>{automationFlowPreview.parsedSteps.length}</strong>
              </article>
              <article className="automation-metric-card">
                <span>Target</span>
                <strong>{automationFlowPreview.target || 'Not set'}</strong>
              </article>
            </div>

            {Object.keys(automationFlowPreview.actionSummary).length > 0 && (
              <p className="muted">
                Action mix:{' '}
                {Object.entries(automationFlowPreview.actionSummary)
                  .map(([action, count]) => `${action} x${count}`)
                  .join(' | ')}
              </p>
            )}

            <div className="automation-node-lane" role="list">
              {automationFlowPreview.nodes.map((node, index) => (
                <article
                  key={node.id}
                  role="listitem"
                  className={`automation-node automation-node-${node.kind}`}
                >
                  <span className="automation-node-index">{index + 1}</span>
                  <strong>{node.title}</strong>
                  <p className="muted">{node.detail}</p>
                </article>
              ))}
            </div>
            {automationFlowPreview.connectors.length > 0 && (
              <p className="muted">
                Flow edges: {automationFlowPreview.connectors.join(' | ')}
              </p>
            )}
          </section>

          <div className="decision-card" id="ws-automation">
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
                placeholder="Example: Notes from Python/C/C++/Java/Julia/R/JavaScript lessons, CMS guide, design heuristics"
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
            <div className="control-group">
              <label htmlFor="target-app-key">Target app key (optional)</label>
              <input
                id="target-app-key"
                value={targetAppKey}
                onChange={(event) => setTargetAppKey(event.target.value)}
                placeholder="wordpress, github, figma, vscode"
              />
            </div>
            <div className="control-group">
              <label htmlFor="target-app-version">Target app version (optional)</label>
              <input
                id="target-app-version"
                value={targetAppVersion}
                onChange={(event) => setTargetAppVersion(event.target.value)}
                placeholder="Example: 6.7.1"
              />
            </div>
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
                        <button
                          className="run-button"
                          onClick={() => void executeRollbackTransactionById(session.id)}
                        >
                          Execute Rollback
                        </button>
                      </div>
                      {session.compatibilityProfile ? (
                        <p className="muted">Compatibility profile matched for versioned execution.</p>
                      ) : (
                        <p className="muted">Compatibility profile: default</p>
                      )}
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
            <strong>Native Execution Engine</strong>
            <p>
              Execute deterministic native actions with fallback selectors and automatic evidence capture
              on each action.
            </p>
            <div className="control-group">
              <label htmlFor="native-session-id">Session ID</label>
              <input
                id="native-session-id"
                value={nativeActionSessionId}
                onChange={(event) => setNativeActionSessionId(event.target.value)}
                placeholder="session-..."
              />
            </div>
            <div className="control-group">
              <label htmlFor="native-step-id">Step ID</label>
              <input
                id="native-step-id"
                value={nativeActionStepId}
                onChange={(event) => setNativeActionStepId(event.target.value)}
                placeholder="step-1"
              />
            </div>
            <div className="control-group">
              <label htmlFor="native-action-type">Action type</label>
              <select
                id="native-action-type"
                value={nativeActionType}
                onChange={(event) =>
                  setNativeActionType(
                    event.target.value as 'click' | 'fill' | 'select' | 'extractText' | 'command',
                  )
                }
              >
                <option value="click">click</option>
                <option value="fill">fill</option>
                <option value="select">select</option>
                <option value="extractText">extractText</option>
                <option value="command">command</option>
              </select>
            </div>
            <div className="control-group">
              <label htmlFor="native-selector">Primary selector</label>
              <input
                id="native-selector"
                value={nativeActionSelector}
                onChange={(event) => setNativeActionSelector(event.target.value)}
                placeholder="#publish"
              />
            </div>
            <div className="control-group">
              <label htmlFor="native-fallback">Fallback selectors (one per line)</label>
              <textarea
                id="native-fallback"
                className="lib-paste-area"
                value={nativeActionFallbackSelectors}
                onChange={(event) => setNativeActionFallbackSelectors(event.target.value)}
                rows={3}
              />
            </div>
            <div className="control-group">
              <label htmlFor="native-command">Allowlisted command (command action only)</label>
              <input
                id="native-command"
                value={nativeActionCommand}
                onChange={(event) => setNativeActionCommand(event.target.value)}
                placeholder="npm run lint"
              />
            </div>
            <div className="control-group">
              <label htmlFor="native-dom">DOM/state snapshot (optional)</label>
              <textarea
                id="native-dom"
                className="lib-paste-area"
                value={nativeActionDomSnapshot}
                onChange={(event) => setNativeActionDomSnapshot(event.target.value)}
                rows={3}
              />
            </div>
            <label className="muted">
              <input
                type="checkbox"
                checked={nativeActionPermission}
                onChange={(event) => setNativeActionPermission(event.target.checked)}
              />{' '}
              I give explicit permission to execute this native action.
            </label>
            <button className="run-button" onClick={() => void runNativeActionExecution()}>
              Execute Native Action
            </button>
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
            <div className="control-group">
              <label htmlFor="graph-query-text">Graph query text</label>
              <input
                id="graph-query-text"
                value={graphQueryText}
                onChange={(event) => setGraphQueryText(event.target.value)}
                placeholder="skill, evidence, cms"
              />
            </div>
            <div className="control-group">
              <label htmlFor="graph-query-kinds">Kinds filter (comma separated)</label>
              <input
                id="graph-query-kinds"
                value={graphQueryKinds}
                onChange={(event) => setGraphQueryKinds(event.target.value)}
                placeholder="skill,learning-log,execution"
              />
            </div>
            <div className="control-group">
              <label htmlFor="graph-query-edge">Edge kind filter</label>
              <input
                id="graph-query-edge"
                value={graphQueryEdgeKind}
                onChange={(event) => setGraphQueryEdgeKind(event.target.value)}
                placeholder="teaches, suggests, runs"
              />
            </div>
            <div className="workspace-actions">
              <button className="run-button" onClick={() => void queryLearningGraph()}>
                Query Graph
              </button>
              <button
                className="run-button"
                onClick={() => void queryLearningGraph(Math.max(0, graphCursor - 40))}
                disabled={graphCursor <= 0}
              >
                Prev Page
              </button>
              <button
                className="run-button"
                onClick={() => void queryLearningGraph(graphPage?.nextCursor ?? graphCursor)}
                disabled={graphPage?.nextCursor == null}
              >
                Next Page
              </button>
            </div>
            {graphPage && (
              <p className="muted">
                Page cursor {graphPage.cursor}, total nodes {graphPage.totalNodes}, total edges{' '}
                {graphPage.totalEdges}
              </p>
            )}
            {graphIndexStats && (
              <p className="muted">
                Index stats: source nodes {graphIndexStats.totalSourceNodes}, source edges{' '}
                {graphIndexStats.totalSourceEdges}, kinds {graphIndexStats.distinctKinds}
              </p>
            )}
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
            <div className="control-group">
              <label htmlFor="gov-pipeline-id">Governance sign pipeline ID</label>
              <input
                id="gov-pipeline-id"
                value={governancePipelineId}
                onChange={(event) => setGovernancePipelineId(event.target.value)}
                placeholder="evo-..."
              />
            </div>
            <div className="control-group">
              <label htmlFor="gov-note">Governance note</label>
              <textarea
                id="gov-note"
                className="lib-paste-area"
                value={governanceSignatureNote}
                onChange={(event) => setGovernanceSignatureNote(event.target.value)}
                rows={2}
              />
            </div>
            <div className="control-group">
              <label htmlFor="gov-tests">Tests passed</label>
              <input
                id="gov-tests"
                value={governanceTestsPassed}
                onChange={(event) => setGovernanceTestsPassed(event.target.value)}
                placeholder="5"
              />
            </div>
            <label className="muted">
              <input
                type="checkbox"
                checked={governanceLintPassed}
                onChange={(event) => setGovernanceLintPassed(event.target.checked)}
              />{' '}
              Lint passed
            </label>
            <label className="muted">
              <input
                type="checkbox"
                checked={governanceBuildPassed}
                onChange={(event) => setGovernanceBuildPassed(event.target.checked)}
              />{' '}
              Build passed
            </label>
            <button
              className="run-button"
              onClick={() => void signGovernanceForPipeline(governancePipelineId.trim())}
              disabled={!governancePipelineId.trim()}
            >
              Sign Governance Policy
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
                      {pipeline.governance && (
                        <p className="muted">
                          Gates: tests {pipeline.governance.metrics.testsPassed} | lint{' '}
                          {pipeline.governance.metrics.lintPassed ? 'pass' : 'fail'} | build{' '}
                          {pipeline.governance.metrics.buildPassed ? 'pass' : 'fail'} | signatures{' '}
                          {pipeline.governance.signatures.length}/
                          {pipeline.governance.requiredPolicySignatures}
                        </p>
                      )}
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
            <strong>Cryptographic Attestation</strong>
            <p>
              Manage attestation signing identity and verify active chain anchor for high-assurance
              evidence custody.
            </p>
            <p className="muted">
              Key fingerprint: {attestationFingerprint ? `${attestationFingerprint.slice(0, 24)}...` : 'unavailable'}
            </p>
            <p className="muted">
              Chain head: {attestationLastHash ? `${attestationLastHash.slice(0, 24)}...` : 'unavailable'}
            </p>
            <div className="control-group">
              <label htmlFor="attestation-rotation-reason">Rotation reason</label>
              <input
                id="attestation-rotation-reason"
                value={attestationRotationReason}
                onChange={(event) => setAttestationRotationReason(event.target.value)}
              />
            </div>
            <div className="workspace-actions">
              <button className="run-button" onClick={() => void refreshAttestationStatus()}>
                Refresh Status
              </button>
              <button className="run-button" onClick={() => void rotateAttestationKeyNow()}>
                Rotate Attestation Key
              </button>
            </div>
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
          )}
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

  const useModularControlShell = true
  if (useModularControlShell) {
    return (
      <ControlShell
        adminUnlocked={adminUnlocked}
        adminExpiresAt={adminExpiresAt}
        uiTheme={uiTheme}
        onToggleTheme={() => setUiTheme((prev) => (prev === 'night' ? 'day' : 'night'))}
        policySnapshot={policySnapshot}
        routerConfig={routerConfig}
        providerHealth={providerHealth}
        channels={gatewayChannels}
        onRoutingProfileChange={updateRoutingProfile}
        onProviderEnabledChange={updateProviderEnabled}
        onProviderKeyChange={updateProviderKey}
        auditEntries={auditEntries}
        learnedSkills={learnedSkills}
        totalDocuments={libDocs.length}
        totalWords={controlTotalWords}
        workspaceMissions={controlWorkspaceMissions}
        relay={{
          mode: relayMode,
          endpoint: cloudRelayEndpoint,
          deviceId: cloudRelayDeviceId,
          pollingEnabled: cloudRelayPollingEnabled,
          tokenConfigured: cloudRelayTokenConfigured,
          message: cloudRelayMessage,
          lastSyncAt: cloudRelayLastSyncAt,
          pendingRequests: cloudRelayRequests,
        }}
        bridge={{
          enabled: bridgeEnabled,
          host: bridgeHost,
          port: bridgePort,
          message: bridgeMessage,
          pendingRequests: bridgePendingRequests,
        }}
        onRefreshRelay={() => void loadRelayStatus()}
        onSyncRelay={() => void syncCloudRelayQueue()}
        onSubmitRelayHeartbeat={() => void submitCloudRelayPing()}
        onCompleteRelayRequest={(requestId) => void completeCloudRelayRequest(requestId)}
        onRefreshBridge={() => void loadBridgeStatus()}
        onToggleBridge={(enabled) => {
          if (enabled) {
            void startMobileBridge()
            return
          }
          void stopMobileBridge()
        }}
        desktopAdapterEnabled={featureFlags.desktopAdapterEnabled}
        cloudRelayEnabled={featureFlags.cloudRelayEnabled}
        onToggleDesktopAdapter={(enabled) => void setFeatureFlag({ desktopAdapterEnabled: enabled })}
        onToggleCloudRelay={(enabled) => void setFeatureFlag({ cloudRelayEnabled: enabled })}
        onAppendAudit={appendAudit}
      />
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
        <div className="hero-actions">
          <button
            className="run-button"
            onClick={() => setUiTheme((prev) => (prev === 'night' ? 'day' : 'night'))}
          >
            Theme: {uiTheme === 'night' ? 'Night' : 'Day'}
          </button>
        </div>
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

        <main className={`panel work-panel ${activeTab === 'workspace' ? 'work-panel-workspace' : ''}`} role="tabpanel" aria-label={activeTabMeta.name}>
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

      </section>

      <footer className="footer">
        <span>Profile: Paro the Chief</span>
        <span>Mode: Policy-Enforced Build</span>
        <span>Version: v0.19.0-safe-domain-expansion-bootstrap</span>
      </footer>
    </div>
  )
}

export default App
