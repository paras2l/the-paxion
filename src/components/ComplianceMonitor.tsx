import React, { useState } from 'react'
import './ComplianceMonitor.css'

interface ComplianceResult {
    allowed: boolean
    requiresReview: boolean
    ruleId: string
    reason: string
    jurisdiction: string
    policySnapshotHash: string
}

const JURISDICTIONS = ['GLOBAL', 'US', 'EU', 'IN']
const CATEGORIES = ['network', 'filesystem', 'system', 'codegen', 'communication', 'other']

export const ComplianceMonitor: React.FC = () => {
    const [actionId, setActionId] = useState('')
    const [category, setCategory] = useState('network')
    const [detail, setDetail] = useState('')
    const [jurisdiction, setJurisdiction] = useState('GLOBAL')
    const [result, setResult] = useState<ComplianceResult | null>(null)
    const [history, setHistory] = useState<Array<ComplianceResult & { actionId: string }>>([])
    const [status, setStatus] = useState('')

    const evaluate = async () => {
        if (!actionId.trim()) {
            setStatus('Provide an action ID.')
            return
        }
        // @ts-ignore
        const res = await window.raizen?.compliance?.evaluate?.({
            actionId: actionId.trim(),
            category,
            detail: detail.trim(),
            jurisdiction,
        })
        if (res) {
            setResult(res)
            setHistory(prev => [{ ...res, actionId: actionId.trim() }, ...prev].slice(0, 30))
            setStatus('')
        } else {
            setStatus('Evaluation failed — check backend.')
        }
    }

    return (
        <div className="compliance-container">
            <header className="compliance-header">
                <h1>Compliance Monitor</h1>
                <p>Evaluate actions against jurisdictional compliance rules in real-time.</p>
            </header>

            <div className="compliance-grid">
                <section className="compliance-card">
                    <h3>Action Evaluation</h3>
                    <div className="compliance-form">
                        <label>Action ID</label>
                        <input className="compliance-input" placeholder="e.g. file.write.log" value={actionId} onChange={e => setActionId(e.target.value)} />

                        <label>Category</label>
                        <select className="compliance-select" value={category} onChange={e => setCategory(e.target.value)}>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>

                        <label>Jurisdiction</label>
                        <select className="compliance-select" value={jurisdiction} onChange={e => setJurisdiction(e.target.value)}>
                            {JURISDICTIONS.map(j => <option key={j} value={j}>{j}</option>)}
                        </select>

                        <label>Detail (optional)</label>
                        <input className="compliance-input" placeholder="Additional action context..." value={detail} onChange={e => setDetail(e.target.value)} />

                        <button className="compliance-btn" onClick={() => void evaluate()}>Evaluate Compliance</button>
                    </div>
                    {status && <p className="compliance-status error">{status}</p>}
                </section>

                {result && (
                    <section className="compliance-card result-card">
                        <h3>Evaluation Result</h3>
                        <div className={`compliance-verdict ${result.requiresReview ? 'warn' : 'pass'}`}>
                            {result.requiresReview ? '⚠ Review Required' : '✓ Cleared'}
                        </div>
                        <div className="compliance-details">
                            <div className="cd-row"><span>Jurisdiction</span><strong>{result.jurisdiction}</strong></div>
                            <div className="cd-row"><span>Rule ID</span><strong>{result.ruleId}</strong></div>
                            <div className="cd-row"><span>Reason</span><span>{result.reason}</span></div>
                            <div className="cd-row"><span>Policy Hash</span><code>{result.policySnapshotHash.slice(0, 16)}…</code></div>
                        </div>
                    </section>
                )}
            </div>

            <section className="compliance-history">
                <h3>Evaluation History</h3>
                {history.length === 0 && <p className="compliance-muted">No evaluations yet.</p>}
                {history.map((item, i) => (
                    <div key={i} className={`history-row ${item.requiresReview ? 'warn' : 'pass'}`}>
                        <span className="history-action">{item.actionId}</span>
                        <span className="history-juri">{item.jurisdiction}</span>
                        <span className={`history-badge ${item.requiresReview ? 'warn' : 'pass'}`}>
                            {item.requiresReview ? 'Review' : 'Clear'}
                        </span>
                    </div>
                ))}
            </section>
        </div>
    )
}
