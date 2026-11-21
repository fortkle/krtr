import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Annotation,
  COLORS,
  Point,
  ShapeKind,
  bounds,
  flattenAnnotations,
  handlesOf,
  loadImage,
  paintOrder,
  pixelate,
  shapeLayers
} from '../annotations'
import { useAnnotationEditor } from '../hooks/useAnnotationEditor'

type Tool = ShapeKind | 'crop'

const TOOLS: { tool: Tool; label: string; key: string; icon: React.ReactElement }[] = [
  {
    tool: 'arrow',
    label: 'Arrow',
    key: 'a',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2.5 13.5 L10 6 L8 4 L14 2 L12 8 L10 6 L3.5 14.5 Z" />
      </svg>
    )
  },
  {
    tool: 'rect',
    label: 'Rectangle',
    key: 'r',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2.5" y="3.5" width="11" height="9" rx="1" />
      </svg>
    )
  },
  {
    tool: 'ellipse',
    label: 'Ellipse',
    key: 'o',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
        <ellipse cx="8" cy="8" rx="5.5" ry="4.5" />
      </svg>
    )
  },
  {
    tool: 'mosaic',
    label: 'Mosaic',
    key: 'm',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <rect x="2" y="2" width="4" height="4" />
        <rect x="10" y="2" width="4" height="4" />
        <rect x="6" y="6" width="4" height="4" />
        <rect x="2" y="10" width="4" height="4" />
        <rect x="10" y="10" width="4" height="4" />
        <rect x="6" y="2" width="4" height="4" opacity="0.45" />
        <rect x="2" y="6" width="4" height="4" opacity="0.45" />
        <rect x="10" y="6" width="4" height="4" opacity="0.45" />
        <rect x="6" y="10" width="4" height="4" opacity="0.45" />
      </svg>
    )
  },
  {
    tool: 'crop',
    label: 'Crop',
    key: 'c',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 1.5 V12 H14.5 M1.5 4 H12 V14.5" />
      </svg>
    )
  }
]

// Screenshots are captured at device pixels, so scale strokes to look
// consistent at the size the image is normally viewed.
const DPR = Math.max(1, window.devicePixelRatio)
// Five thickness levels in CSS pixels; the middle one is the default.
const STROKE_LEVELS = [2.5, 3.5, 5, 7, 10].map((w) => w * DPR)
const DEFAULT_STROKE_LEVEL = 2
// Line thickness of each level's icon in the toolbar, in icon pixels.
const STROKE_ICON_WIDTHS = [1, 1.6, 2.4, 3.4, 4.6]

function nearestStrokeLevel(width: number): number {
  let best = 0
  STROKE_LEVELS.forEach((w, i) => {
    if (Math.abs(w - width) < Math.abs(STROKE_LEVELS[best] - width)) best = i
  })
  return best
}
// Large enough that text a few lines high cannot be read through it.
const MOSAIC_BLOCK = 12 * DPR
// Grab areas in CSS pixels; converted to image pixels at the current zoom.
const HANDLE_RADIUS_CSS = 6
const HIT_TOLERANCE_CSS = 5

const SELECTION_COLOR = '#0a84ff'

interface Box {
  x: number
  y: number
  w: number
  h: number
}

