import { getImmutablePolicySummary } from '../../security/policy'

export type PolicySnapshot = {
  immutableRules: string[]
  sensitiveFlow: string[]
  capabilityBoundaries: string[]
}

export function createPolicySnapshot(): PolicySnapshot {
  return {
    immutableRules: getImmutablePolicySummary(),
    sensitiveFlow: [
      'Sensitive actions require admin verification.',
      'Approval tickets are required for privileged execution.',
      'Master-gated actions require the master codeword.',
      'Boundary paths under /boundary are immutable.',
    ],
    capabilityBoundaries: [
      'Capabilities can be disabled by admin from Access controls.',
      'Policy decision and audit flow remains append-only.',
      'Privileged execution must pass policy gate before tool execution.',
    ],
  }
}
