import { useCallback } from 'react'

export function Onboarding(): React.ReactElement {
  const handleOpenSettings = useCallback(() => {
    window.api.openScreenRecordingSettings()
  }, [])

  return (
    <div style={styles.container}>
      <div style={styles.icon}>✂️</div>
      <h1 style={styles.title}>Welcome to krtr</h1>
      <p style={styles.description}>
        krtr needs <strong>Screen Recording</strong> permission to capture screenshots.
      </p>
      <button style={styles.button} onClick={handleOpenSettings}>
        Open System Settings
      </button>
      <p style={styles.hint}>
        Enable <strong>krtr</strong> in the list, then this window will close automatically.
      </p>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '32px',
    background: '#1e1e1e',
    color: '#ddd',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    textAlign: 'center'
  },
  icon: {
    fontSize: '48px',
    marginBottom: '12px'
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    margin: '0 0 8px',
    color: '#fff'
  },
  description: {
    fontSize: '14px',
    lineHeight: '1.5',
    margin: '0 0 20px',
    color: '#aaa'
  },
  button: {
    padding: '10px 24px',
    background: '#0066cc',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  hint: {
    fontSize: '12px',
    color: '#666',
    marginTop: '16px',
    lineHeight: '1.4'
  }
}
