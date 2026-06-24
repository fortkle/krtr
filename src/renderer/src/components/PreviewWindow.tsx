import { useCallback, useEffect, useRef, useState } from 'react'

export function PreviewWindow(): React.ReactElement {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null)
  const [filename, setFilename] = useState('image')
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.getPreviewData().then((dataUrl) => {
      if (dataUrl) setImageUrl(dataUrl)
    })
  }, [])

  useEffect(() => {
    if (!imageUrl) return
    const img = new Image()
    img.onload = () => setImageSize({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = imageUrl
  }, [imageUrl])

  const syncFilename = useCallback((name: string) => {
    const safe = name.replace(/[/\\:*?"<>|]/g, '').trim() || 'image'
    setFilename(safe)
    window.api.setFilename(safe + '.png')
  }, [])

  const handleStartEdit = useCallback(() => {
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }, [])

  const handleFinishEdit = useCallback(() => {
    setEditing(false)
    syncFilename(filename)
  }, [filename, syncFilename])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleFinishEdit()
      }
    },
    [handleFinishEdit]
  )

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
      <div style={styles.header}>
        <span style={styles.headerTitle}>krtr</span>
      </div>

      <div style={styles.body}>
        <div style={styles.canvas}>
          <img src={imageUrl} style={styles.image} draggable={false} />
        </div>
      </div>

      <div style={styles.bottomBar}>
        <div style={styles.infoRow}>
          <div style={styles.filenameArea}>
            {editing ? (
              <input
                ref={inputRef}
                style={styles.filenameInput}
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                onBlur={handleFinishEdit}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            ) : (
              <span style={styles.filenameText} onClick={handleStartEdit} title="Click to rename">
                {filename}
              </span>
            )}
            <span style={styles.ext}>.png</span>
          </div>
          {imageSize && (
            <span style={styles.dimensions}>
              {imageSize.w} × {imageSize.h}
            </span>
          )}
        </div>
        <div style={styles.toolbar}>
          <button onClick={handleCopy} style={styles.button} title="Copy to clipboard">
            Copy
          </button>
          <button onClick={handleSave} style={styles.button} title="Save">
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
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 12px',
    background: '#252525',
    borderBottom: '1px solid #3a3a3a',
    minHeight: '32px',
    // @ts-expect-error Electron-specific CSS property for window dragging
    WebkitAppRegion: 'drag'
  },
  headerTitle: {
    color: '#888',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.5px'
  },
  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    background: '#2a2a2a'
  },
  canvas: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px',
    overflow: 'hidden'
  },
  image: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    borderRadius: '2px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
  },
  bottomBar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '6px 12px 8px',
    background: '#252525',
    borderTop: '1px solid #3a3a3a'
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: '22px'
  },
  filenameArea: {
    display: 'flex',
    alignItems: 'center'
  },
  filenameText: {
    color: '#ddd',
    fontSize: '11px',
    cursor: 'pointer',
    fontWeight: 600
  },
  filenameInput: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid #4fc3f7',
    borderRadius: '3px',
    color: '#fff',
    fontSize: '11px',
    padding: '1px 4px',
    outline: 'none',
    width: '100px'
  },
  ext: {
    color: '#888',
    fontSize: '11px'
  },
  dimensions: {
    color: '#888',
    fontSize: '11px'
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
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
