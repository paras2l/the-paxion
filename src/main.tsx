import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

type BootErrorBoundaryProps = {
  children: ReactNode
}

type BootErrorBoundaryState = {
  hasError: boolean
  message: string
}

class BootErrorBoundary extends Component<BootErrorBoundaryProps, BootErrorBoundaryState> {
  constructor(props: BootErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      message: '',
    }
  }

  static getDerivedStateFromError(error: unknown): BootErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    }
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('[paxion-boot] render crash', error, info)
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '1.5rem',
          background: '#050b18',
          color: '#d6ecff',
          fontFamily: 'Consolas, Courier New, monospace',
        }}
      >
        <div
          style={{
            maxWidth: '760px',
            width: '100%',
            border: '1px solid rgba(0, 212, 255, 0.35)',
            borderRadius: '12px',
            padding: '1rem 1.1rem',
            background: 'rgba(3, 14, 31, 0.88)',
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Paxion Startup Error</h2>
          <p style={{ marginTop: 0, color: '#88b8dc' }}>
            The UI failed during startup. Open developer tools and share the first error line.
          </p>
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: '#ffd6d6',
            }}
          >
            {this.state.message}
          </pre>
        </div>
      </div>
    )
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BootErrorBoundary>
      <App />
    </BootErrorBoundary>
  </StrictMode>,
)

window.addEventListener('error', (event) => {
  console.error('[paxion-boot] window error', event.error ?? event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[paxion-boot] unhandled rejection', event.reason)
})

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}
