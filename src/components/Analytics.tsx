import { useState as useReactState } from 'react'
import { getRecentMemory, queryMemory } from '../lib/memory'
// Memory/Context UI component
const MemoryContextPanel: React.FC = () => {
    const [query, setQuery] = useReactState('')
    const [results, setResults] = useReactState(() => getRecentMemory(10))
    const [mode, setMode] = useReactState<'recent'|'query'>('recent')

    const handleQuery = () => {
        if (query.trim()) {
            setResults(queryMemory({ query, maxResults: 10, fuzzy: true }))
            setMode('query')
        } else {
            setResults(getRecentMemory(10))
            setMode('recent')
        }
    }

    return (
        <div className="analytics-memory-panel">
            <h3>Memory / Context</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                    className="analytics-input"
                    placeholder="Search memory/context..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleQuery() }}
                />
                <button className="analytics-btn" onClick={handleQuery}>Search</button>
                <button className="analytics-btn secondary" onClick={() => { setQuery(''); setResults(getRecentMemory(10)); setMode('recent') }}>Recent</button>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 180, overflowY: 'auto' }}>
                {results.length === 0 && <li className="analytics-muted">No memory found.</li>}
                {results.map((item, i) => (
                    <li key={i} style={{ marginBottom: 6, fontSize: 13, background: '#f6f6f6', borderRadius: 4, padding: 6 }}>
                        <span style={{ color: '#888', marginRight: 8 }}>{new Date(item.timestamp).toLocaleTimeString()}</span>
                        <span style={{ color: '#555', marginRight: 8 }}>{item.type}</span>
                        <span>{typeof item.data === 'string' ? item.data : JSON.stringify(item.data)}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}
import React, { useEffect, useState } from 'react'
import './Analytics.css'

interface AnalyticsEvent {
    id: string
    type: string
    payload: Record<string, unknown>
    timestamp: string
}

interface AnalyticsSummary {
    total: number
    byType: Record<string, number>
    recent: AnalyticsEvent[]
}


export const Analytics: React.FC = () => {
    const [summary, setSummary] = useState<AnalyticsSummary>({ total: 0, byType: {}, recent: [] })
    const [loading, setLoading] = useState(false)
    const [eventType, setEventType] = useState('')
    const [eventPayload, setEventPayload] = useState('')
    const [status, setStatus] = useState('')
    const [dbSize, setDbSize] = useState<number | null>(null)

    const loadEvents = async () => {
        setLoading(true)
        try {
            // @ts-ignore
            const res = await window.raizen?.analytics?.load?.()
            if (res?.ok && Array.isArray(res.events)) {
                const events: AnalyticsEvent[] = res.events
                const byType: Record<string, number> = {}
                for (const ev of events) {
                    byType[ev.type] = (byType[ev.type] || 0) + 1
                }
                setSummary({ total: events.length, byType, recent: events.slice(-20).reverse() })
            }
        } catch (err) {
            console.error('Analytics load error:', err)
        } finally {
            setLoading(false)
        }
    }

    const loadDbSize = async () => {
        try {
            // @ts-ignore
            const res = await window.raizen?.stats?.databaseSize?.()
            if (res?.ok) setDbSize(res.size)
        } catch (err) {
            setDbSize(null)
        }
    }

    const trackEvent = async () => {
        if (!eventType.trim()) {
            setStatus('Please provide an event type.')
            return
        }
        let payload: Record<string, unknown> = {}
        try {
            if (eventPayload.trim()) payload = JSON.parse(eventPayload)
        } catch {
            setStatus('Invalid JSON payload.')
            return
        }
        // @ts-ignore
        const res = await window.raizen?.analytics?.track?.({ type: eventType.trim(), payload })
        if (res?.ok) {
            setStatus(`Event "${eventType}" tracked.`)
            setEventType('')
            setEventPayload('')
            await loadEvents()
        } else {
            setStatus(res?.reason || 'Failed to track event.')
        }
    }

    useEffect(() => {
        void loadEvents()
        void loadDbSize()
    }, [])

    return (
        <div className="analytics-container">
            <header className="analytics-header">
                <h1>Analytics Dashboard</h1>
                <p>Live event stream and operational telemetry for Raizen.</p>
            </header>

            <div className="analytics-stats">
                <div className="stat-card">
                    <span className="stat-value">{summary.total}</span>
                    <span className="stat-label">Total Events</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">
                        {dbSize !== null ? (dbSize > 1024 * 1024 ? (dbSize / (1024 * 1024)).toFixed(2) + ' MB' : (dbSize / 1024).toFixed(1) + ' KB') : '—'}
                    </span>
                    <span className="stat-label">Memory Used</span>
                </div>
                {Object.entries(summary.byType).map(([type, count]) => (
                    <div key={type} className="stat-card">
                        <span className="stat-value">{count}</span>
                        <span className="stat-label">{type}</span>
                    </div>
                ))}
            </div>

            <MemoryContextPanel />

            <div className="analytics-track-form">
                <h3>Track Custom Event</h3>
                <div className="track-row">
                    <input
                        className="analytics-input"
                        placeholder="Event type (e.g. user_action)"
                        value={eventType}
                        onChange={e => setEventType(e.target.value)}
                    />
                    <input
                        className="analytics-input"
                        placeholder='Payload JSON (optional, e.g. {"key":"val"})'
                        value={eventPayload}
                        onChange={e => setEventPayload(e.target.value)}
                    />
                    <button className="analytics-btn" onClick={() => void trackEvent()}>Track</button>
                    <button className="analytics-btn secondary" onClick={() => void loadEvents()}>Refresh</button>
                </div>
                {status && <p className="analytics-status">{status}</p>}
            </div>

            <div className="analytics-feed">
                <h3>Recent Events</h3>
                {loading && <p className="analytics-muted">Loading telemetry...</p>}
                {!loading && summary.recent.length === 0 && (
                    <p className="analytics-muted">No events recorded yet. Track your first event above.</p>
                )}
                {summary.recent.map(ev => (
                    <div key={ev.id} className="analytics-event-row">
                        <span className="event-type-badge">{ev.type}</span>
                        <span className="event-time">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                        <span className="event-payload">{JSON.stringify(ev.payload)}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
