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

type PaxionAutomationStepInput = {
  action: 'fill' | 'click' | 'select' | 'wait' | 'extractText'
  selector?: string
  value?: string
  waitMs?: number
}

declare global {
  interface Window {
    readonly paxion?: {
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
    }
  }
}

export {}
