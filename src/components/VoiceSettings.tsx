import React, { useEffect, useState } from 'react'
import './VoiceSettings.css'

interface VoiceSettings {
    voice: string
    pitch: number
    rate: number
}

export const VoiceSettings: React.FC = () => {
    const [settings, setSettings] = useState<VoiceSettings>({
        voice: '',
        pitch: 1.0,
        rate: 1.0
    })
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadVoices = () => {
            const voices = window.speechSynthesis.getVoices()
            setAvailableVoices(voices)
        }

        const loadPersistedSettings = async () => {
            try {
                // @ts-ignore
                const saved = await window.paxion.voiceQuality.get()
                if (saved && saved.voice) {
                    setSettings({
                        voice: saved.voice,
                        pitch: saved.pitch ?? 1.0,
                        rate: saved.rate ?? 1.0
                    })
                }
            } catch (err) {
                console.error('Failed to load voice settings:', err)
            } finally {
                setLoading(false)
            }
        }

        loadVoices()
        loadPersistedSettings()
        window.speechSynthesis.onvoiceschanged = loadVoices

        return () => {
            window.speechSynthesis.onvoiceschanged = null
        }
    }, [])

    const handleSave = async () => {
        try {
            // @ts-ignore
            await window.paxion.voiceQuality.update(settings)
            // @ts-ignore
            window.paxion.notify({ title: 'Voice Settings Saved', body: 'Paxion personality has been updated.' })
        } catch (err) {
            console.error('Failed to save voice settings:', err)
        }
    }

    const handleTest = () => {
        const utterance = new SpeechSynthesisUtterance('Hello, I am Paxion. How can I assist you today?')
        const voice = availableVoices.find(v => v.name === settings.voice)
        if (voice) utterance.voice = voice
        utterance.pitch = settings.pitch
        utterance.rate = settings.rate
        window.speechSynthesis.speak(utterance)
    }

    if (loading) return <div className="voice-loading">Loading voice profiles...</div>

    return (
        <div className="voice-settings-container">
            <header className="voice-header">
                <h1>Voice Personality</h1>
                <p>Customize how Paxion sounds and speaks to you.</p>
            </header>

            <div className="voice-form">
                <div className="voice-field">
                    <label>Select Voice</label>
                    <select
                        value={settings.voice}
                        onChange={e => setSettings(prev => ({ ...prev, voice: e.target.value }))}
                    >
                        <option value="">System Default</option>
                        {availableVoices.map(voice => (
                            <option key={voice.name} value={voice.name}>
                                {voice.name} ({voice.lang})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="voice-field">
                    <label>Pitch: {settings.pitch.toFixed(1)}</label>
                    <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={settings.pitch}
                        onChange={e => setSettings(prev => ({ ...prev, pitch: parseFloat(e.target.value) }))}
                    />
                </div>

                <div className="voice-field">
                    <label>Rate: {settings.rate.toFixed(1)}</label>
                    <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={settings.rate}
                        onChange={e => setSettings(prev => ({ ...prev, rate: parseFloat(e.target.value) }))}
                    />
                </div>

                <div className="voice-actions">
                    <button className="test-btn" onClick={handleTest}>Test Voice</button>
                    <button className="save-btn" onClick={handleSave}>Save Settings</button>
                </div>
            </div>
        </div>
    )
}
