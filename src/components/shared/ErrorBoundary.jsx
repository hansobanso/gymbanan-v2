import { Component } from 'react'

// Sista skyddsnatet: om nagot i appen kraschar visas ett vanligt kort
// med omladdningsknapp istallet for en svart skarm.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, errorInfo: '' }
  }
  static getDerivedStateFromError(error) {
    const msg = error?.message || String(error)
    const stackLine = (error?.stack || '').split('\n').slice(1, 3).join(' ')
    return { hasError: true, errorInfo: `${msg} ${stackLine}`.slice(0, 300) }
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary fangade:', error, info)
  }
  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        background: '#000', color: '#fff', padding: 24, textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <p style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Något gick fel</p>
        <p style={{ fontSize: 14, color: '#999', margin: 0, lineHeight: 1.5 }}>
          Ladda om appen så hämtas senaste versionen.
        </p>
        {this.state.errorInfo && (
          <p style={{ fontSize: 11, color: '#555', margin: 0, maxWidth: 320,
                      wordBreak: 'break-word', lineHeight: 1.4, fontFamily: 'monospace' }}>
            {this.state.errorInfo}
          </p>
        )}
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#F5D020', color: '#000', border: 'none',
            borderRadius: 12, padding: '12px 28px', fontSize: 15,
            fontWeight: 700, cursor: 'pointer',
          }}
        >
          Ladda om
        </button>
      </div>
    )
  }
}
