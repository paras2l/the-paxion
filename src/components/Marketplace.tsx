import React, { useEffect, useState } from 'react'
import './Marketplace.css'

interface Plugin {
    id: string
    name: string
    description: string
    manifest: any
    installed?: boolean
}

const STARTER_PLUGINS: Plugin[] = [
    {
        id: 'github-committer',
        name: 'GitHub Auto-Committer',
        description: 'Automatically commits and pushes your work to GitHub at set intervals.',
        manifest: { type: 'script', entry: 'github-sync.js' }
    },
    {
        id: 'excel-parser',
        name: 'Excel Parser Pro',
        description: 'Advanced data extraction from complex XLSX and CSV files with AI mapping.',
        manifest: { type: 'tool', entry: 'excel-tool.js' }
    },
    {
        id: 'pdf-extractor',
        name: 'PDF Intelligence',
        description: 'Extract text, tables, and images from scanned PDFs using OCR.',
        manifest: { type: 'tool', entry: 'pdf-ocr.js' }
    },
    {
        id: 'browser-scraping',
        name: 'Stealth Browser Scraper',
        description: 'Collect web data at scale with automated proxy rotation and captcha solving.',
        manifest: { type: 'script', entry: 'scraper-bot.js' }
    }
]

export const Marketplace: React.FC = () => {
    const [plugins, setPlugins] = useState<Plugin[]>(STARTER_PLUGINS)
    const [loading, setLoading] = useState(false)

    const handleInstall = async (plugin: Plugin) => {
        setLoading(true)
        try {
            // @ts-ignore
            const res = await window.paxion.ecosystem.register(plugin)
            if (res.ok) {
                setPlugins(prev => prev.map(p => p.id === plugin.id ? { ...p, installed: true } : p))
                // @ts-ignore
                window.paxion.notify({ title: 'Plugin Installed', body: `${plugin.name} is now ready to use.` })
            }
        } catch (err) {
            console.error('Install error:', err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="marketplace-container">
            <header className="marketplace-header">
                <h1>Plugin Marketplace</h1>
                <p>Enhance Paxion with pre-built automation packs and intelligent tools.</p>
            </header>

            <div className="marketplace-grid">
                {plugins.map(plugin => (
                    <div key={plugin.id} className="plugin-card">
                        <div className="plugin-icon">
                            {plugin.name[0]}
                        </div>
                        <div className="plugin-info">
                            <h3>{plugin.name}</h3>
                            <p>{plugin.description}</p>
                        </div>
                        <button
                            className={`install-btn ${plugin.installed ? 'installed' : ''}`}
                            onClick={() => handleInstall(plugin)}
                            disabled={loading || plugin.installed}
                        >
                            {plugin.installed ? 'Installed' : 'Install'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}
