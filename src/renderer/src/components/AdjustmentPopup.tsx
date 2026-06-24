import { useCallback, useEffect, useRef, useState } from 'react'
import type { Rectangle } from '../../../shared/types'

interface Props {
  selection: Rectangle
  aspectLocked: boolean
  onAspectLockedChange: (locked: boolean) => void
  onSelectionChange: (rect: Rectangle) => void
  onConfirm: () => void
  onCancel: () => void
  onTimerCapture: () => void
}

export function AdjustmentPopup({
  selection,
  aspectLocked,
  onAspectLockedChange,
  onSelectionChange,
  onConfirm,
  onCancel,
  onTimerCapture
}: Props): React.ReactElement {
  const dpr = window.devicePixelRatio || 1
  const pxWidth = Math.round(selection.width * dpr)
  const pxHeight = Math.round(selection.height * dpr)

  const [widthInput, setWidthInput] = useState(String(pxWidth))
  const [heightInput, setHeightInput] = useState(String(pxHeight))
  const aspectRatio = useRef(pxWidth / pxHeight)

  useEffect(() => {
    setWidthInput(String(pxWidth))
    setHeightInput(String(pxHeight))
    if (!aspectLocked) {
      aspectRatio.current = pxWidth / pxHeight
    }
  }, [pxWidth, pxHeight, aspectLocked])

  const handleWidthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setWidthInput(val)
      const w = parseInt(val, 10)
      if (isNaN(w) || w < 1) return
      const newWidth = w / dpr
      let newHeight = selection.height
      if (aspectLocked) {
        newHeight = newWidth / aspectRatio.current
        setHeightInput(String(Math.round(newHeight * dpr)))
      }
      onSelectionChange({ ...selection, width: newWidth, height: newHeight })
    },
    [selection, aspectLocked, dpr, onSelectionChange]
  )

  const handleHeightChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setHeightInput(val)
      const h = parseInt(val, 10)
      if (isNaN(h) || h < 1) return
      const newHeight = h / dpr
      let newWidth = selection.width
      if (aspectLocked) {
        newWidth = newHeight * aspectRatio.current
        setWidthInput(String(Math.round(newWidth * dpr)))
      }
      onSelectionChange({ ...selection, width: newWidth, height: newHeight })
    },
    [selection, aspectLocked, dpr, onSelectionChange]
  )

  const toggleAspectLock = useCallback(() => {
    if (!aspectLocked) {
      aspectRatio.current = pxWidth / pxHeight
    }
    onAspectLockedChange(!aspectLocked)
  }, [aspectLocked, pxWidth, pxHeight, onAspectLockedChange])

  const popupHeight = 70
  const rightEdge = selection.x + selection.width
  const popupY = Math.min(
    selection.y + selection.height + 8,
    window.innerHeight - popupHeight - 8
  )

  return (
    <div
      ref={(el) => {
        if (!el) return
        const rect = el.getBoundingClientRect()
        const x = Math.min(rightEdge - rect.width + 10, window.innerWidth - rect.width)
        el.style.left = `${Math.max(0, x)}px`
      }}
      style={{
        ...styles.popup,
        left: rightEdge - 200,
        top: Math.max(8, popupY)
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div style={styles.row}>
        <label style={styles.label}>W</label>
        <input
          style={styles.input}
          value={widthInput}
          onChange={handleWidthChange}
          type="number"
          min="1"
        />
        <button
          style={{
            ...styles.lockBtn,
            color: aspectLocked ? '#4fc3f7' : '#888'
          }}
          onClick={toggleAspectLock}
          title={aspectLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
        >
          {aspectLocked ? '🔗' : '🔓'}
        </button>
        <label style={styles.label}>H</label>
        <input
          style={styles.input}
          value={heightInput}
          onChange={handleHeightChange}
          type="number"
          min="1"
        />
      </div>
      <div style={styles.row}>
        <button style={styles.timerBtn} onClick={onTimerCapture} title="5s timer">
          ⏱
        </button>
        <div style={styles.spacer} />
        <button style={styles.cancelBtn} onClick={onCancel}>
          Cancel
        </button>
        <button style={styles.confirmBtn} onClick={onConfirm}>
          Capture
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  popup: {
    position: 'fixed',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '8px 10px',
    background: 'rgba(30, 30, 30, 0.92)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(12px)',
    zIndex: 1000,
    cursor: 'default'
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  label: {
    color: '#aaa',
    fontSize: '11px',
    fontWeight: 600,
    width: '14px',
    textAlign: 'center'
  },
  input: {
    width: '60px',
    padding: '3px 6px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '12px',
    textAlign: 'center',
    outline: 'none'
  },
  lockBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px 4px'
  },
  spacer: {
    flex: 1
  },
  timerBtn: {
    padding: '3px 8px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '4px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px'
  },
  cancelBtn: {
    padding: '3px 10px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '4px',
    color: '#ccc',
    cursor: 'pointer',
    fontSize: '12px'
  },
  confirmBtn: {
    padding: '3px 10px',
    background: '#0066cc',
    border: 'none',
    borderRadius: '4px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600
  }
}
