import type { ReactNode } from 'react'
import type { PolicySnapshot } from '../../../core/policy/policyAdapter'

interface PolicyProps {
  snapshot: PolicySnapshot
  adminUnlocked: boolean
  children?: ReactNode
}

export function Policy(props: PolicyProps) {
  const { snapshot, adminUnlocked } = props

  if (!adminUnlocked) {
    return (
      <div className="nova-surface">
        <div className="nova-card">
          <h3>Policy Rules (Admin Only)</h3>
          <p className="muted">
            Unlock admin session to view policy configuration and approval gates.
          </p>
          <p className="muted accent-cyan">Return to Access tab and unlock with admin codeword.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="nova-surface">
      <div className="nova-stack">
        <div className="nova-card">
          <h3>Policy Configuration</h3>
          <p className="muted">
            Immutable policy boundaries are stored in <code>/boundary/policy-boundary.cjs</code> 
            and cannot be modified by generated code under any circumstance.
          </p>
        </div>

        {snapshot.immutableRules && snapshot.immutableRules.length > 0 && (
          <div className="nova-card">
            <h3>Immutable Rules</h3>
            <div className="nova-policy-rules">
              {snapshot.immutableRules.map((rule, idx) => (
                <article key={idx} className="nova-policy-rule">
                  <strong>{rule}</strong>
                </article>
              ))}
            </div>
          </div>
        )}

        {snapshot.sensitiveFlow && snapshot.sensitiveFlow.length > 0 && (
          <div className="nova-card">
            <h3>Sensitive Flow Gates</h3>
            <p className="muted">
              These actions require additional verification before execution:
            </p>
            <div className="nova-policy-rules">
              {snapshot.sensitiveFlow.map((flow, idx) => (
                <article key={idx} className="nova-policy-rule">
                  <strong>{flow}</strong>
                </article>
              ))}
            </div>
          </div>
        )}

        {snapshot.capabilityBoundaries && snapshot.capabilityBoundaries.length > 0 && (
          <div className="nova-card">
            <h3>Capability Boundaries</h3>
            <p className="muted">
              These capabilities are explicitly bounded:
            </p>
            <div className="nova-policy-rules">
              {snapshot.capabilityBoundaries.map((boundary, idx) => (
                <article key={idx} className="nova-policy-rule">
                  <strong>{boundary}</strong>
                </article>
              ))}
            </div>
          </div>
        )}

        <div className="nova-card">
          <h3>Codeword Verification</h3>
          <p className="muted">
            Two-codeword model enforces policy compliance:
          </p>
          <ul className="muted">
            <li>
              <strong>Admin Codeword:</strong> "paro the chief" for standard sensitive 
              operations (permission toggles, relay config, skill ingest)
            </li>
            <li>
              <strong>Master Codeword:</strong> "paro the master" for privileged 
              master-gated actions (disable policy, delete audit, exfiltrate, system disarm)
            </li>
            <li>
              <strong>Harmful Pattern Detection:</strong> Keywords like "hack", "malware", 
              "ransom", "phishing", "ddos", "exploit", "exfiltrate", "keylogger" 
              auto-trigger master gate
            </li>
          </ul>
        </div>

        <div className="nova-card">
          <h3>Approval Flow</h3>
          <p className="muted">
            Complex actions may require approval tickets with time-limited validity:
          </p>
          <ul className="muted">
            <li>Admin creates approval ticket for complex workflow</li>
            <li>Ticket includes timebound validity window</li>
            <li>Tool execution references ticket ID during policy evaluation</li>
            <li>On expiry, ticket becomes invalid and action is denied</li>
            <li>All ticket decisions recorded in immutable audit chain</li>
          </ul>
        </div>

        <div className="nova-card">
          <h3>Policy Modification</h3>
          <p className="muted">
            To modify policy rules, edit <code>/boundary/policy-boundary.cjs</code> 
            directly (outside app). This file is immutable from within the running app.
          </p>
          <p className="muted accent-red">
            Any attempt to modify <code>/boundary</code> folder or policy rules 
            through app triggers master-gate denial and full audit record.
          </p>
        </div>
      </div>
    </div>
  )
}
