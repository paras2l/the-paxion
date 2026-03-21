import type { AuditEntry, ActionRequest, PolicyDecision } from './security/types'
import type { LibraryDocument } from './library/types'

interface RaizenLibraryFileResult {
  name: string
  content: string
  path: string
  pageCount?: number
}

interface RaizenLibraryFileError {
  error: string
}

interface RaizenAdminUnlockResult {
  ok: boolean
  reason?: string
  unlocked?: boolean
  expiresAt?: number | null
}

interface RaizenAdminStatusResult {
  unlocked: boolean
  expiresAt: number | null
}

interface RaizenAuditLoadResult {
  ok: boolean
  reason?: string
  entries: AuditEntry[]
}

interface RaizenPolicyDecisionEnvelope {
  baseDecision: PolicyDecision
  finalDecision: PolicyDecision
  context: {
    adminSessionActive: boolean
    adminVerified: boolean
    approvalGranted: boolean
    approvalTicketId: string | null
    approvalExpiresAt: number | null
  }
}

interface RaizenActionExecutionEnvelope extends RaizenPolicyDecisionEnvelope {
  execution: {
    executed: boolean
    mode: string
    note?: string
    outputPath?: string
  }
}

interface RaizenWorkspaceState {
  goal: string
  plan: Array<Record<string, unknown>>
  updatedAt: string | null
}

interface RaizenWorkspaceLoadResult {
  ok: boolean
  reason?: string
  state: RaizenWorkspaceState
}

interface RaizenWorkspaceSaveResult {
  ok: boolean
  reason?: string
  updatedAt?: string
}

interface RaizenLibraryLoadResult {
  ok: boolean
  reason?: string
  docs: LibraryDocument[]
  updatedAt: string | null
}

interface RaizenLibrarySaveResult {
  ok: boolean
  reason?: string
  updatedAt?: string
}

