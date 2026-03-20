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

    const loadEvents = async () => {
        setLoading(true)
        try {
            // @ts-ignore
            const res = await window.paxion?.analytics?.load?.()
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
        const res = await window.paxion?.analytics?.track?.({ type: eventType.trim(), payload })
        if (res?.ok) {
            setStatus(`Event "${eventType}" tracked.`)
            setEventType('')
            setEventPayload('')
            await loadEvents()
        } else {
            setStatus(res?.reason || 'Failed to track event.')
        }
    }

    useEffect(() => { void loadEvents() }, [])

    return (
        <div className="analytics-container">
            <header className="analytics-header">
                <h1>Analytics Dashboard</h1>
                <p>Live event stream and operational telemetry for Paxion.</p>
            </header>

            <div className="analytics-stats">
                <div className="stat-card">
                    <span className="stat-value">{summary.total}</span>
                    <span className="stat-label">Total Events</span>
                </div>
                {Object.entries(summary.byType).map(([type, count]) => (
                    <div key={type} className="stat-card">
                        <span className="stat-value">{count}</span>
                        <span className="stat-label">{type}</span>
                    </div>
                ))}
            </div>

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
