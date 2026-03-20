import React, { useState } from 'react'
import './EmailAutomation.css'

interface EmailData {
    to: string
    subject: string
    body: string
    auth?: {
        user: string
        pass: string
    }
}

export const EmailAutomation: React.FC = () => {
    const [email, setEmail] = useState<EmailData>({
        to: '',
        subject: '',
        body: '',
        auth: {
            user: '',
            pass: ''
        }
    })
    const [sending, setSending] = useState(false)
    const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({
        type: null,
        message: ''
    })

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        setSending(true)
        setStatus({ type: null, message: '' })

        try {
            // @ts-ignore
            const res = await window.paxion.automation.email.send(email)
            if (res.ok) {
                setStatus({ type: 'success', message: 'Email sent successfully!' })
                // @ts-ignore
                window.paxion.notify({ title: 'Email Sent', body: `Message to ${email.to} has been dispatched.` })
            } else {
                setStatus({ type: 'error', message: res.reason || 'Failed to send email.' })
            }
        } catch (err) {
            console.error('Email send error:', err)
            setStatus({ type: 'error', message: 'An unexpected error occurred.' })
        } finally {
            setSending(false)
        }
    }

    return (
        <div className="email-automation-container">
            <header className="email-header">
                <h1>Email Automation</h1>
                <p>Send automated reports, notifications, or messages via Paxion.</p>
            </header>

            <div className="email-layout">
                <form className="email-form" onSubmit={handleSend}>
                    <div className="form-section">
                        <label>Authentication (Gmail example)</label>
                        <div className="auth-fields">
                            <input
                                type="email"
                                placeholder="Your email address"
                                value={email.auth?.user}
                                onChange={e => setEmail(prev => ({ ...prev, auth: { ...prev.auth!, user: e.target.value } }))}
                                required
                            />
                            <input
                                type="password"
                                placeholder="App password"
                                value={email.auth?.pass}
                                onChange={e => setEmail(prev => ({ ...prev, auth: { ...prev.auth!, pass: e.target.value } }))}
                                required
                            />
                        </div>
                        <p className="helper-text">Note: Use an App Password for secure access.</p>
                    </div>

                    <hr />

                    <div className="compose-section">
                        <div className="field">
                            <label>Recipient (To)</label>
                            <input
                                type="email"
                                placeholder="recipient@example.com"
                                value={email.to}
                                onChange={e => setEmail(prev => ({ ...prev, to: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="field">
                            <label>Subject</label>
                            <input
                                type="text"
                                placeholder="Reporting progress..."
                                value={email.subject}
                                onChange={e => setEmail(prev => ({ ...prev, subject: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="field">
                            <label>Body</label>
                            <textarea
                                placeholder="Write your message here..."
                                rows={6}
                                value={email.body}
                                onChange={e => setEmail(prev => ({ ...prev, body: e.target.value }))}
                                required
                            ></textarea>
                        </div>
                    </div>

                    <button className="send-btn" type="submit" disabled={sending}>
                        {sending ? 'Dispatching...' : 'Send Email'}
                    </button>

                    {status.type && (
                        <div className={`status-banner ${status.type}`}>
                            {status.message}
                        </div>
                    )}
                </form>

                <aside className="email-tips">
                    <h3>Automation Tips</h3>
                    <ul>
                        <li>Use App Passwords for Gmail/Outlook.</li>
                        <li>Enable 2FA on your accounts for safety.</li>
                        <li>Paxion can auto-parse and send Excel data via this tool.</li>
                        <li>Scheduled emails can be set in the Swarm dashboard.</li>
                    </ul>
                </aside>
            </div>
        </div>
    )
}
