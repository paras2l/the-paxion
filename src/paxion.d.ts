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
      library: {
        pickFile(): Promise<PaxionLibraryFileResult | PaxionLibraryFileError | null>
      }
    }
  }
}

export {}
