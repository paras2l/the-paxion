import './Avatar.css'

export type AvatarStatus = 'idle' | 'listening' | 'processing' | 'speaking'

interface AvatarProps {
    status: AvatarStatus
    audioLevel?: number // 0.0 to 1.0
}

export function AvatarCore({ status, audioLevel = 0 }: AvatarProps) {
    // Compute dynamic scale and glow based on audio level when active
    const isActive = status === 'speaking' || status === 'listening'
    const scale = isActive ? 1 + audioLevel * 0.4 : status === 'processing' ? 1.05 : 1

    const rootClass = `avatar-core avatar-status-${status}`

    return (
        <div className="avatar-container">
            <div
                className={rootClass}
                style={{
                    transform: `scale(${scale})`,
                    transition: isActive ? 'transform 0.05s ease-out' : 'transform 0.4s ease-in-out',
                }}
            >
                <div className="avatar-glow" />
                <div className="avatar-ring avatar-ring-outer" />
                <div className="avatar-ring avatar-ring-inner" />
                <div className="avatar-center" />
            </div>
            <div className="avatar-label">
                {status === 'idle' ? 'STANDBY' : status.toUpperCase()}
            </div>
        </div>
    )
}
