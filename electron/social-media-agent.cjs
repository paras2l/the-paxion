'use strict'

/**
 * Social Media Automation Agent
 * Provides posting, scheduling, and analytics for Twitter/X, LinkedIn, and Instagram
 * via browser automation (puppeteer-style step sequences) or API simulation.
 */

const PLATFORM_CONFIGS = {
    twitter: {
        url: 'https://x.com',
        postSelector: '[data-testid="tweetTextarea_0"]',
        buttonSelector: '[data-testid="tweetButtonInline"]',
    },
    linkedin: {
        url: 'https://www.linkedin.com/feed/',
        postSelector: '.ql-editor',
        buttonSelector: '[data-control-name="share.post"]',
    },
    instagram: {
        url: 'https://www.instagram.com',
        postSelector: 'textarea._aopf',
        buttonSelector: 'button[type="button"]',
    },
}

function buildPostSteps(platform, content, mediaPath) {
    const config = PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.twitter
    const steps = [
        { action: 'click', selector: config.postSelector },
        { action: 'fill', selector: config.postSelector, value: content },
        { action: 'wait', waitMs: 800 },
        { action: 'click', selector: config.buttonSelector },
        { action: 'wait', waitMs: 1500 },
        { action: 'extractText', selector: 'h1' },
    ]
    return {
        url: config.url,
        steps,
        platform,
    }
}

function schedulePost(input) {
    const platform = String(input?.platform || 'twitter').toLowerCase()
    const content = String(input?.content || '').trim()
    const scheduledAt = input?.scheduledAt || new Date(Date.now() + 3600000).toISOString()

    if (!content) {
        return { ok: false, reason: 'Content is required.' }
    }

    const post = {
        id: `post-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        platform,
        content,
        mediaPath: input?.mediaPath || null,
        scheduledAt,
        status: 'scheduled',
        createdAt: new Date().toISOString(),
    }

    return { ok: true, post }
}

function analyzeEngagement(input) {
    const posts = Array.isArray(input?.posts) ? input.posts : []
    const totalPosts = posts.length

    if (totalPosts === 0) {
        return { ok: true, summary: { totalPosts: 0, avgLikes: 0, avgShares: 0, topPlatform: 'N/A' } }
    }

    const byPlatform = {}
    let totalLikes = 0
    let totalShares = 0

    for (const post of posts) {
        const p = String(post?.platform || 'unknown')
        const likes = Number(post?.likes || 0)
        const shares = Number(post?.shares || 0)
        totalLikes += likes
        totalShares += shares
        if (!byPlatform[p]) byPlatform[p] = { likes: 0, shares: 0, count: 0 }
        byPlatform[p].likes += likes
        byPlatform[p].shares += shares
        byPlatform[p].count += 1
    }

    const topPlatform = Object.entries(byPlatform).sort((a, b) => (b[1].likes + b[1].shares) - (a[1].likes + a[1].shares))[0]?.[0] || 'N/A'

    return {
        ok: true,
        summary: {
            totalPosts,
            avgLikes: (totalLikes / totalPosts).toFixed(1),
            avgShares: (totalShares / totalPosts).toFixed(1),
            topPlatform,
            byPlatform,
        },
    }
}

function generatePostIdeas(input) {
    const topic = String(input?.topic || 'AI technology').trim()
    const platform = String(input?.platform || 'twitter').toLowerCase()

    const formats = {
        twitter: ['thread', '280-char post', 'poll', 'quote tweet'],
        linkedin: ['thought leadership article', 'how-to post', 'industry insight', 'milestone update'],
        instagram: ['carousel', 'reel concept', 'story series', 'infographic caption'],
    }

    const platformFormats = formats[platform] || formats.twitter

    const ideas = platformFormats.map((fmt, i) => ({
        id: `idea-${i + 1}`,
        format: fmt,
        hook: `Idea ${i + 1}: ${fmt} about "${topic}"`,
        suggestion: `Create a ${fmt} exploring the impact of ${topic} on your audience. Start with a bold claim or question, share evidence, and end with a clear CTA.`,
        bestTime: i % 2 === 0 ? '9:00 AM – 11:00 AM' : '5:00 PM – 7:00 PM',
        estimatedReach: `${(1000 + i * 500).toLocaleString()} – ${(5000 + i * 1000).toLocaleString()} impressions`,
    }))

    return { ok: true, platform, topic, ideas }
}

module.exports = {
    buildPostSteps,
    schedulePost,
    analyzeEngagement,
    generatePostIdeas,
}
