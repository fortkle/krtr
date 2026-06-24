import { useCallback, useEffect, useRef, useState } from 'react'
import type { Rectangle } from '../../../shared/types'

interface RegionSelectState {
  selection: Rectangle | null
  isDragging: boolean
}

export function useRegionSelect(
  canvasRef: React.RefObject<HTMLCanvasElement | null>
): RegionSelectState {
  const [selection, setSelection] = useState<Rectangle | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const startPoint = useRef<{ x: number; y: number } | null>(null)

  const handleMouseDown = useCallback((e: MouseEvent) => {
    startPoint.current = { x: e.clientX, y: e.clientY }
    setIsDragging(true)
    setSelection(null)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!startPoint.current) return
    const start = startPoint.current
    const x = Math.min(start.x, e.clientX)
    const y = Math.min(start.y, e.clientY)
    const width = Math.abs(e.clientX - start.x)
    const height = Math.abs(e.clientY - start.y)
    setSelection({ x, y, width, height })
  }, [])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    startPoint.current = null
    setSelection((current) => {
      if (current && current.width > 5 && current.height > 5) {
        const dpr = window.devicePixelRatio || 1
        window.api.sendRegionSelected({
          x: Math.round(current.x * dpr),
          y: Math.round(current.y * dpr),
          width: Math.round(current.width * dpr),
          height: Math.round(current.height * dpr)
        })
      } else {
        window.api.sendCancelled()
      }
      return current
    })
  }, [])

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

  return { selection, isDragging }
}
