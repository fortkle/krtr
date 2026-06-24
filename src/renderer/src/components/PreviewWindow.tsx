import { useCallback, useEffect, useState } from 'react'

export function PreviewWindow(): React.ReactElement {
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    const cleanup = window.api.onPreviewData((dataUrl) => {
      setImageUrl(dataUrl)
    })
    return cleanup
  }, [])

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    window.api.startDrag()
  }, [])

  const handleSave = useCallback(() => {
    window.api.saveToDesktop()
  }, [])

  const handleCopy = useCallback(() => {
    window.api.copyToClipboard()
  }, [])

  if (!imageUrl) {
    return <div style={styles.loading}>Loading...</div>
  }

  return (
    <div style={styles.container}>
      <div style={styles.imageContainer}>
        <img src={imageUrl} style={styles.image} draggable={false} />
      </div>
      <div style={styles.toolbar}>
        <button onClick={handleCopy} style={styles.button} title="Copy to clipboard">
          Copy
        </button>
        <button onClick={handleSave} style={styles.button} title="Save to Desktop">
          Save
        </button>
        <div
          style={styles.dragTab}
          draggable
          onDragStart={handleDragStart}
          title="Drag to any app or folder"
        >
          <div style={styles.dragIcon}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="2" width="10" height="2" rx="1" />
              <rect x="3" y="7" width="10" height="2" rx="1" />
              <rect x="3" y="12" width="10" height="2" rx="1" />
            </svg>
          </div>
          <span style={styles.dragLabel}>Drag me</span>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#1e1e1e',
    overflow: 'hidden'
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#888',
    background: '#1e1e1e'
  },
  imageContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: '4px',
    // @ts-expect-error Electron-specific CSS property for window dragging
    WebkitAppRegion: 'drag'
  },
  image: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    borderRadius: '4px'
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: '#2a2a2a',
    borderTop: '1px solid #3a3a3a'
  },
  button: {
    padding: '4px 12px',
    border: '1px solid #555',
    borderRadius: '4px',
    background: '#3a3a3a',
    color: '#ddd',
    cursor: 'pointer',
    fontSize: '12px',
    lineHeight: '18px'
  },
  dragTab: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 16px',
    borderRadius: '4px',
    background: '#0066cc',
    color: '#fff',
    cursor: 'grab',
    fontSize: '12px',
    lineHeight: '18px',
    userSelect: 'none' as const
  },
  dragIcon: {
    display: 'flex',
    alignItems: 'center'
  },
  dragLabel: {
    fontWeight: 500
  }
}
