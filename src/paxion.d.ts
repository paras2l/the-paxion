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
      }
      library: {
        pickFile(): Promise<PaxionLibraryFileResult | PaxionLibraryFileError | null>
      }
    }
  }
}

export {}
