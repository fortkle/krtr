import { useCallback, useEffect, useRef, useState } from 'react'
import type { Rectangle } from '../../../shared/types'

type Mode = 'idle' | 'selecting' | 'adjusting' | 'moving' | 'resizing'
type HandlePosition = 'nw' | 'ne' | 'sw' | 'se'

const HANDLE_SIZE = 8
const HANDLE_HIT_SIZE = 16

export interface RegionSelectState {
  selection: Rectangle | null
  mode: Mode
  activeHandle: HandlePosition | null
  aspectLocked: boolean
  setAspectLocked: (locked: boolean) => void
  updateSelection: (rect: Rectangle) => void
  confirm: () => void
  cancel: () => void
}

function getHandleAtPoint(
  x: number,
  y: number,
  rect: Rectangle
): HandlePosition | null {
  const half = HANDLE_HIT_SIZE / 2
  const corners: [HandlePosition, number, number][] = [
    ['nw', rect.x, rect.y],
    ['ne', rect.x + rect.width, rect.y],
    ['sw', rect.x, rect.y + rect.height],
    ['se', rect.x + rect.width, rect.y + rect.height]
  ]
  for (const [pos, cx, cy] of corners) {
    if (Math.abs(x - cx) <= half && Math.abs(y - cy) <= half) return pos
  }
  return null
}

function isInsideRect(x: number, y: number, rect: Rectangle): boolean {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  )
}

function getCursorForHandle(handle: HandlePosition | null): string {
  if (!handle) return 'default'
  const map: Record<HandlePosition, string> = {
    nw: 'nwse-resize',
    se: 'nwse-resize',
    ne: 'nesw-resize',
    sw: 'nesw-resize'
  }
  return map[handle]
}

export function useRegionSelect(
  canvasRef: React.RefObject<HTMLCanvasElement | null>
): RegionSelectState {
  const [selection, setSelection] = useState<Rectangle | null>(null)
  const [mode, setMode] = useState<Mode>('idle')
  const [activeHandle, setActiveHandle] = useState<HandlePosition | null>(null)
  const [aspectLocked, setAspectLocked] = useState(false)

  const startPoint = useRef<{ x: number; y: number } | null>(null)
  const dragOrigin = useRef<{ x: number; y: number; rect: Rectangle } | null>(null)
  const aspectRatio = useRef<number>(1)
  const submitted = useRef(false)

  const updateSelection = useCallback((rect: Rectangle) => {
    setSelection(rect)
  }, [])

  const confirm = useCallback(() => {
    if (submitted.current) return
    setSelection((current) => {
      if (current && current.width > 5 && current.height > 5) {
        submitted.current = true
        const dpr = window.devicePixelRatio || 1
        window.api.sendRegionSelected({
          x: Math.round(current.x * dpr),
          y: Math.round(current.y * dpr),
          width: Math.round(current.width * dpr),
          height: Math.round(current.height * dpr)
        })
      }
      return current
    })
  }, [])

  const cancel = useCallback(() => {
    window.api.sendCancelled()
  }, [])

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      const x = e.clientX
      const y = e.clientY

      if (mode === 'adjusting' && selection) {
        const handle = getHandleAtPoint(x, y, selection)
        if (handle) {
          setActiveHandle(handle)
          setMode('resizing')
          aspectRatio.current = selection.width / selection.height
          dragOrigin.current = { x, y, rect: { ...selection } }
          return
        }

        if (isInsideRect(x, y, selection)) {
          setMode('moving')
          dragOrigin.current = { x, y, rect: { ...selection } }
          return
        }
      }

      startPoint.current = { x, y }
      submitted.current = false
      setMode('selecting')
      setSelection(null)
      setActiveHandle(null)
    },
    [mode, selection]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const x = e.clientX
      const y = e.clientY
      const canvas = canvasRef.current

      if (mode === 'selecting' && startPoint.current) {
        const start = startPoint.current
        setSelection({
          x: Math.min(start.x, x),
          y: Math.min(start.y, y),
          width: Math.abs(x - start.x),
          height: Math.abs(y - start.y)
        })
        return
      }

      if (mode === 'moving' && dragOrigin.current) {
        const dx = x - dragOrigin.current.x
        const dy = y - dragOrigin.current.y
        const orig = dragOrigin.current.rect
        setSelection({
          x: orig.x + dx,
          y: orig.y + dy,
          width: orig.width,
          height: orig.height
        })
        return
      }

      if (mode === 'resizing' && dragOrigin.current && activeHandle) {
        const orig = dragOrigin.current.rect
        let newRect = { ...orig }

        if (activeHandle === 'se') {
          newRect.width = Math.max(20, x - orig.x)
          newRect.height = Math.max(20, y - orig.y)
        } else if (activeHandle === 'nw') {
          newRect.width = Math.max(20, orig.x + orig.width - x)
          newRect.height = Math.max(20, orig.y + orig.height - y)
          newRect.x = orig.x + orig.width - newRect.width
          newRect.y = orig.y + orig.height - newRect.height
        } else if (activeHandle === 'ne') {
          newRect.width = Math.max(20, x - orig.x)
          newRect.height = Math.max(20, orig.y + orig.height - y)
          newRect.y = orig.y + orig.height - newRect.height
        } else if (activeHandle === 'sw') {
          newRect.width = Math.max(20, orig.x + orig.width - x)
          newRect.height = Math.max(20, y - orig.y)
          newRect.x = orig.x + orig.width - newRect.width
        }

        if (aspectLocked) {
          const ar = aspectRatio.current
          if (newRect.width / newRect.height > ar) {
            newRect.width = Math.round(newRect.height * ar)
          } else {
            newRect.height = Math.round(newRect.width / ar)
          }
        }

        setSelection(newRect)
        return
      }

      if (mode === 'adjusting' && selection && canvas) {
        const handle = getHandleAtPoint(x, y, selection)
        if (handle) {
          canvas.style.cursor = getCursorForHandle(handle)
        } else if (isInsideRect(x, y, selection)) {
          canvas.style.cursor = 'move'
        } else {
          canvas.style.cursor = 'crosshair'
        }
      }
    },
    [mode, activeHandle, aspectLocked, selection, canvasRef]
  )

  const handleMouseUp = useCallback(() => {
    if (mode === 'selecting') {
      setSelection((current) => {
        if (current && current.width > 5 && current.height > 5) {
          setMode('adjusting')
        } else {
          setMode('idle')
        }
        return current
      })
      startPoint.current = null
    } else if (mode === 'moving' || mode === 'resizing') {
      setMode('adjusting')
      setActiveHandle(null)
      dragOrigin.current = null
    }
  }, [mode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [canvasRef, handleMouseDown, handleMouseMove, handleMouseUp])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cancel])

  return {
    selection,
    mode,
    activeHandle,
    aspectLocked,
    setAspectLocked,
    updateSelection,
    confirm,
    cancel
  }
}

export { HANDLE_SIZE }