type RaizenCapabilityState = {
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

interface RaizenAssistantRuntimeResult {
  ok?: boolean
  closeToTrayEnabled: boolean
}

interface RaizenVoiceCallResult {
  ok: boolean
  reason?: string
  emergency?: boolean
  url?: string
  provider?: string
  providerResult?: Record<string, unknown>
}

interface RaizenVoiceProviderResult {
  ok: boolean
  reason?: string
  provider?: string
  fromNumber?: string
  updatedAt?: string | null
}

interface RaizenVoiceSecretStatusResult {
  ok: boolean
  reason?: string
  hasTwilioSid?: boolean
  hasTwilioToken?: boolean
  hasTwilioFromNumber?: boolean
  hasSipUri?: boolean
  hasSipUsername?: boolean
  hasSipPassword?: boolean
  twilioFromNumber?: string
  sipUri?: string
  sipUsername?: string
  updatedAt?: string | null
}

interface RaizenTerminalPackResult {
  ok: boolean
  reason?: string
  pack?: Record<string, unknown>
  packs?: Array<Record<string, unknown>>
  updatedAt?: string | null
}

interface RaizenBridgeStatusResult {
  ok: boolean
  reason?: string
  enabled?: boolean
  host?: string
  port?: number
  hasSecret?: boolean
  secret?: string
  pendingRequests?: Array<Record<string, unknown>>
  updatedAt?: string | null
}

interface RaizenThreatDashboardResult {
  ok: boolean
  reason?: string
  dashboard?: Record<string, unknown>
}

interface RaizenRelayResult {
  ok: boolean
  reason?: string
  relay?: Record<string, unknown>
  request?: Record<string, unknown>
}

interface RaizenOptimizationResult {
  ok: boolean
  reason?: string
  optimization?: Record<string, unknown>
  report?: Record<string, unknown>
  state?: Record<string, unknown>
}

interface RaizenTerminalPlanResult {
  ok: boolean
  reason?: string
  plan?: Record<string, unknown>
}

interface RaizenTerminalRunResult {
  ok: boolean
  reason?: string
  command?: string
  assessment?: Record<string, unknown>
  execution?: Record<string, unknown>
}

interface RaizenAccessResult {
  ok: boolean
  reason?: string
  capabilities: RaizenCapabilityState
}

interface RaizenIntegrationsStatus {
  ok: boolean
  reason?: string
  desktopRelay: boolean
  googleReady: boolean
  gptReady: boolean
  requiresAdminApproval: boolean
}

interface RaizenGoogleSearchEnvelope {
  ok: boolean
  reason?: string
  opened?: boolean
  url?: string
}

interface RaizenGptChatEnvelope {
  ok: boolean
  reason?: string
  opened?: boolean
  url?: string
}

interface RaizenLearningEntry {
  id: string
  timestamp: string
  title: string
  detail: string
  source: string
  newSkills: string[]
}

interface RaizenVideoLearningSegment {
  id: string
  label: string
  startMinute: number
  endMinute: number
  status: string
  notes: string
}

interface RaizenVideoLearningPlan {
  id: string
  topic: string
  videoUrl: string
  durationMinutes: number
  segmentMinutes: number
  parallelSlots: number
  createdAt: string
  segments: RaizenVideoLearningSegment[]
}

interface RaizenLearningLoadResult {
  ok: boolean
  reason?: string
  skills: string[]
  logs: RaizenLearningEntry[]
  videoPlans: RaizenVideoLearningPlan[]
  updatedAt: string | null
  stateV2?: Record<string, unknown>
}


interface RaizenLearningRecordResult {
  ok: boolean
  entry?: RaizenLearningEntry
  skills: string[]
  videoPlans?: RaizenVideoLearningPlan[]
  updatedAt: string | null
}


interface RaizenAutomationTemplate {
  id: string
  appType: string
  name: string
  observe: string[]
  learnFocus: string
  skillSignals: string[]
}


interface RaizenExecutionRecord {
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


interface RaizenAutomationProfile {
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


interface RaizenAutomationProfilePreset {
  id: string
  profileId: string
  name: string
  variables: Record<string, string>
  updatedAt: string
}


interface RaizenCapabilitySuggestion {
  capability: string
  reason: string
  recommendedAction: string
  confidence: number
  matchedSkills: string[]
  unmetPrerequisites: string[]
  readyToEnable: boolean
}


interface RaizenReplayStepDiff {
  recordId: string
  originalIntendedStep: string
  replayIntendedStep: string
  originalPerformedStep: string
  replayPerformedStep: string
  originalResult: string
  replayResult: string
}


interface RaizenReplayPreview {
  previewToken: string
  sourceRecord: RaizenExecutionRecord
  relatedRecords: RaizenExecutionRecord[]
  targetUrl: string | null
  intent: string | null
  stepDiffs: RaizenReplayStepDiff[]
  expiresAt: number
}


interface RaizenAutomationLoadResult {
  ok: boolean
  reason?: string
  templates: RaizenAutomationTemplate[]
  profiles: RaizenAutomationProfile[]
  presets: RaizenAutomationProfilePreset[]
  records: RaizenExecutionRecord[]
  suggestions: RaizenCapabilitySuggestion[]
  updatedAt: string | null
}


interface RaizenTargetWorkflowPack {
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


interface RaizenExecutionSession {
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


interface RaizenObservationSnapshot {
  id: string
  createdAt: string
  title: string
  appType: string
  visibleText: string
  notes: string
  screenshotPath: string
  inferredSkills: string[]
}


interface RaizenCrossAppMissionPhase {
  id: string
  title: string
  surface: string
  objective: string
}


interface RaizenCrossAppMission {
  id: string
  goal: string
  surfaces: string[]
  recommendedPacks: Array<{ id: string; name: string; surface: string }>
  phases: RaizenCrossAppMissionPhase[]
  createdAt: string
  status: string
}


interface RaizenLearningGraphNode {
  id: string
  kind: string
  label: string
}


interface RaizenLearningGraphEdge {
  from: string
  to: string
  kind: string
}


interface RaizenLearningGraphSnapshot {
  nodes: RaizenLearningGraphNode[]
  edges: RaizenLearningGraphEdge[]
  updatedAt: string | null
}


interface RaizenEvolutionPipelineHistoryEntry {
  stage: string
  note: string
  timestamp: string
}


interface RaizenEvolutionPipeline {
  id: string
  title: string
  objective: string
  createdAt: string
  updatedAt: string
  currentStage: string
  stages: string[]
  history: RaizenEvolutionPipelineHistoryEntry[]
  artifactPath: string
}


interface RaizenVisionJob {
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


interface RaizenEvidenceArtifact {
  sessionId: string
  payloadHash: string
  jsonPath: string
  markdownPath: string
  screenshotHash: string | null
  attestationHash?: string
  signerFingerprint?: string
}


interface RaizenNativeActionResult {
  ok: boolean
  reason?: string
  record?: RaizenExecutionRecord
  commandOutput?: string
  executionSessions?: RaizenExecutionSession[]
  learningGraph?: RaizenLearningGraphSnapshot
  evidence?: Record<string, unknown> | null
  warnings?: string[]
}


interface RaizenReadinessLoadResult {
  ok: boolean
  reason?: string
  targetPacks: RaizenTargetWorkflowPack[]
  executionSessions: RaizenExecutionSession[]
  observations: RaizenObservationSnapshot[]
  missions: RaizenCrossAppMission[]
  learningGraph: RaizenLearningGraphSnapshot
  evolutionPipelines: RaizenEvolutionPipeline[]
  visionJobs: RaizenVisionJob[]
}


type RaizenAutomationStepInput = {
  action: 'fill' | 'click' | 'select' | 'wait' | 'extractText'
  selector?: string
  value?: string
  waitMs?: number
}

declare global {
  interface Window {
    readonly raizen?: {
      notify(input: { title?: string; body?: string }): Promise<{ ok: boolean; reason?: string }>
      ecosystem?: {
        register(plugin: any): Promise<{ ok: boolean; id?: string; reason?: string }>
        list(): Promise<{ ok: boolean; plugins: any[]; reason?: string }>
      }
      checkpoint?: {
        list(scriptId: string): Promise<{ ok: boolean; checkpoints: Array<{ id: string; scriptId: string; code: string; createdAt: string }>; reason?: string }>
        create(input: { scriptId: string; code: string }): Promise<{ ok: boolean; id?: string; reason?: string }>
      }
      medical?: {
        review(input: { medications: string[] }): Promise<{ ok: boolean; safe?: boolean; findings?: any[]; reviewedAt?: string; reason?: string }>
        adviceCheck(input: { confidence: number; threshold: number }): Promise<{ ok: boolean; allowed?: boolean; reason?: string }>
      }
      social?: {
        schedule(input: { platform: string; content: string; scheduledAt?: string }): Promise<{ ok: boolean; post?: Record<string, unknown>; reason?: string }>
        ideas(input: { topic: string; platform: string }): Promise<{ ok: boolean; ideas?: any[]; reason?: string }>
        analyze(input: { posts: any[] }): Promise<{ ok: boolean; summary?: Record<string, unknown>; reason?: string }>
        steps(input: { platform: string; content: string; mediaPath?: string }): Promise<{ ok: boolean; steps?: any[]; url?: string; reason?: string }>
      }
      voiceQuality?: {
        get(): Promise<{ ok: boolean; voice?: string; pitch?: number; rate?: number }>
        status(): Promise<{ ok: boolean; runtimeStatus?: string; reason?: string }>
        update(input: { voice?: string; pitch?: number; rate?: number; duplexEnabled?: boolean; interruptionHandling?: string; personaMemory?: string; prosody?: string }): Promise<{ ok: boolean; reason?: string }>
        evaluate(input: any): Promise<{ ok: boolean; reason?: string }>
      }
      automation: {
        load(): Promise<any>
        savePreset(input: any): Promise<any>
        deletePreset(input: any): Promise<any>
        previewReplay(input: any): Promise<any>
        runAdapter(input: any): Promise<any>
        observeLearn(input: any): Promise<any>
        replayRecord(input: any): Promise<any>
        suggestions(): Promise<any>
        puppeteer(input: any): Promise<any>
        email?: {
          send(input: { to: string; subject: string; body: string; auth?: { user: string; pass: string } }): Promise<{ ok: boolean; reason?: string }>
        }
      }
      swarm?: {
        start(input: { name: string; commands: string[] }): Promise<{ ok: boolean; reason?: string }>
        status(): Promise<{ ok: boolean; swarms: Array<Record<string, unknown>>; reason?: string }>
        kill(id: string): Promise<{ ok: boolean; reason?: string }>
      }
      admin: {
        unlock(codeword: string): Promise<RaizenAdminUnlockResult>
        status(): Promise<RaizenAdminStatusResult>
        lock(): Promise<RaizenAdminUnlockResult>
      }
      audit: {
        append(entry: AuditEntry): Promise<void>
        load(): Promise<RaizenAuditLoadResult>
      }
      policy: {
        evaluate(request: ActionRequest): Promise<PolicyDecision>
        decide(input: {
          request: ActionRequest
          adminCodeword?: string
        }): Promise<RaizenPolicyDecisionEnvelope>
      }
      action: {
        execute(input: {
          request: ActionRequest
          adminCodeword?: string
        }): Promise<RaizenActionExecutionEnvelope>
      }
      access: {
        load(): Promise<RaizenAccessResult>
        set(input: { key: keyof RaizenCapabilityState; enabled: boolean }): Promise<RaizenAccessResult>
      }
      integrations: {
        getStatus(): Promise<RaizenIntegrationsStatus>
        googleSearch(input: { query: string }): Promise<RaizenGoogleSearchEnvelope>
        gptChat(input: {
          query: string
        }): Promise<RaizenGptChatEnvelope>
      }
      messaging: {
        send(input: {
          number: string
          message: string
          whatsapp?: boolean
          emergency?: boolean
          fromNumber?: string
        }): Promise<{
          ok: boolean
          reason?: string
          providerResult?: Record<string, unknown>
        }>
      }
      learning: {
        load(): Promise<RaizenLearningLoadResult>
        record(input: {
          title: string
          detail: string
          source?: string
          newSkills?: string[]
        }): Promise<RaizenLearningRecordResult>
        youtubePlanCreate(input: {
          topic: string
          videoUrl: string
          durationMinutes: number
          segmentMinutes: number
          parallelSlots: number
          explicitPermission: boolean
        }): Promise<
          | { ok: true; plan: RaizenVideoLearningPlan; videoPlans: RaizenVideoLearningPlan[] }
          | { ok: false; reason: string }
        >
        youtubeSegmentOpen(input: {
          planId: string
          segmentId: string
        }): Promise<
          | { ok: true; url: string; videoPlans: RaizenVideoLearningPlan[] }
          | { ok: false; reason: string }
        >
        youtubeSegmentComplete(input: {
          planId: string
          segmentId: string
          summary: string
          newSkills?: string[]
        }): Promise<
          | {
            ok: true
            videoPlans: RaizenVideoLearningPlan[]
            skills: string[]
            updatedAt: string | null
          }
          | { ok: false; reason: string }
        >
      }
      learningV2: {
        update(input: {
          newSkills?: string[]
          successful?: boolean
          goal?: string
        }): Promise<{
          ok: boolean
          reason?: string
          state?: Record<string, unknown>
        }>
      }
      automation: {
        load(): Promise<RaizenAutomationLoadResult>
        savePreset(input: {
          profileId: string
          name: string
          variables: Record<string, string>
        }): Promise<
          | {
            ok: true
            preset: RaizenAutomationProfilePreset
            presets: RaizenAutomationProfilePreset[]
          }
          | { ok: false; reason: string }
        >
        deletePreset(input: { presetId: string }): Promise<
          | {
            ok: true
            presets: RaizenAutomationProfilePreset[]
          }
          | { ok: false; reason: string }
        >
        previewReplay(input: { recordId: string }): Promise<
          | {
            ok: true
            preview: RaizenReplayPreview
          }
          | { ok: false; reason: string }
        >
        runAdapter(input: {
          adapterId: 'browser.formFill.basic' | 'browser.clickFlow.basic'
          targetUrl: string
          intent: string
          steps: RaizenAutomationStepInput[]
          explicitPermission: boolean
        }): Promise<
          | {
            ok: true
            adapterId: string
            targetUrl: string
            records: RaizenExecutionRecord[]
            templates: RaizenAutomationTemplate[]
            profiles: RaizenAutomationProfile[]
            presets: RaizenAutomationProfilePreset[]
            executionRecords: RaizenExecutionRecord[]
            suggestions: RaizenCapabilitySuggestion[]
            skills: string[]
            updatedAt: string | null
          }
          | { ok: false; reason: string }
        >
        observeLearn(input: {
          templateId: string
          sourceKnowledge: string
        }): Promise<
          | {
            ok: true
            template: RaizenAutomationTemplate
            records: RaizenExecutionRecord[]
            templates: RaizenAutomationTemplate[]
            profiles: RaizenAutomationProfile[]
            presets: RaizenAutomationProfilePreset[]
            executionRecords: RaizenExecutionRecord[]
            suggestions: RaizenCapabilitySuggestion[]
            skills: string[]
            updatedAt: string | null
          }
          | { ok: false; reason: string }
        >
        replayRecord(input: {
          recordId: string
          previewToken: string
          explicitPermission: boolean
        }): Promise<
          | {
            ok: true
            replayRecord: RaizenExecutionRecord | null
            replayRecords: RaizenExecutionRecord[]
            executionRecords: RaizenExecutionRecord[]
            suggestions: RaizenCapabilitySuggestion[]
            updatedAt: string | null
          }
          | { ok: false; reason: string }
        >
        suggestions(): Promise<
          | { ok: true; suggestions: RaizenCapabilitySuggestion[] }
          | { ok: false; reason: string; suggestions: RaizenCapabilitySuggestion[] }
        >
      }
      readiness: {
        load(): Promise<RaizenReadinessLoadResult>
        runTargetPack(input: {
          packId: string
          variables: Record<string, string>
          explicitPermission: boolean
          appKey?: string
          appVersion?: string
        }): Promise<
          | {
            ok: true
            session: RaizenExecutionSession
            executionSessions: RaizenExecutionSession[]
            learningGraph: RaizenLearningGraphSnapshot
          }
          | { ok: false; reason: string }
        >
        verifySession(input: {
          sessionId: string
          evidence: string[]
          notes: string
          outcome: string
        }): Promise<
          | {
            ok: true
            session: RaizenExecutionSession
            executionSessions: RaizenExecutionSession[]
            learningGraph: RaizenLearningGraphSnapshot
          }
          | { ok: false; reason: string }
        >
        rollbackSession(input: { sessionId: string; notes: string }): Promise<
          | {
            ok: true
            session: RaizenExecutionSession
            executionSessions: RaizenExecutionSession[]
            learningGraph: RaizenLearningGraphSnapshot
          }
          | { ok: false; reason: string }
        >
        executeRollback(input: { sessionId: string; notes?: string }): Promise<
          | {
            ok: true
            session: RaizenExecutionSession | null
            transaction: Record<string, unknown>
            executionSessions: RaizenExecutionSession[]
            learningGraph: RaizenLearningGraphSnapshot
          }
          | { ok: false; reason: string }
        >
        executeNativeAction(input: {
          sessionId?: string
          stepId?: string
          action: 'click' | 'fill' | 'select' | 'extractText' | 'command'
          selector?: string
          fallbackSelectors?: string[]
          command?: string
          appType?: string
          appKey?: string
          appVersion?: string
          intendedStep?: string
          domSnapshot?: string
          explicitPermission: boolean
        }): Promise<RaizenNativeActionResult>
        captureStepEvidence(input: {
          sessionId: string
          stepId: string
          reason?: string
          domSnapshot?: string
          commandOutput?: string
          screenshotPath?: string
          autoScreenshot?: boolean
          metadata?: Record<string, unknown>
        }): Promise<
          | {
            ok: true
            session: RaizenExecutionSession | null
            evidence: Record<string, unknown>
            executionSessions: RaizenExecutionSession[]
            learningGraph: RaizenLearningGraphSnapshot
          }
          | { ok: false; reason: string }
        >
        captureObservation(input: {
          title: string
          appType: string
          visibleText: string
          notes: string
          screenshotPath: string
        }): Promise<
          | {
            ok: true
            snapshot: RaizenObservationSnapshot
            observations: RaizenObservationSnapshot[]
            learningGraph: RaizenLearningGraphSnapshot
            skills: string[]
          }
          | { ok: false; reason: string }
        >
        planMission(input: { goal: string; surfaces: string[] }): Promise<
          | { ok: true; mission: RaizenCrossAppMission; missions: RaizenCrossAppMission[] }
          | { ok: false; reason: string }
        >
        graph(): Promise<
          | { ok: true; learningGraph: RaizenLearningGraphSnapshot }
          | { ok: false; reason: string; learningGraph: RaizenLearningGraphSnapshot }
        >
        queryGraph(input: {
          text?: string
          kinds?: string[]
          nodeId?: string
          edgeKind?: string
          cursor?: number
          limit?: number
        }): Promise<
          | {
            ok: true
            learningGraph: RaizenLearningGraphSnapshot
            page: {
              cursor: number
              nextCursor: number | null
              limit: number
              totalNodes: number
              totalEdges: number
            }
            indexStats: {
              totalSourceNodes: number
              totalSourceEdges: number
              distinctKinds: number
            }
          }
          | {
            ok: false
            reason: string
            learningGraph: RaizenLearningGraphSnapshot
            page: {
              cursor: number
              nextCursor: number | null
              limit: number
              totalNodes: number
              totalEdges: number
            }
            indexStats: {
              totalSourceNodes: number
              totalSourceEdges: number
              distinctKinds: number
            }
          }
        >
        attestationStatus(): Promise<
          | {
            ok: true
            status: {
              publicKeyFingerprint: string
              lastEntryHash: string
              hasChain: boolean
            }
          }
          | { ok: false; reason: string }
        >
        rotateAttestationKey(input: { reason?: string }): Promise<
          | {
            ok: true
            rotation: {
              previousFingerprint: string
              currentFingerprint: string
              lastEntryHash: string
            }
          }
          | { ok: false; reason: string }
        >
        createEvolutionPipeline(input: {
          title: string
          objective: string
          note: string
        }): Promise<
          | { ok: true; pipeline: RaizenEvolutionPipeline; evolutionPipelines: RaizenEvolutionPipeline[] }
          | { ok: false; reason: string }
        >
        advanceEvolutionPipeline(input: { pipelineId: string; note: string }): Promise<
          | { ok: true; pipeline: RaizenEvolutionPipeline; evolutionPipelines: RaizenEvolutionPipeline[] }
          | { ok: false; reason: string }
        >
        signGovernancePolicy(input: {
          pipelineId: string
          note: string
          testsPassed?: number
          lintPassed?: boolean
          buildPassed?: boolean
        }): Promise<
          | {
            ok: true
            pipeline: RaizenEvolutionPipeline
            attestation: {
              entryHash: string
              publicKeyFingerprint: string
            }
            evolutionPipelines: RaizenEvolutionPipeline[]
          }
          | { ok: false; reason: string }
        >
        createVisionJob(input: {
          objective: string
          screenshotPath: string
          extractedText: string
          notes: string
        }): Promise<
          | {
            ok: true
            job: RaizenVisionJob
            visionJobs: RaizenVisionJob[]
            learningGraph: RaizenLearningGraphSnapshot
          }
          | { ok: false; reason: string }
        >
        reviewVisionJob(input: { jobId: string; notes: string }): Promise<
          | {
            ok: true
            job: RaizenVisionJob
            visionJobs: RaizenVisionJob[]
            learningGraph: RaizenLearningGraphSnapshot
          }
          | { ok: false; reason: string }
        >
        runOcr(input: {
          jobId?: string
          imagePath?: string
          language?: string
          objective?: string
          notes?: string
          sessionId?: string
        }): Promise<
          | {
            ok: true
            job: RaizenVisionJob | null
            extractedText: string
            confidence: number
            language: string
            visionJobs: RaizenVisionJob[]
            learningGraph: RaizenLearningGraphSnapshot
            skills: string[]
          }
          | { ok: false; reason: string }
        >
        createEvidenceArtifact(input: {
          sessionId: string
          summary: string
          notes: string
          evidence: string[]
          domSnapshot?: string
          commandOutput?: string
          screenshotPath?: string
        }): Promise<
          | {
            ok: true
            artifact: RaizenEvidenceArtifact
            session: RaizenExecutionSession | null
            executionSessions: RaizenExecutionSession[]
            learningGraph: RaizenLearningGraphSnapshot
          }
          | { ok: false; reason: string }
        >
      }
      program: {
        status(): Promise<
          | {
            ok: true
            policySnapshotHash: string
            complianceMode: string
            domains: Record<string, boolean>
            updatedAt: string
          }
          | { ok: false; reason: string }
        >
      }
      devices: {
        list(): Promise<{ ok: boolean; reason?: string; devices: Array<Record<string, unknown>> }>
        register(input: {
          id: string
          name: string
          platform: string
          publicKeyFingerprint: string
        }): Promise<{ ok: boolean; reason?: string; device?: Record<string, unknown>; devices: Array<Record<string, unknown>> }>
        revoke(input: { deviceId: string }): Promise<{ ok: boolean; reason?: string; device?: Record<string, unknown>; devices: Array<Record<string, unknown>> }>
      }
      learningV2: {
        update(input: {
          newSkills?: string[]
          successful?: boolean
          goal?: string
        }): Promise<{ ok: boolean; reason?: string; learningV2?: Record<string, unknown> }>
      }
      trading: {
        backtest(input: { prices: number[] }): Promise<{ ok: boolean; reason?: string; backtest?: Record<string, unknown>; tradingState?: Record<string, unknown> }>
        paperOrder(input: {
          symbol: string
          side: 'buy' | 'sell'
          quantity: number
          price: number
        }): Promise<{ ok: boolean; reason?: string; order?: Record<string, unknown>; tradingState?: Record<string, unknown> }>
      }
      medical: {
        review(input: {
          medications: string[]
          confidence?: number
          threshold?: number
        }): Promise<{
          ok: boolean
          reason?: string
          safety?: Record<string, unknown>
          confidence?: Record<string, unknown>
          medicalState?: Record<string, unknown>
        }>
      }
      media: {
        generate(input: {
          type: 'image' | 'video' | 'voice'
          prompt: string
          artifactPath?: string
        }): Promise<{ ok: boolean; reason?: string; job?: Record<string, unknown>; mediaState?: Record<string, unknown> }>
      }
      assistant: {
        getRuntime(): Promise<RaizenAssistantRuntimeResult>
        setRuntime(input: { closeToTrayEnabled: boolean }): Promise<RaizenAssistantRuntimeResult>
        showWindow(): Promise<{ ok: boolean }>
      }
      voice: {
        call(input: {
          number?: string
          contact?: string
          emergency?: boolean
          provider?: 'desktop-relay' | 'twilio' | 'sip'
          fromNumber?: string
          message?: string
        }): Promise<RaizenVoiceCallResult>
        getProvider(): Promise<RaizenVoiceProviderResult>
        setProvider(input: {
          provider: 'desktop-relay' | 'twilio' | 'sip'
          fromNumber?: string
        }): Promise<RaizenVoiceProviderResult>
        getSecrets(): Promise<RaizenVoiceSecretStatusResult>
        setSecrets(input: {
          twilioAccountSid?: string
          twilioAuthToken?: string
          twilioFromNumber?: string
          sipUri?: string
          sipUsername?: string
          sipPassword?: string
        }): Promise<RaizenVoiceSecretStatusResult>
      }
      workflow: {
        generate(input: {
          goal: string
          knowledgeText?: string
        }): Promise<{ ok: boolean; reason?: string; workflow?: Record<string, unknown>; learningGraph?: Record<string, unknown>; skills?: string[] }>
      }
      terminal: {
        plan(input: {
          command: string
        }): Promise<RaizenTerminalPlanResult>
        run(input: {
          command: string
        }): Promise<RaizenTerminalRunResult>
        listPacks(): Promise<RaizenTerminalPackResult>
          listPacks(): Promise<RaizenTerminalPackResult>
        createPack(input: {
          name: string
          commands: string[]
          active?: boolean
        }): Promise<RaizenTerminalPackResult>
        activatePack(input: {
          packId: string
          active: boolean
        }): Promise<RaizenTerminalPackResult>
        simulatePack(input: {
          commands: string[]
        }): Promise<{ ok: boolean; reason?: string; simulation?: Record<string, unknown> }>
      }
      creative: {
        ideate(input: {
          domain: string
          objective: string
          knowledgeText?: string
        }): Promise<{ ok: boolean; reason?: string; lab?: Record<string, unknown>; learningGraph?: Record<string, unknown>; skills?: string[] }>
      }
      bridge: {
        status(): Promise<RaizenBridgeStatusResult>
          status(): Promise<RaizenBridgeStatusResult>
        start(input: {
          host?: string
          port?: number
          secret?: string
        }): Promise<RaizenBridgeStatusResult>
        stop(): Promise<RaizenBridgeStatusResult>
          stop(): Promise<RaizenBridgeStatusResult>
        approve(input: {
          requestId: string
          approved: boolean
          adminCodeword: string
        }): Promise<{ ok: boolean; reason?: string; request?: Record<string, unknown> }>
        rotateSecret(): Promise<RaizenBridgeStatusResult>
          rotateSecret(): Promise<RaizenBridgeStatusResult>
        issueToken(input: {
          purpose?: string
          ttlMs?: number
        }): Promise<{ ok: boolean; reason?: string; token?: Record<string, unknown> }>
      }
      security: {
        threatDashboard(input?: {
          request?: ActionRequest
        }): Promise<RaizenThreatDashboardResult>
      }
      voiceQuality: {
        status(): Promise<{ ok: boolean; state?: Record<string, unknown> }>
        update(input: {
          duplexEnabled?: boolean
          interruptionHandling?: string
          personaMemory?: string
          prosody?: string
        }): Promise<{ ok: boolean; reason?: string; profile?: Record<string, unknown>; state?: Record<string, unknown> }>
        evaluate(input: {
          interruptions?: number
          latencyMs?: number
        }): Promise<{ ok: boolean; session?: Record<string, unknown> }>
      }
      optimization: {
        status(): Promise<RaizenOptimizationResult>
          status(): Promise<RaizenOptimizationResult>
        run(input?: {
          autoTune?: boolean
          falseWakeCount?: number
          missedWakeCount?: number
        }): Promise<RaizenOptimizationResult>
      }
      relay: {
        status(): Promise<RaizenRelayResult>
          status(): Promise<RaizenRelayResult>
        configure(input: {
          mode?: string
          endpoint?: string
          deviceId?: string
          pollingEnabled?: boolean
          token?: string
          clearToken?: boolean
        }): Promise<RaizenRelayResult>
        submit(input: {
          request?: Record<string, unknown>
        }): Promise<RaizenRelayResult>
        sync(): Promise<RaizenRelayResult>
        complete(input: {
          requestId: string
          state?: string
          result?: Record<string, unknown>
        }): Promise<RaizenRelayResult>
        envelope(input: {
          requestId?: string
          actionId?: string
        }): Promise<{ ok: boolean; reason?: string; envelope?: Record<string, unknown> }>
      }
      wakeword: {
        status(): Promise<{ ok: boolean; status?: Record<string, unknown> }>
        configure(input: {
          provider?: string
          keyword?: string
          executablePath?: string
          modelPath?: string
          accessKey?: string
          sensitivity?: number
          alwaysOn?: boolean
          detectionMode?: string
        }): Promise<{ ok: boolean; reason?: string; status?: Record<string, unknown>; adapter?: Record<string, unknown>; state?: Record<string, unknown> }>
      }
      perception: {
        sceneGraph(input: {
          objects?: string[]
          relations?: string[]
          grounding?: string
        }): Promise<{ ok: boolean; reason?: string; sceneGraph?: Record<string, unknown> }>
        groundFrame(input: {
          frameId?: string
          summary?: string
          confidence?: number
          realtime?: boolean
          labels?: string[]
          width?: number
          height?: number
          source?: string
        }): Promise<{ ok: boolean; reason?: string; frame?: Record<string, unknown> }>
      }
      workspace: {
        load(): Promise<RaizenWorkspaceLoadResult>
        save(input: { goal: string; plan: Array<Record<string, unknown>> }): Promise<RaizenWorkspaceSaveResult>
        clear(): Promise<{ ok: boolean; reason?: string }>
      }
      library: {
        pickFile(): Promise<RaizenLibraryFileResult | RaizenLibraryFileError | null>
        load(): Promise<RaizenLibraryLoadResult>
        save(input: { docs: LibraryDocument[] }): Promise<RaizenLibrarySaveResult>
        clear(): Promise<{ ok: boolean; reason?: string }>
      }
      swarm: {
        start(input: { name?: string; commands: string[] }): Promise<{ ok: boolean; reason?: string; task?: Record<string, unknown> }>
        status(): Promise<{ ok: boolean; swarms?: Array<Record<string, unknown>> }>
      }
      notify(input: { title: string; body: string }): Promise<{ ok: boolean; reason?: string }>
    }
  }
}

export { }
