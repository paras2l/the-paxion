import type { AuditEntry, ActionRequest, PolicyDecision } from './security/types'

interface PaxionLibraryFileResult {
  name: string
  content: string
  path: string
}

interface PaxionLibraryFileError {
  error: string
}

declare global {
  interface Window {
    readonly paxion?: {
      audit: {
        append(entry: AuditEntry): Promise<void>
        load(): Promise<AuditEntry[]>
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
