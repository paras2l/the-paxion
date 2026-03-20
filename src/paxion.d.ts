import type { AuditEntry, ActionRequest, PolicyDecision } from './security/types'
import type { LibraryDocument } from './library/types'

interface PaxionLibraryFileResult {
  name: string
  content: string
  path: string
  pageCount?: number
}

interface PaxionLibraryFileError {
  error: string
}

interface PaxionAdminUnlockResult {
  ok: boolean
  reason?: string
  unlocked?: boolean
  expiresAt?: number | null
}

interface PaxionAdminStatusResult {
  unlocked: boolean
  expiresAt: number | null
}

interface PaxionAuditLoadResult {
  ok: boolean
  reason?: string
  entries: AuditEntry[]
}

interface PaxionPolicyDecisionEnvelope {
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

interface PaxionActionExecutionEnvelope extends PaxionPolicyDecisionEnvelope {
  execution: {
    executed: boolean
    mode: string
    note?: string
    outputPath?: string
  }
}

interface PaxionWorkspaceState {
  goal: string
  plan: Array<Record<string, unknown>>
  updatedAt: string | null
}

interface PaxionWorkspaceLoadResult {
  ok: boolean
  reason?: string
  state: PaxionWorkspaceState
}

interface PaxionWorkspaceSaveResult {
  ok: boolean
  reason?: string
  updatedAt?: string
}

interface PaxionLibraryLoadResult {
  ok: boolean
  reason?: string
  docs: LibraryDocument[]
  updatedAt: string | null
}

interface PaxionLibrarySaveResult {
  ok: boolean
  reason?: string
  updatedAt?: string
}

type PaxionCapabilityState = {
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

interface PaxionAssistantRuntimeResult {
  ok?: boolean
  closeToTrayEnabled: boolean
}

interface PaxionVoiceCallResult {
  ok: boolean
  reason?: string
  emergency?: boolean
  url?: string
  provider?: string
  providerResult?: Record<string, unknown>
}

interface PaxionVoiceProviderResult {
  ok: boolean
  reason?: string
  provider?: string
  fromNumber?: string
  updatedAt?: string | null
}

interface PaxionVoiceSecretStatusResult {
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

interface PaxionTerminalPackResult {
  ok: boolean
  reason?: string
  pack?: Record<string, unknown>
  packs?: Array<Record<string, unknown>>
  updatedAt?: string | null
}

interface PaxionBridgeStatusResult {
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

interface PaxionThreatDashboardResult {
  ok: boolean
  reason?: string
  dashboard?: Record<string, unknown>
}

interface PaxionRelayResult {
  ok: boolean
  reason?: string
  relay?: Record<string, unknown>
  request?: Record<string, unknown>
}

interface PaxionOptimizationResult {
  ok: boolean
  reason?: string
  optimization?: Record<string, unknown>
  report?: Record<string, unknown>
  state?: Record<string, unknown>
}

interface PaxionTerminalPlanResult {
  ok: boolean
  reason?: string
  plan?: Record<string, unknown>
}

interface PaxionTerminalRunResult {
  ok: boolean
  reason?: string
  command?: string
  assessment?: Record<string, unknown>
  execution?: Record<string, unknown>
}

interface PaxionAccessResult {
  ok: boolean
  reason?: string
  capabilities: PaxionCapabilityState
}

interface PaxionIntegrationsStatus {
  ok: boolean
  reason?: string
  desktopRelay: boolean
  googleReady: boolean
  gptReady: boolean
  requiresAdminApproval: boolean
}

interface PaxionGoogleSearchEnvelope {
  ok: boolean
  reason?: string
  opened?: boolean
  url?: string
}

interface PaxionGptChatEnvelope {
  ok: boolean
  reason?: string
  opened?: boolean
  url?: string
}

interface PaxionLearningEntry {
  id: string
  timestamp: string
  title: string
  detail: string
  source: string
  newSkills: string[]
}

interface PaxionVideoLearningSegment {
  id: string
  label: string
  startMinute: number
  endMinute: number
  status: string
  notes: string
}

interface PaxionVideoLearningPlan {
  id: string
  topic: string
  videoUrl: string
  durationMinutes: number
  segmentMinutes: number
  parallelSlots: number
  createdAt: string
  segments: PaxionVideoLearningSegment[]
}

interface PaxionLearningLoadResult {
  ok: boolean
  reason?: string
  skills: string[]
  logs: PaxionLearningEntry[]
  videoPlans: PaxionVideoLearningPlan[]
  updatedAt: string | null
  stateV2?: Record<string, unknown>
}

interface PaxionLearningRecordResult {
  ok: boolean
  entry?: PaxionLearningEntry
  skills: string[]
  videoPlans?: PaxionVideoLearningPlan[]
  updatedAt: string | null
}

interface PaxionAutomationTemplate {
  id: string
  appType: string
  name: string
  observe: string[]
  learnFocus: string
  skillSignals: string[]
}

interface PaxionExecutionRecord {
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

interface PaxionAutomationProfile {
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

interface PaxionAutomationProfilePreset {
  id: string
  profileId: string
  name: string
  variables: Record<string, string>
  updatedAt: string
}

interface PaxionCapabilitySuggestion {
  capability: string
  reason: string
  recommendedAction: string
  confidence: number
  matchedSkills: string[]
  unmetPrerequisites: string[]
  readyToEnable: boolean
}

interface PaxionReplayStepDiff {
  recordId: string
  originalIntendedStep: string
  replayIntendedStep: string
  originalPerformedStep: string
  replayPerformedStep: string
  originalResult: string
  replayResult: string
}

interface PaxionReplayPreview {
  previewToken: string
  sourceRecord: PaxionExecutionRecord
  relatedRecords: PaxionExecutionRecord[]
  targetUrl: string | null
  intent: string | null
  stepDiffs: PaxionReplayStepDiff[]
  expiresAt: number
}

interface PaxionAutomationLoadResult {
  ok: boolean
  reason?: string
  templates: PaxionAutomationTemplate[]
  profiles: PaxionAutomationProfile[]
  presets: PaxionAutomationProfilePreset[]
  records: PaxionExecutionRecord[]
  suggestions: PaxionCapabilitySuggestion[]
  updatedAt: string | null
}

interface PaxionTargetWorkflowPack {
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

interface PaxionExecutionSession {
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

interface PaxionObservationSnapshot {
  id: string
  createdAt: string
  title: string
  appType: string
  visibleText: string
  notes: string
  screenshotPath: string
  inferredSkills: string[]
}

interface PaxionCrossAppMissionPhase {
  id: string
  title: string
  surface: string
  objective: string
}

interface PaxionCrossAppMission {
  id: string
  goal: string
  surfaces: string[]
  recommendedPacks: Array<{ id: string; name: string; surface: string }>
  phases: PaxionCrossAppMissionPhase[]
  createdAt: string
  status: string
}

interface PaxionLearningGraphNode {
  id: string
  kind: string
  label: string
}

interface PaxionLearningGraphEdge {
  from: string
  to: string
  kind: string
}

interface PaxionLearningGraphSnapshot {
  nodes: PaxionLearningGraphNode[]
  edges: PaxionLearningGraphEdge[]
  updatedAt: string | null
}

interface PaxionEvolutionPipelineHistoryEntry {
  stage: string
  note: string
  timestamp: string
}

interface PaxionEvolutionPipeline {
  id: string
  title: string
  objective: string
  createdAt: string
  updatedAt: string
  currentStage: string
  stages: string[]
  history: PaxionEvolutionPipelineHistoryEntry[]
  artifactPath: string
}

interface PaxionVisionJob {
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

interface PaxionEvidenceArtifact {
  sessionId: string
  payloadHash: string
  jsonPath: string
  markdownPath: string
  screenshotHash: string | null
  attestationHash?: string
  signerFingerprint?: string
}

interface PaxionNativeActionResult {
  ok: boolean
  reason?: string
  record?: PaxionExecutionRecord
  commandOutput?: string
  executionSessions?: PaxionExecutionSession[]
  learningGraph?: PaxionLearningGraphSnapshot
  evidence?: Record<string, unknown> | null
  warnings?: string[]
}

interface PaxionReadinessLoadResult {
  ok: boolean
  reason?: string
  targetPacks: PaxionTargetWorkflowPack[]
  executionSessions: PaxionExecutionSession[]
  observations: PaxionObservationSnapshot[]
  missions: PaxionCrossAppMission[]
  learningGraph: PaxionLearningGraphSnapshot
  evolutionPipelines: PaxionEvolutionPipeline[]
  visionJobs: PaxionVisionJob[]
}

type PaxionAutomationStepInput = {
  action: 'fill' | 'click' | 'select' | 'wait' | 'extractText'
  selector?: string
  value?: string
  waitMs?: number
}

declare global {
  interface Window {
    readonly paxion?: {
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
        unlock(codeword: string): Promise<PaxionAdminUnlockResult>
        status(): Promise<PaxionAdminStatusResult>
        lock(): Promise<PaxionAdminUnlockResult>
      }
      audit: {
        append(entry: AuditEntry): Promise<void>
        load(): Promise<PaxionAuditLoadResult>
      }
      policy: {
        evaluate(request: ActionRequest): Promise<PolicyDecision>
        decide(input: {
          request: ActionRequest
          adminCodeword?: string
        }): Promise<PaxionPolicyDecisionEnvelope>
      }
      action: {
        execute(input: {
          request: ActionRequest
          adminCodeword?: string
        }): Promise<PaxionActionExecutionEnvelope>
      }
      access: {
        load(): Promise<PaxionAccessResult>
        set(input: { key: keyof PaxionCapabilityState; enabled: boolean }): Promise<PaxionAccessResult>
      }
      integrations: {
        getStatus(): Promise<PaxionIntegrationsStatus>
        googleSearch(input: { query: string }): Promise<PaxionGoogleSearchEnvelope>
        gptChat(input: {
          query: string
        }): Promise<PaxionGptChatEnvelope>
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
        load(): Promise<PaxionLearningLoadResult>
        record(input: {
          title: string
          detail: string
          source?: string
          newSkills?: string[]
        }): Promise<PaxionLearningRecordResult>
        youtubePlanCreate(input: {
          topic: string
          videoUrl: string
          durationMinutes: number
          segmentMinutes: number
          parallelSlots: number
          explicitPermission: boolean
        }): Promise<
          | { ok: true; plan: PaxionVideoLearningPlan; videoPlans: PaxionVideoLearningPlan[] }
          | { ok: false; reason: string }
        >
        youtubeSegmentOpen(input: {
          planId: string
          segmentId: string
        }): Promise<
          | { ok: true; url: string; videoPlans: PaxionVideoLearningPlan[] }
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
            videoPlans: PaxionVideoLearningPlan[]
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
        load(): Promise<PaxionAutomationLoadResult>
        savePreset(input: {
          profileId: string
          name: string
          variables: Record<string, string>
        }): Promise<
          | {
            ok: true
            preset: PaxionAutomationProfilePreset
            presets: PaxionAutomationProfilePreset[]
          }
          | { ok: false; reason: string }
        >
        deletePreset(input: { presetId: string }): Promise<
          | {
            ok: true
            presets: PaxionAutomationProfilePreset[]
          }
          | { ok: false; reason: string }
        >
        previewReplay(input: { recordId: string }): Promise<
          | {
            ok: true
            preview: PaxionReplayPreview
          }
          | { ok: false; reason: string }
        >
        runAdapter(input: {
          adapterId: 'browser.formFill.basic' | 'browser.clickFlow.basic'
          targetUrl: string
          intent: string
          steps: PaxionAutomationStepInput[]
          explicitPermission: boolean
        }): Promise<
          | {
            ok: true
            adapterId: string
            targetUrl: string
            records: PaxionExecutionRecord[]
            templates: PaxionAutomationTemplate[]
            profiles: PaxionAutomationProfile[]
            presets: PaxionAutomationProfilePreset[]
            executionRecords: PaxionExecutionRecord[]
            suggestions: PaxionCapabilitySuggestion[]
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
            template: PaxionAutomationTemplate
            records: PaxionExecutionRecord[]
            templates: PaxionAutomationTemplate[]
            profiles: PaxionAutomationProfile[]
            presets: PaxionAutomationProfilePreset[]
            executionRecords: PaxionExecutionRecord[]
            suggestions: PaxionCapabilitySuggestion[]
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
            replayRecord: PaxionExecutionRecord | null
            replayRecords: PaxionExecutionRecord[]
            executionRecords: PaxionExecutionRecord[]
            suggestions: PaxionCapabilitySuggestion[]
            updatedAt: string | null
          }
          | { ok: false; reason: string }
        >
        suggestions(): Promise<
          | { ok: true; suggestions: PaxionCapabilitySuggestion[] }
          | { ok: false; reason: string; suggestions: PaxionCapabilitySuggestion[] }
        >
      }
      readiness: {
        load(): Promise<PaxionReadinessLoadResult>
        runTargetPack(input: {
          packId: string
          variables: Record<string, string>
          explicitPermission: boolean
          appKey?: string
          appVersion?: string
        }): Promise<
          | {
            ok: true
            session: PaxionExecutionSession
            executionSessions: PaxionExecutionSession[]
            learningGraph: PaxionLearningGraphSnapshot
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
            session: PaxionExecutionSession
            executionSessions: PaxionExecutionSession[]
            learningGraph: PaxionLearningGraphSnapshot
          }
          | { ok: false; reason: string }
        >
        rollbackSession(input: { sessionId: string; notes: string }): Promise<
          | {
            ok: true
            session: PaxionExecutionSession
            executionSessions: PaxionExecutionSession[]
            learningGraph: PaxionLearningGraphSnapshot
          }
          | { ok: false; reason: string }
        >
        executeRollback(input: { sessionId: string; notes?: string }): Promise<
          | {
            ok: true
            session: PaxionExecutionSession | null
            transaction: Record<string, unknown>
            executionSessions: PaxionExecutionSession[]
            learningGraph: PaxionLearningGraphSnapshot
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
        }): Promise<PaxionNativeActionResult>
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
            session: PaxionExecutionSession | null
            evidence: Record<string, unknown>
            executionSessions: PaxionExecutionSession[]
            learningGraph: PaxionLearningGraphSnapshot
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
            snapshot: PaxionObservationSnapshot
            observations: PaxionObservationSnapshot[]
            learningGraph: PaxionLearningGraphSnapshot
            skills: string[]
          }
          | { ok: false; reason: string }
        >
        planMission(input: { goal: string; surfaces: string[] }): Promise<
          | { ok: true; mission: PaxionCrossAppMission; missions: PaxionCrossAppMission[] }
          | { ok: false; reason: string }
        >
        graph(): Promise<
          | { ok: true; learningGraph: PaxionLearningGraphSnapshot }
          | { ok: false; reason: string; learningGraph: PaxionLearningGraphSnapshot }
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
            learningGraph: PaxionLearningGraphSnapshot
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
            learningGraph: PaxionLearningGraphSnapshot
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
          | { ok: true; pipeline: PaxionEvolutionPipeline; evolutionPipelines: PaxionEvolutionPipeline[] }
          | { ok: false; reason: string }
        >
        advanceEvolutionPipeline(input: { pipelineId: string; note: string }): Promise<
          | { ok: true; pipeline: PaxionEvolutionPipeline; evolutionPipelines: PaxionEvolutionPipeline[] }
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
            pipeline: PaxionEvolutionPipeline
            attestation: {
              entryHash: string
              publicKeyFingerprint: string
            }
            evolutionPipelines: PaxionEvolutionPipeline[]
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
            job: PaxionVisionJob
            visionJobs: PaxionVisionJob[]
            learningGraph: PaxionLearningGraphSnapshot
          }
          | { ok: false; reason: string }
        >
        reviewVisionJob(input: { jobId: string; notes: string }): Promise<
          | {
            ok: true
            job: PaxionVisionJob
            visionJobs: PaxionVisionJob[]
            learningGraph: PaxionLearningGraphSnapshot
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
            job: PaxionVisionJob | null
            extractedText: string
            confidence: number
            language: string
            visionJobs: PaxionVisionJob[]
            learningGraph: PaxionLearningGraphSnapshot
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
            artifact: PaxionEvidenceArtifact
            session: PaxionExecutionSession | null
            executionSessions: PaxionExecutionSession[]
            learningGraph: PaxionLearningGraphSnapshot
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
        getRuntime(): Promise<PaxionAssistantRuntimeResult>
        setRuntime(input: { closeToTrayEnabled: boolean }): Promise<PaxionAssistantRuntimeResult>
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
        }): Promise<PaxionVoiceCallResult>
        getProvider(): Promise<PaxionVoiceProviderResult>
        setProvider(input: {
          provider: 'desktop-relay' | 'twilio' | 'sip'
          fromNumber?: string
        }): Promise<PaxionVoiceProviderResult>
        getSecrets(): Promise<PaxionVoiceSecretStatusResult>
        setSecrets(input: {
          twilioAccountSid?: string
          twilioAuthToken?: string
          twilioFromNumber?: string
          sipUri?: string
          sipUsername?: string
          sipPassword?: string
        }): Promise<PaxionVoiceSecretStatusResult>
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
        }): Promise<PaxionTerminalPlanResult>
        run(input: {
          command: string
        }): Promise<PaxionTerminalRunResult>
        listPacks(): Promise<PaxionTerminalPackResult>
        createPack(input: {
          name: string
          commands: string[]
          active?: boolean
        }): Promise<PaxionTerminalPackResult>
        activatePack(input: {
          packId: string
          active: boolean
        }): Promise<PaxionTerminalPackResult>
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
        status(): Promise<PaxionBridgeStatusResult>
        start(input: {
          host?: string
          port?: number
          secret?: string
        }): Promise<PaxionBridgeStatusResult>
        stop(): Promise<PaxionBridgeStatusResult>
        approve(input: {
          requestId: string
          approved: boolean
          adminCodeword: string
        }): Promise<{ ok: boolean; reason?: string; request?: Record<string, unknown> }>
        rotateSecret(): Promise<PaxionBridgeStatusResult>
        issueToken(input: {
          purpose?: string
          ttlMs?: number
        }): Promise<{ ok: boolean; reason?: string; token?: Record<string, unknown> }>
      }
      security: {
        threatDashboard(input?: {
          request?: ActionRequest
        }): Promise<PaxionThreatDashboardResult>
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
        status(): Promise<PaxionOptimizationResult>
        run(input?: {
          autoTune?: boolean
          falseWakeCount?: number
          missedWakeCount?: number
        }): Promise<PaxionOptimizationResult>
      }
      relay: {
        status(): Promise<PaxionRelayResult>
        configure(input: {
          mode?: string
          endpoint?: string
          deviceId?: string
          pollingEnabled?: boolean
          token?: string
          clearToken?: boolean
        }): Promise<PaxionRelayResult>
        submit(input: {
          request?: Record<string, unknown>
        }): Promise<PaxionRelayResult>
        sync(): Promise<PaxionRelayResult>
        complete(input: {
          requestId: string
          state?: string
          result?: Record<string, unknown>
        }): Promise<PaxionRelayResult>
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
        load(): Promise<PaxionWorkspaceLoadResult>
        save(input: { goal: string; plan: Array<Record<string, unknown>> }): Promise<PaxionWorkspaceSaveResult>
        clear(): Promise<{ ok: boolean; reason?: string }>
      }
      library: {
        pickFile(): Promise<PaxionLibraryFileResult | PaxionLibraryFileError | null>
        load(): Promise<PaxionLibraryLoadResult>
        save(input: { docs: LibraryDocument[] }): Promise<PaxionLibrarySaveResult>
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
