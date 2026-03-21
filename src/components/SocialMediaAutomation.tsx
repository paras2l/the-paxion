import React, { useState } from 'react'
import './SocialMediaAutomation.css'

type Platform = 'twitter' | 'linkedin' | 'instagram'

interface ScheduledPost {
    id: string
    platform: Platform
    content: string
    scheduledAt: string
    status: string
}

interface Idea {
    id: string
    format: string
    hook: string
    suggestion: string
    bestTime: string
    estimatedReach: string
}

const PLATFORM_ICONS: Record<Platform, string> = {
    twitter: '𝕏',
    linkedin: 'in',
    instagram: '📷',
}

const PLATFORM_COLORS: Record<Platform, string> = {
    twitter: '#1d9bf0',
    linkedin: '#0a66c2',
    instagram: '#e1306c',
}

export const SocialMediaAutomation: React.FC = () => {
    const [platform, setPlatform] = useState<Platform>('twitter')
    const [postContent, setPostContent] = useState('')
    const [scheduledAt, setScheduledAt] = useState('')
    const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([])
    const [status, setStatus] = useState('')

    const [ideaTopic, setIdeaTopic] = useState('')
    const [ideas, setIdeas] = useState<Idea[]>([])

    const [engagementJson, setEngagementJson] = useState('')
    const [engagementReport, setEngagementReport] = useState<Record<string, unknown> | null>(null)

    const charLimit = platform === 'twitter' ? 280 : 3000

    const schedulePost = async () => {
        if (!postContent.trim()) {
            setStatus('Post content is required.')
            return
        }
        if (platform === 'twitter' && postContent.length > 280) {
            setStatus('Twitter posts cannot exceed 280 characters.')
            return
        }
        // @ts-ignore
        const res = await window.raizen?.social?.schedule?.({
            platform,
            content: postContent.trim(),
            scheduledAt: scheduledAt || undefined,
        })
        if (res?.ok && res.post) {
            setScheduledPosts(prev => [(res.post as unknown) as ScheduledPost, ...prev].slice(0, 30))
            setPostContent('')
            setScheduledAt('')
            const sp = (res.post as unknown) as ScheduledPost
            setStatus(`✅ Post scheduled for ${sp.platform} at ${new Date(String(sp.scheduledAt)).toLocaleString()}`)
        } else {
            setStatus(res?.reason || 'Schedule failed.')
        }
    }

    const generateIdeas = async () => {
        if (!ideaTopic.trim()) {
            setStatus('Enter a topic to generate ideas.')
            return
        }
        // @ts-ignore
        const res = await window.raizen?.social?.ideas?.({ topic: ideaTopic.trim(), platform })
        if (res?.ok && Array.isArray(res.ideas)) {
            setIdeas(res.ideas)
            setStatus('')
        } else {
            setStatus(res?.reason || 'Idea generation failed.')
        }
    }

    const analyzeEngagement = async () => {
        let posts: unknown[] = []
        try {
            if (engagementJson.trim()) posts = JSON.parse(engagementJson)
        } catch {
            setStatus('Invalid JSON for engagement data.')
            return
        }
        // @ts-ignore
        const res = await window.raizen?.social?.analyze?.({ posts })
        if (res?.ok && res.summary) {
            setEngagementReport(res.summary as Record<string, unknown>)
            setStatus('')
        } else {
            setStatus(res?.reason || 'Analysis failed.')
        }
    }

    return (
        <div className="social-container">
            <header className="social-header">
                <h1>Social Media Automation</h1>
                <p>Schedule posts, generate AI ideas, and analyze engagement across platforms.</p>
            </header>

            {/* Platform Selector */}
            <div className="platform-tabs">
                {(['twitter', 'linkedin', 'instagram'] as Platform[]).map(p => (
                    <button
                        key={p}
                        className={`platform-tab ${platform === p ? 'active' : ''}`}
                        style={platform === p ? { borderColor: PLATFORM_COLORS[p], color: PLATFORM_COLORS[p] } : {}}
                        onClick={() => setPlatform(p)}
                    >
                        <span className="platform-icon">{PLATFORM_ICONS[p]}</span>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                ))}
            </div>

            <div className="social-grid">
                {/* Post Composer */}
                <section className="social-card">
                    <h3>📝 Post Composer</h3>
                    <textarea
                        className="social-textarea"
                        placeholder={`Write your ${platform} post here...`}
                        rows={6}
                        value={postContent}
                        onChange={e => setPostContent(e.target.value)}
                    />
                    <div className="char-counter" style={{ color: postContent.length > charLimit ? '#ef4444' : '#64748b' }}>
                        {postContent.length} / {charLimit}
                    </div>
                    <label className="social-label">Schedule for (leave empty = 1 hour from now)</label>
                    <input
                        className="social-input"
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={e => setScheduledAt(e.target.value)}
                    />
                    <button className="social-btn" style={{ background: PLATFORM_COLORS[platform] }} onClick={() => void schedulePost()}>
                        📅 Schedule Post
                    </button>

                    <div className="scheduled-list">
                        {scheduledPosts.length === 0 && <p className="social-muted">No posts scheduled yet.</p>}
                        {scheduledPosts.map(post => (
                            <div key={post.id} className="scheduled-row">
                                <span className="post-platform" style={{ color: PLATFORM_COLORS[post.platform] }}>
                                    {PLATFORM_ICONS[post.platform]} {post.platform}
                                </span>
                                <span className="post-preview">{post.content.slice(0, 60)}{post.content.length > 60 ? '…' : ''}</span>
                                <span className="post-time">{new Date(post.scheduledAt).toLocaleString()}</span>
                                <span className={`post-status ${post.status}`}>{post.status}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="social-right-col">
                    {/* AI Idea Generator */}
                    <section className="social-card">
                        <h3>💡 AI Post Idea Generator</h3>
                        <div className="idea-form">
                            <input
                                className="social-input"
                                placeholder="Topic (e.g. AI agents, startup funding...)"
                                value={ideaTopic}
                                onChange={e => setIdeaTopic(e.target.value)}
                            />
                            <button className="social-btn secondary" onClick={() => void generateIdeas()}>
                                Generate Ideas
                            </button>
                        </div>
                        <div className="idea-list">
                            {ideas.length === 0 && <p className="social-muted">Enter a topic and generate ideas for this platform.</p>}
                            {ideas.map(idea => (
                                <div key={idea.id} className="idea-card">
                                    <div className="idea-format">{idea.format}</div>
                                    <div className="idea-hook">{idea.hook}</div>
                                    <p className="idea-suggestion">{idea.suggestion}</p>
                                    <div className="idea-meta">
                                        <span>🕐 {idea.bestTime}</span>
                                        <span>📊 {idea.estimatedReach}</span>
                                    </div>
                                    <button
                                        className="idea-use-btn"
                                        onClick={() => { setPostContent(idea.suggestion); setStatus('Idea loaded into composer.') }}
                                    >
                                        Use →
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Engagement Analytics */}
                    <section className="social-card">
                        <h3>📊 Engagement Analyzer</h3>
                        <p className="social-muted">Paste a JSON array of posts with platform, likes, shares fields.</p>
                        <textarea
                            className="social-textarea"
                            rows={4}
                            placeholder='[{"platform":"twitter","likes":120,"shares":30},...]'
                            value={engagementJson}
                            onChange={e => setEngagementJson(e.target.value)}
                        />
                        <button className="social-btn secondary" onClick={() => void analyzeEngagement()}>
                            Analyze
                        </button>
                        {engagementReport && (
                            <div className="engagement-report">
                                <div className="er-row"><span>Total Posts</span><strong>{String(engagementReport.totalPosts)}</strong></div>
                                <div className="er-row"><span>Avg Likes</span><strong>{String(engagementReport.avgLikes)}</strong></div>
                                <div className="er-row"><span>Avg Shares</span><strong>{String(engagementReport.avgShares)}</strong></div>
                                <div className="er-row"><span>Top Platform</span><strong>{String(engagementReport.topPlatform)}</strong></div>
                            </div>
                        )}
                    </section>
                </div>
            </div>

            {status && <p className="social-status">{status}</p>}
        </div>
    )
}
