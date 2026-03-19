export type ActionCategory = 'chat' | 'knowledge' | 'filesystem' | 'network' | 'codegen' | 'system'

export type ActionRequest = {
  actionId: string
  category: ActionCategory
  targetPath?: string
  detail?: string
  jurisdiction?: string
  masterCodeword?: string
}

export type PolicyDecision = {
  allowed: boolean
  requiresApproval: boolean
  ruleId: string
  reason: string
}

export type EnforcementContext = {
  adminVerified: boolean
  approvalGranted: boolean
}

export type AuditEventType =
  | 'policy_check'
  | 'approval_issue'
  | 'approval_use'
  | 'action_result'
  | 'threat_detected'

export type AuditEntry = {
  id: string
  timestamp: string
  type: AuditEventType
  payload: Record<string, unknown>
  prevHash: string
  hash: string
}
