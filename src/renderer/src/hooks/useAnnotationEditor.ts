import { useCallback, useRef, useState } from 'react'
import {
  Annotation,
  HandleId,
  Point,
  ShapeKind,
  constrainEnd,
  handleAt,
  hitTest,
  isTooSmall,
  resizeAnnotation,
  translateAnnotation
} from '../annotations'

type Gesture =
  | { type: 'draw' }
  | { type: 'move'; origin: Point; original: Annotation; before: Annotation[] }
  | { type: 'resize'; handle: HandleId; original: Annotation; before: Annotation[] }

export interface DrawStyle {
  kind: ShapeKind
  color: string
  width: number
  outline: boolean
}

const HANDLE_CURSORS: Record<HandleId, string> = {
  start: 'move',
  end: 'move',
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize'
}

/**
 * Editing state for annotations: drawing new shapes, selecting, moving and
 * resizing existing ones, and an undo history of whole-list snapshots.
 * Pointer positions passed in are in image pixels.
 */
export function useAnnotationEditor() {
  const [annotations, setAnnotationsState] = useState<Annotation[]>([])
  const [draft, setDraftState] = useState<Annotation | null>(null)
  const [selectedId, setSelectedIdState] = useState<number | null>(null)
  const [canUndo, setCanUndo] = useState(false)

  // Refs mirror state so pointer handlers read the latest values without side
  // effects inside state updaters (StrictMode runs those twice).
  const annotationsRef = useRef<Annotation[]>([])
  const draftRef = useRef<Annotation | null>(null)
  const selectedIdRef = useRef<number | null>(null)
  const historyRef = useRef<Annotation[][]>([])
  const gestureRef = useRef<Gesture | null>(null)
  const nextIdRef = useRef(1)

  const setAnnotations = useCallback((next: Annotation[]) => {
    annotationsRef.current = next
    setAnnotationsState(next)
  }, [])

  const setDraft = useCallback((next: Annotation | null) => {
    draftRef.current = next
    setDraftState(next)
  }, [])

  const setSelectedId = useCallback((id: number | null) => {
    selectedIdRef.current = id
    setSelectedIdState(id)
  }, [])

  const pushHistory = useCallback((snapshot: Annotation[]) => {
    historyRef.current.push(snapshot)
    setCanUndo(true)
  }, [])

  /** Replaces the list as one undoable step. */
  const commit = useCallback(
    (next: Annotation[]) => {
      pushHistory(annotationsRef.current)
      setAnnotations(next)
    },
    [pushHistory, setAnnotations]
  )

  const selected = annotations.find((a) => a.id === selectedId) ?? null

  /** Topmost shape under `p`; the selected shape wins so it stays easy to grab. */
  const shapeAt = useCallback((p: Point, tolerance: number): Annotation | null => {
    const list = annotationsRef.current
    const current = list.find((a) => a.id === selectedIdRef.current)
    if (current && hitTest(current, p, tolerance)) return current
    for (let i = list.length - 1; i >= 0; i--) {
      if (hitTest(list[i], p, tolerance)) return list[i]
    }
    return null
  }, [])

  const selectedHandleAt = useCallback((p: Point, radius: number): HandleId | null => {
    const current = annotationsRef.current.find((a) => a.id === selectedIdRef.current)
    return current ? handleAt(current, p, radius) : null
  }, [])

  /**
   * Starts a gesture. Returns the shape that got selected, if any, so the
   * caller can sync the toolbar to its style.
   */
  const pointerDown = useCallback(
    (p: Point, style: DrawStyle, handleRadius: number, tolerance: number): Annotation | null => {
      const list = annotationsRef.current
      const current = list.find((a) => a.id === selectedIdRef.current)
      const handle = selectedHandleAt(p, handleRadius)
      if (current && handle) {
        gestureRef.current = { type: 'resize', handle, original: current, before: list }
        return null
      }
      const hit = shapeAt(p, tolerance)
      if (hit) {
        setSelectedId(hit.id)
        gestureRef.current = { type: 'move', origin: p, original: hit, before: list }
        return hit
      }
      setSelectedId(null)
      gestureRef.current = { type: 'draw' }
      setDraft({ id: nextIdRef.current++, ...style, start: p, end: p })
      return null
    },
    [selectedHandleAt, shapeAt, setSelectedId, setDraft]
  )

  const replaceInList = useCallback(
    (updated: Annotation) => {
      setAnnotations(annotationsRef.current.map((a) => (a.id === updated.id ? updated : a)))
    },
    [setAnnotations]
  )

  const pointerMove = useCallback(
    (p: Point, constrain: boolean) => {
      const g = gestureRef.current
      if (!g) return
      if (g.type === 'draw') {
        const d = draftRef.current
        if (d) setDraft({ ...d, end: constrain ? constrainEnd(d.kind, d.start, p) : p })
      } else if (g.type === 'move') {
        replaceInList(translateAnnotation(g.original, p.x - g.origin.x, p.y - g.origin.y))
      } else {
        replaceInList(resizeAnnotation(g.original, g.handle, p, constrain))
      }
    },
    [setDraft, replaceInList]
  )

  const pointerUp = useCallback(() => {
    const g = gestureRef.current
    gestureRef.current = null
    if (!g) return
    if (g.type === 'draw') {
      const d = draftRef.current
      setDraft(null)
      // A new shape is not selected, so picking a color for the next shape
      // does not recolor the one just drawn.
      if (d && !isTooSmall(d)) commit([...annotationsRef.current, d])
      return
    }
    const now = annotationsRef.current.find((a) => a.id === g.original.id)
    if (!now || now === g.original) return
    if (isTooSmall(now)) {
      // A resize that collapses the shape is rejected rather than kept invisible.
      setAnnotations(g.before)
      return
    }
    pushHistory(g.before)
  }, [setDraft, commit, setAnnotations, pushHistory])

  /** Cancels an in-progress gesture, restoring a moved or resized shape. */
  const cancelGesture = useCallback(() => {
    const g = gestureRef.current
    gestureRef.current = null
    if (g && g.type !== 'draw') setAnnotations(g.before)
    setDraft(null)
  }, [setAnnotations, setDraft])

  const cursorAt = useCallback(
    (p: Point, handleRadius: number, tolerance: number): string => {
      const handle = selectedHandleAt(p, handleRadius)
      if (handle) return HANDLE_CURSORS[handle]
      return shapeAt(p, tolerance) ? 'move' : 'crosshair'
    },
    [selectedHandleAt, shapeAt]
  )

  const updateSelected = useCallback(
    (patch: Partial<Pick<Annotation, 'color' | 'outline' | 'width'>>) => {
      const current = annotationsRef.current.find((a) => a.id === selectedIdRef.current)
      if (!current || current.kind === 'mosaic') return
      const updated = { ...current, ...patch }
      if (
        updated.color === current.color &&
        updated.outline === current.outline &&
        updated.width === current.width
      ) {
        return
      }
      commit(annotationsRef.current.map((a) => (a.id === current.id ? updated : a)))
    },
    [commit]
  )

  const deleteSelected = useCallback(() => {
    const id = selectedIdRef.current
    if (id === null) return
    commit(annotationsRef.current.filter((a) => a.id !== id))
    setSelectedId(null)
  }, [commit, setSelectedId])

  const undo = useCallback(() => {
    const prev = historyRef.current.pop()
    if (!prev) return
    setCanUndo(historyRef.current.length > 0)
    setAnnotations(prev)
    if (!prev.some((a) => a.id === selectedIdRef.current)) setSelectedId(null)
  }, [setAnnotations, setSelectedId])

  /** Shifts every shape and every undo snapshot, e.g. after a crop moves the origin. */
  const translateAll = useCallback(
    (dx: number, dy: number) => {
      const shift = (list: Annotation[]): Annotation[] => list.map((a) => translateAnnotation(a, dx, dy))
      historyRef.current = historyRef.current.map(shift)
      setAnnotations(shift(annotationsRef.current))
    },
    [setAnnotations]
  )

  return {
    annotations,
    draft,
    selected,
    canUndo,
    pointerDown,
    pointerMove,
    pointerUp,
    cancelGesture,
    cursorAt,
    select: setSelectedId,
    updateSelected,
    deleteSelected,
    undo,
    translateAll
  }
}
