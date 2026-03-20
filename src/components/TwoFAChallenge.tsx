import React, { useEffect, useState } from 'react'
import './TwoFAChallenge.css'

interface Props {
    actionLabel: string
    onConfirm: () => void
    onCancel: () => void
}

function generateChallenge(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

export const TwoFAChallenge: React.FC<Props> = ({ actionLabel, onConfirm, onCancel }) => {
    const [challenge, setChallenge] = useState(() => generateChallenge())
    const [input, setInput] = useState('')
    const [error, setError] = useState('')
    const [attempts, setAttempts] = useState(0)

    useEffect(() => {
        setChallenge(generateChallenge())
        setInput('')
        setError('')
        setAttempts(0)
    }, [actionLabel])

    const handleConfirm = () => {
        if (input.trim() === challenge) {
            onConfirm()
        } else {
            const next = attempts + 1
            setAttempts(next)
            if (next >= 3) {
                setError('Too many failed attempts. Action blocked.')
                setTimeout(onCancel, 1800)
            } else {
                setError(`Incorrect code. ${3 - next} attempt(s) remaining.`)
                setChallenge(generateChallenge())
                setInput('')
            }
        }
    }

    return (
        <div className="twofa-overlay">
            <div className="twofa-modal">
                <div className="twofa-icon">🔐</div>
                <h2>Master-Level Authorization Required</h2>
                <p className="twofa-desc">You are attempting a high-security action:</p>
                <div className="twofa-action-label">{actionLabel}</div>

                <p className="twofa-instructions">
                    Type the 6-digit security code below to authorize this action.
                </p>

                <div className="twofa-code-display">{challenge}</div>

                <input
                    className="twofa-input"
                    autoFocus
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Enter the code above"
                    value={input}
                    onChange={e => {
                        setInput(e.target.value.replace(/\D/g, ''))
                        setError('')
                    }}
                    onKeyDown={e => {
                        if (e.key === 'Enter') handleConfirm()
                        if (e.key === 'Escape') onCancel()
                    }}
                />

                {error && <p className="twofa-error">{error}</p>}

                <div className="twofa-actions">
                    <button className="twofa-cancel-btn" onClick={onCancel}>Cancel</button>
                    <button className="twofa-confirm-btn" onClick={handleConfirm} disabled={input.length !== 6}>
                        Authorize
                    </button>
                </div>

                <p className="twofa-footer">This action will be recorded in the audit log.</p>
            </div>
        </div>
    )
}