export function PreviewWindow(): React.ReactElement {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null)
  const [filename, setFilename] = useState('image')
  const [editing, setEditing] = useState(false)
  const [overlayBox, setOverlayBox] = useState<Box | null>(null)
  const [selection, setSelection] = useState<Box | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const [tool, setTool] = useState<Tool>('crop')
  const [color, setColor] = useState<string>(COLORS[0])
  const [outline, setOutline] = useState(true)
  const [strokeLevel, setStrokeLevel] = useState(DEFAULT_STROKE_LEVEL)
  const [widthMenuOpen, setWidthMenuOpen] = useState(false)
  const widthMenuRef = useRef<HTMLDivElement>(null)
  const [cursor, setCursor] = useState('crosshair')
  const [pixelatedUrl, setPixelatedUrl] = useState<string | null>(null)
  const editor = useAnnotationEditor()
  const { annotations, draft, selected } = editor
  const bakeSeqRef = useRef(0)
  const hasBakedRef = useRef(false)
  const bakePromiseRef = useRef<Promise<void>>(Promise.resolve())
  const flushBakeRef = useRef<(() => void) | null>(null)

  // Image pixels per CSS pixel at the current zoom.
  const scale = imageSize && overlayBox && overlayBox.w > 0 ? imageSize.w / overlayBox.w : 1

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

  // The pixelated image is only built once mosaics are in play.
  const needsPixelated =
    tool === 'mosaic' || annotations.some((a) => a.kind === 'mosaic') || draft?.kind === 'mosaic'
  useEffect(() => {
    if (!imageUrl || !needsPixelated) return
    let cancelled = false
    loadImage(imageUrl)
      .then((img) => {
        if (!cancelled) setPixelatedUrl(pixelate(img, MOSAIC_BLOCK).toDataURL())
      })
      .catch((err) => console.error('Failed to pixelate image', err))
    return () => {
      cancelled = true
    }
  }, [imageUrl, needsPixelated])

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

  // Flatten annotations into the temp file once edits settle, so copy, save
  // and drag hand out what is on screen without re-encoding on every move.
  useEffect(() => {
    if (!imageUrl) return
    if (annotations.length === 0 && !hasBakedRef.current) return
    const seq = ++bakeSeqRef.current
    const run = (): void => {
      flushBakeRef.current = null
      bakePromiseRef.current = (async () => {
        const dataUrl =
          annotations.length > 0
            ? await flattenAnnotations(imageUrl, annotations, MOSAIC_BLOCK)
            : null
        if (seq !== bakeSeqRef.current) return
        hasBakedRef.current = dataUrl !== null
        await window.api.setAnnotatedImage(dataUrl)
      })().catch((err) => console.error('Failed to apply annotations', err))
    }
    const timer = setTimeout(run, 150)
    flushBakeRef.current = () => {
      clearTimeout(timer)
      run()
    }
    return () => clearTimeout(timer)
  }, [imageUrl, annotations])

  const flushBake = useCallback(async () => {
    flushBakeRef.current?.()
    await bakePromiseRef.current
  }, [])

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    window.api.startDrag()
  }, [])

  const handleSave = useCallback(async () => {
    await flushBake()
    window.api.saveToDesktop()
  }, [flushBake])

  const handleCopy = useCallback(async () => {
    await flushBake()
    window.api.copyToClipboard()
  }, [flushBake])

  const updateOverlayBox = useCallback(() => {
    const img = imgRef.current
    const canvas = canvasRef.current
    if (!img || !canvas) return
    const ir = img.getBoundingClientRect()
    const cr = canvas.getBoundingClientRect()
    setOverlayBox({ x: ir.left - cr.left, y: ir.top - cr.top, w: ir.width, h: ir.height })
  }, [])

  const handleCancelCrop = useCallback(() => {
    setSelection(null)
    dragStartRef.current = null
  }, [])

  useEffect(() => {
    updateOverlayBox()
    const handleResize = (): void => {
      setSelection(null)
      updateOverlayBox()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [imageUrl, updateOverlayBox])

  const selectTool = useCallback(
    (next: Tool) => {
      editor.select(null)
      if (next !== 'crop') handleCancelCrop()
      setCursor('crosshair')
      setTool(next)
    },
    [editor, handleCancelCrop]
  )

  const handleColor = useCallback(
    (c: string) => {
      setColor(c)
      editor.updateSelected({ color: c })
    },
    [editor]
  )

  const handleStrokeLevel = useCallback(
    (level: number) => {
      setStrokeLevel(level)
      setWidthMenuOpen(false)
      editor.updateSelected({ width: STROKE_LEVELS[level] })
    },
    [editor]
  )

  useEffect(() => {
    if (!widthMenuOpen) return
    const close = (e: PointerEvent): void => {
      if (e.target instanceof Node && widthMenuRef.current?.contains(e.target)) return
      setWidthMenuOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [widthMenuOpen])

  const handleOutline = useCallback(() => {
    const next = !outline
    setOutline(next)
    editor.updateSelected({ outline: next })
  }, [outline, editor])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'Escape') {
        setWidthMenuOpen(false)
        handleCancelCrop()
        editor.cancelGesture()
        editor.select(null)
        return
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        editor.deleteSelected()
        return
      }
      if (e.metaKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        editor.undo()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const match = TOOLS.find((t) => t.key === e.key.toLowerCase())
      if (match) {
        selectTool(match.tool)
        return
      }
      const level = Number(e.key) - 1
      if (Number.isInteger(level) && level >= 0 && level < STROKE_LEVELS.length) {
        handleStrokeLevel(level)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleCancelCrop, editor, selectTool, handleStrokeLevel])

  const clampToOverlay = useCallback(
    (clientX: number, clientY: number, target: HTMLElement): { x: number; y: number } => {
      const rect = target.getBoundingClientRect()
      return {
        x: Math.min(Math.max(0, clientX - rect.left), rect.width),
        y: Math.min(Math.max(0, clientY - rect.top), rect.height)
      }
    },
    []
  )

  const handleCropPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const pos = clampToOverlay(e.clientX, e.clientY, e.currentTarget)
      dragStartRef.current = pos
      setSelection({ x: pos.x, y: pos.y, w: 0, h: 0 })
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [clampToOverlay]
  )

  const handleCropPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const start = dragStartRef.current
      if (!start) return
      const pos = clampToOverlay(e.clientX, e.clientY, e.currentTarget)
      setSelection({
        x: Math.min(start.x, pos.x),
        y: Math.min(start.y, pos.y),
        w: Math.abs(pos.x - start.x),
        h: Math.abs(pos.y - start.y)
      })
    },
    [clampToOverlay]
  )

  const handleCropPointerUp = useCallback(() => {
    dragStartRef.current = null
    setSelection((sel) => (sel && sel.w >= 2 && sel.h >= 2 ? sel : null))
  }, [])

  const toImagePoint = useCallback(
    (e: React.PointerEvent<HTMLDivElement>): Point => {
      const pos = clampToOverlay(e.clientX, e.clientY, e.currentTarget)
      return { x: pos.x * scale, y: pos.y * scale }
    },
    [clampToOverlay, scale]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      if (tool === 'crop') {
        handleCropPointerDown(e)
        return
      }
      const grabbed = editor.pointerDown(
        toImagePoint(e),
        { kind: tool, color, width: STROKE_LEVELS[strokeLevel], outline },
        HANDLE_RADIUS_CSS * scale,
        HIT_TOLERANCE_CSS * scale
      )
      // Selecting a shape shows its style in the toolbar, as in Skitch.
      if (grabbed && grabbed.kind !== 'mosaic') {
        setColor(grabbed.color)
        setOutline(grabbed.outline)
        setStrokeLevel(nearestStrokeLevel(grabbed.width))
      }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [tool, color, outline, strokeLevel, scale, editor, handleCropPointerDown, toImagePoint]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (tool === 'crop') {
        handleCropPointerMove(e)
        return
      }
      const p = toImagePoint(e)
      if (e.buttons & 1) {
        editor.pointerMove(p, e.shiftKey)
      } else {
        setCursor(editor.cursorAt(p, HANDLE_RADIUS_CSS * scale, HIT_TOLERANCE_CSS * scale))
      }
    },
    [tool, scale, editor, handleCropPointerMove, toImagePoint]
  )

  const handlePointerUp = useCallback(() => {
    if (tool === 'crop') {
      handleCropPointerUp()
      return
    }
    editor.pointerUp()
  }, [tool, editor, handleCropPointerUp])

  const canApplyCrop = selection !== null && selection.w >= 2 && selection.h >= 2

  const handleApplyCrop = useCallback(async () => {
    if (!selection || !overlayBox || !imageSize) return
    if (selection.w < 2 || selection.h < 2) return
    const scaleX = imageSize.w / overlayBox.w
    const scaleY = imageSize.h / overlayBox.h
    const result = await window.api.cropImage({
      x: selection.x * scaleX,
      y: selection.y * scaleY,
      width: selection.w * scaleX,
      height: selection.h * scaleY
    })
    if (result) {
      setImageUrl(result.dataUrl)
      editor.translateAll(-result.offsetX, -result.offsetY)
    }
    handleCancelCrop()
  }, [selection, overlayBox, imageSize, editor, handleCancelCrop])

  const renderShape = (a: Annotation): React.ReactNode => {
    if (a.kind === 'mosaic') {
      const b = bounds(a)
      if (!pixelatedUrl || !imageSize) {
        return <rect key={a.id} x={b.x} y={b.y} width={b.w} height={b.h} fill="rgba(128, 128, 128, 0.6)" />
      }
      const clipId = `mosaic-clip-${a.id}`
      return (
        <g key={a.id}>
          <clipPath id={clipId}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} />
          </clipPath>
          <image
            href={pixelatedUrl}
            x={0}
            y={0}
            width={imageSize.w}
            height={imageSize.h}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="none"
          />
        </g>
      )
    }
    return (
      <g key={a.id}>
        {shapeLayers(a).map((layer, i) => (
          <path
            key={i}
            d={layer.d}
            fill={layer.fill ?? 'none'}
            stroke={layer.stroke ?? 'none'}
            strokeWidth={layer.strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </g>
    )
  }

  const renderSelectionFrame = (a: Annotation, withHandles: boolean): React.ReactNode => {
    const line = 1.2 * scale
    const b = bounds(a)
    return (
      <g>
        {a.kind !== 'arrow' && (
          <>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="none" stroke="#fff" strokeWidth={line} />
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              fill="none"
              stroke={SELECTION_COLOR}
              strokeWidth={line}
              strokeDasharray={`${4 * scale} ${3 * scale}`}
            />
          </>
        )}
        {withHandles &&
          handlesOf(a).map((h) => (
            <circle
              key={h.id}
              cx={h.point.x}
              cy={h.point.y}
              r={4.5 * scale}
              fill="#fff"
              stroke={SELECTION_COLOR}
              strokeWidth={1.5 * scale}
            />
          ))}
      </g>
    )
  }

  if (!imageUrl) {
    return <div style={styles.loading}>Loading...</div>
  }

  const shapeStyleEnabled =
    (tool !== 'mosaic' && tool !== 'crop') || (selected !== null && selected.kind !== 'mosaic')

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.toolGroup}>
          {TOOLS.map((t) => (
            <button
              key={t.tool}
              style={tool === t.tool ? styles.toolButtonActive : styles.toolButton}
              onClick={() => selectTool(t.tool)}
              title={`${t.label} (${t.key.toUpperCase()})`}
            >
              {t.icon}
            </button>
          ))}
          <div style={styles.separator} />
          <div style={shapeStyleEnabled ? styles.styleGroup : styles.styleGroupDimmed}>
            {COLORS.map((c) => (
              <button
                key={c}
                style={{
                  ...styles.swatch,
                  background: c,
                  boxShadow: color === c ? '0 0 0 2px #252525, 0 0 0 3.5px #fff' : 'none'
                }}
                onClick={() => handleColor(c)}
                title={c}
              />
            ))}
            <button
              style={outline ? styles.toolButtonActive : styles.toolButton}
              onClick={handleOutline}
              title={outline ? 'White outline: on' : 'White outline: off'}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="3.2" />
                <circle cx="8" cy="8" r="5.5" stroke={color} strokeWidth="1.6" />
              </svg>
            </button>
            <div ref={widthMenuRef} style={styles.widthPicker}>
              <button
                style={widthMenuOpen ? styles.toolButtonActive : styles.toolButton}
                onClick={() => setWidthMenuOpen((open) => !open)}
                title={`Thickness ${strokeLevel + 1} (1–5)`}
              >
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <line
                    x1="3"
                    y1="8"
                    x2="13"
                    y2="8"
                    stroke="currentColor"
                    strokeWidth={STROKE_ICON_WIDTHS[strokeLevel]}
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              {widthMenuOpen && (
                <div style={styles.widthMenu}>
                  {STROKE_ICON_WIDTHS.map((w, level) => (
                    <button
                      key={level}
                      style={level === strokeLevel ? styles.widthOptionActive : styles.widthOption}
                      onClick={() => handleStrokeLevel(level)}
                      title={`Thickness ${level + 1} (${level + 1})`}
                    >
                      <svg width="40" height="12" viewBox="0 0 40 12">
                        <line
                          x1="4"
                          y1="6"
                          x2="36"
                          y2="6"
                          stroke="currentColor"
                          strokeWidth={w}
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div style={styles.separator} />
          <button
            style={editor.canUndo ? styles.toolButton : styles.toolButtonDisabled}
            onClick={editor.undo}
            disabled={!editor.canUndo}
            title="Undo (⌘Z)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5.5 3 L2.5 6 L5.5 9 M2.5 6 H10 A3.5 3.5 0 0 1 10 13 H7" />
            </svg>
          </button>
        </div>
      </div>

      <div style={styles.body}>
        <div ref={canvasRef} style={styles.canvas}>
          <img
            ref={imgRef}
            src={imageUrl}
            style={styles.image}
            draggable={false}
            onLoad={updateOverlayBox}
          />
          {overlayBox && (
            <div
              style={{
                ...styles.cropOverlay,
                cursor: tool === 'crop' ? 'crosshair' : cursor,
                left: overlayBox.x,
                top: overlayBox.y,
                width: overlayBox.w,
                height: overlayBox.h
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {imageSize && (
                <svg
                  viewBox={`0 0 ${imageSize.w} ${imageSize.h}`}
                  preserveAspectRatio="none"
                  style={styles.annotationLayer}
                >
                  {paintOrder(draft ? [...annotations, draft] : annotations).map(renderShape)}
                  {draft?.kind === 'mosaic' && renderSelectionFrame(draft, false)}
                  {selected && !draft && renderSelectionFrame(selected, true)}
                </svg>
              )}
              {selection && (
                <div
                  style={{
                    ...styles.cropSelection,
                    left: selection.x,
                    top: selection.y,
                    width: selection.w,
                    height: selection.h
                  }}
                />
              )}
            </div>
          )}
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
          {selection ? (
            <>
              <button
                onClick={handleApplyCrop}
                style={canApplyCrop ? styles.primaryButton : styles.buttonDisabled}
                disabled={!canApplyCrop}
                title="Apply crop"
              >
                Apply
              </button>
              <button onClick={handleCancelCrop} style={styles.button} title="Cancel crop">
                Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={handleCopy} style={styles.button} title="Copy to clipboard">
                Copy
              </button>
              <button onClick={handleSave} style={styles.button} title="Save">
                Save
              </button>
              <div
                style={styles.dragTab}
                draggable
                onMouseDown={() => void flushBake()}
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
            </>
          )}
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
    // Leave room for the inset traffic lights on the left.
    padding: '4px 8px 4px 76px',
    background: '#252525',
    borderBottom: '1px solid #3a3a3a',
    minHeight: '34px',
    // Keeps the thickness menu above the image area.
    position: 'relative',
    zIndex: 5,
    // @ts-expect-error Electron-specific CSS property for window dragging
    WebkitAppRegion: 'drag'
  },
  widthPicker: {
    position: 'relative'
  },
  widthMenu: {
    position: 'absolute',
    top: '28px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '4px',
    background: '#2e2e2e',
    border: '1px solid #444',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)'
  },
  widthOption: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 6px',
    border: 'none',
    borderRadius: '4px',
    background: 'transparent',
    color: '#ddd',
    cursor: 'pointer'
  },
  widthOptionActive: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 6px',
    border: 'none',
    borderRadius: '4px',
    background: '#0066cc',
    color: '#fff',
    cursor: 'pointer'
  },
  toolGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    // @ts-expect-error Electron-specific CSS property for window dragging
    WebkitAppRegion: 'no-drag'
  },
  toolButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '26px',
    height: '24px',
    padding: 0,
    border: 'none',
    borderRadius: '4px',
    background: 'transparent',
    color: '#bbb',
    cursor: 'pointer'
  },
  toolButtonActive: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '26px',
    height: '24px',
    padding: 0,
    border: 'none',
    borderRadius: '4px',
    background: '#0066cc',
    color: '#fff',
    cursor: 'pointer'
  },
  toolButtonDisabled: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '26px',
    height: '24px',
    padding: 0,
    border: 'none',
    borderRadius: '4px',
    background: 'transparent',
    color: '#555',
    cursor: 'default'
  },
  styleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px'
  },
  styleGroupDimmed: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    opacity: 0.4
  },
  separator: {
    width: '1px',
    height: '16px',
    margin: '0 4px',
    background: '#444'
  },
  swatch: {
    width: '14px',
    height: '14px',
    padding: 0,
    margin: '0 1px',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    borderRadius: '50%',
    cursor: 'pointer'
  },
  annotationLayer: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none'
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
    overflow: 'hidden',
    position: 'relative'
  },
  cropOverlay: {
    position: 'absolute',
    overflow: 'hidden',
    cursor: 'crosshair',
    touchAction: 'none'
  },
  cropSelection: {
    position: 'absolute',
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
    pointerEvents: 'none'
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
  primaryButton: {
    padding: '4px 12px',
    border: '1px solid #0066cc',
    borderRadius: '4px',
    background: '#0066cc',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
    lineHeight: '18px'
  },
  buttonDisabled: {
    padding: '4px 12px',
    border: '1px solid #444',
    borderRadius: '4px',
    background: '#2e2e2e',
    color: '#666',
    cursor: 'default',
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
