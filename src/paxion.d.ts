import type { AuditEntry, ActionRequest, PolicyDecision } from './security/types'

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

type PaxionCapabilityState = {
  workspaceExecution: boolean
  workspaceFileWrite: boolean
  libraryIngestLocal: boolean
  libraryIngestWeb: boolean
  voiceInput: boolean
  voiceOutput: boolean
}

interface PaxionAccessResult {
  ok: boolean
  reason?: string
  capabilities: PaxionCapabilityState
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
      workspace: {
        load(): Promise<PaxionWorkspaceLoadResult>
        save(input: { goal: string; plan: Array<Record<string, unknown>> }): Promise<PaxionWorkspaceSaveResult>
        clear(): Promise<{ ok: boolean; reason?: string }>
      }
      library: {
        pickFile(): Promise<PaxionLibraryFileResult | PaxionLibraryFileError | null>
      }
    }
  }
}

export {}
