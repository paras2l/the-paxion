import React, { useEffect, useState } from 'react'
import './CheckpointHistory.css'

interface Checkpoint {
    id: string
    scriptId: string
    code: string
    createdAt: string
}

interface Props {
    scriptId?: string
}

export const CheckpointHistory: React.FC<Props> = ({ scriptId: propScriptId }) => {
    const [scriptId, setScriptId] = useState(propScriptId || '')
    const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
    const [loading, setLoading] = useState(false)
    const [expanded, setExpanded] = useState<string | null>(null)
    const [restoreStatus, setRestoreStatus] = useState('')
    const [createScriptId, setCreateScriptId] = useState('')
    const [createCode, setCreateCode] = useState('')
    const [createStatus, setCreateStatus] = useState('')

    const loadCheckpoints = async (id?: string) => {
        const target = id ?? scriptId
        if (!target.trim()) {
            setRestoreStatus('Enter a Script ID to load checkpoints.')
            return
        }
        setLoading(true)
        setRestoreStatus('')
        try {
            // @ts-ignore
            const res = await window.paxion?.checkpoint?.list?.(target.trim())
            if (res?.ok && Array.isArray(res.checkpoints)) {
                setCheckpoints(res.checkpoints)
                if (res.checkpoints.length === 0) setRestoreStatus('No checkpoints found for this script.')
            } else {
                setRestoreStatus(res?.reason || 'Failed to load checkpoints.')
            }
        } catch (err) {
            console.error('Checkpoint load error:', err)
            setRestoreStatus('Error loading checkpoints.')
        } finally {
            setLoading(false)
        }
    }

    const createCheckpoint = async () => {
        if (!createScriptId.trim() || !createCode.trim()) {
            setCreateStatus('Script ID and code content are both required.')
            return
        }
        // @ts-ignore
        const res = await window.paxion?.checkpoint?.create?.({
            scriptId: createScriptId.trim(),
            code: createCode.trim(),
        })
        if (res?.ok) {
            setCreateStatus(`Checkpoint saved: ${res.id}`)
            setCreateCode('')
            if (createScriptId === scriptId) void loadCheckpoints()
        } else {
            setCreateStatus(res?.reason || 'Checkpoint creation failed.')
        }
    }

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code).catch(() => { })
        setRestoreStatus('Code copied to clipboard — paste into your editor to restore.')
    }

    useEffect(() => {
        if (propScriptId) void loadCheckpoints(propScriptId)
    }, [propScriptId])

    return (
        <div className="checkpoint-container">
            <header className="checkpoint-header">
                <h1>Script Checkpoint History</h1>
                <p>Browse and restore previous versions of any script Paxion has edited.</p>
            </header>

            <div className="checkpoint-grid">
                {/* Left: Browse Checkpoints */}
                <section className="checkpoint-card">
                    <h3>Browse History</h3>
                    <div className="checkpoint-search-row">
                        <input
                            className="checkpoint-input"
                            placeholder="Script ID (e.g. workspace-script-1)"
                            value={scriptId}
                            onChange={e => setScriptId(e.target.value)}
                        />
                        <button className="checkpoint-btn" onClick={() => void loadCheckpoints()}>Load</button>
                    </div>
                    {restoreStatus && <p className="checkpoint-status">{restoreStatus}</p>}

                    <div className="checkpoint-list">
                        {loading && <p className="checkpoint-muted">Loading...</p>}
                        {!loading && checkpoints.length === 0 && (
                            <p className="checkpoint-muted">No history yet. Enter a script ID and press Load.</p>
                        )}
                        {checkpoints.map(cp => (
                            <div key={cp.id} className="checkpoint-row">
                                <div className="cp-row-top">
                                    <span className="cp-id">{cp.id}</span>
                                    <span className="cp-time">{new Date(cp.createdAt).toLocaleString()}</span>
                                    <button
                                        className="cp-expand-btn"
                                        onClick={() => setExpanded(expanded === cp.id ? null : cp.id)}
                                    >
                                        {expanded === cp.id ? '▲ Hide' : '▼ View Code'}
                                    </button>
                                    <button className="cp-copy-btn" onClick={() => copyCode(cp.code)}>
                                        📋 Restore
                                    </button>
                                </div>
                                {expanded === cp.id && (
                                    <pre className="cp-code-preview">{cp.code}</pre>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                {/* Right: Manual Save Checkpoint */}
                <section className="checkpoint-card">
                    <h3>Manual Checkpoint Save</h3>
                    <p className="checkpoint-muted">Manually save a checkpoint for any script before making changes.</p>
                    <div className="checkpoint-form">
                        <label>Script ID</label>
                        <input
                            className="checkpoint-input"
                            placeholder="e.g. workspace-script-1"
                            value={createScriptId}
                            onChange={e => setCreateScriptId(e.target.value)}
                        />
                        <label>Code Content</label>
                        <textarea
                            className="checkpoint-textarea"
                            rows={8}
                            placeholder="Paste the current script code here..."
                            value={createCode}
                            onChange={e => setCreateCode(e.target.value)}
                        />
                        <button className="checkpoint-btn" onClick={() => void createCheckpoint()}>
                            💾 Save Checkpoint
                        </button>
                        {createStatus && <p className="checkpoint-status">{createStatus}</p>}
                    </div>
                </section>
            </div>
        </div>
    )
}
