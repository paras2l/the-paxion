import React, { useState } from 'react'
import './MedicalAdvisor.css'

interface DrugFinding {
    medications: string[]
    severity: string
    message: string
}

interface SafetyResult {
    safe: boolean
    findings: DrugFinding[]
    reviewedAt: string
}

export const MedicalAdvisor: React.FC = () => {
    const [medicationsText, setMedicationsText] = useState('')
    const [result, setResult] = useState<SafetyResult | null>(null)
    const [confidence, setConfidence] = useState('0.8')
    const [threshold, setThreshold] = useState('0.75')
    const [adviceResult, setAdviceResult] = useState<{ allowed: boolean; reason: string } | null>(null)
    const [status, setStatus] = useState('')

    const checkInteractions = async () => {
        const medications = medicationsText.split(',').map(m => m.trim()).filter(Boolean)
        if (medications.length < 2) {
            setStatus('Enter at least two medications separated by commas.')
            return
        }
        // @ts-ignore
        const res = await window.raizen?.medical?.review?.({ medications })
        if (res) {
            setResult(res as unknown as SafetyResult)
            setStatus('')
        } else {
            setStatus('Safety check failed.')
        }
    }

    const checkAdviceConfidence = async () => {
        const conf = parseFloat(confidence)
        const thresh = parseFloat(threshold)
        if (isNaN(conf) || isNaN(thresh)) {
            setStatus('Enter valid numeric values.')
            return
        }
        // @ts-ignore
        const res = await window.raizen?.medical?.adviceCheck?.({ confidence: conf, threshold: thresh })
        if (res) {
            setAdviceResult(res)
            setStatus('')
        } else {
            setStatus('Advice check unavailable.')
        }
    }

    return (
        <div className="medical-container">
            <header className="medical-header">
                <h1>Medical Safety Advisor</h1>
                <p>AI-assisted drug interaction checker and supervised advice confidence validator.</p>
                <div className="medical-disclaimer">
                    ⚕️ <strong>Disclaimer:</strong> This tool is for educational review only. Always consult a licensed physician.
                </div>
            </header>

            <div className="medical-grid">
                <section className="medical-card">
                    <h3>Drug Interaction Checker</h3>
                    <p className="medical-muted">Enter medication names separated by commas.</p>
                    <textarea
                        className="medical-textarea"
                        placeholder="e.g. aspirin, warfarin, metformin"
                        rows={4}
                        value={medicationsText}
                        onChange={e => setMedicationsText(e.target.value)}
                    />
                    <button className="medical-btn" onClick={() => void checkInteractions()}>Check Interactions</button>

                    {result && (
                        <div className={`interaction-result ${result.safe ? 'safe' : 'unsafe'}`}>
                            {result.safe ? (
                                <p className="safe-msg">✓ No known dangerous interactions found.</p>
                            ) : (
                                <div className="findings-list">
                                    {result.findings.map((f, i) => (
                                        <div key={i} className="finding-card">
                                            <div className="finding-drugs">{f.medications.join(' + ')}</div>
                                            <div className={`finding-severity ${f.severity}`}>{f.severity.toUpperCase()}</div>
                                            <p className="finding-msg">{f.message}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <p className="review-time">Reviewed at {new Date(result.reviewedAt).toLocaleTimeString()}</p>
                        </div>
                    )}
                </section>

                <section className="medical-card">
                    <h3>Advice Confidence Gate</h3>
                    <p className="medical-muted">Check whether a confidence score meets the safety threshold for releasing advisory output.</p>
                    <div className="confidence-form">
                        <label>Model Confidence (0–1)</label>
                        <input className="medical-input" type="number" step="0.01" min="0" max="1" value={confidence} onChange={e => setConfidence(e.target.value)} />
                        <label>Safety Threshold (0–1)</label>
                        <input className="medical-input" type="number" step="0.01" min="0" max="1" value={threshold} onChange={e => setThreshold(e.target.value)} />
                        <button className="medical-btn" onClick={() => void checkAdviceConfidence()}>Evaluate Gate</button>
                    </div>

                    {adviceResult && (
                        <div className={`advice-gate ${adviceResult.allowed ? 'safe' : 'unsafe'}`}>
                            <strong>{adviceResult.allowed ? '✓ Cleared for Advisory Output' : '✗ Escalate to Human Review'}</strong>
                            <p>{adviceResult.reason}</p>
                        </div>
                    )}
                </section>
            </div>

            {status && <p className="medical-status">{status}</p>}
        </div>
    )
}
