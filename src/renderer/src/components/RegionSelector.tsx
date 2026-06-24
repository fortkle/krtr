import { useCallback, useEffect, useRef, useState } from 'react'
import { useRegionSelect, HANDLE_SIZE } from '../hooks/useRegionSelect'
import { AdjustmentPopup } from './AdjustmentPopup'

export function RegionSelector(): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const {
    selection,
    mode,
    aspectLocked,
    setAspectLocked,
    updateSelection,
    confirm,
    cancel
  } = useRegionSelect(canvasRef)

  useEffect(() => {
    setReady(true)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !ready) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = window.innerWidth
    const h = window.innerHeight

    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, w, h)

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, w, h)

    if (selection) {
      const { x, y, width, height } = selection

      ctx.clearRect(x, y, width, height)

      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.strokeRect(x, y, width, height)

      if (mode === 'adjusting' || mode === 'moving' || mode === 'resizing') {
        const handles: [number, number][] = [
          [x, y],
          [x + width, y],
          [x, y + height],
          [x + width, y + height]
        ]
        for (const [hx, hy] of handles) {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(
            hx - HANDLE_SIZE / 2,
            hy - HANDLE_SIZE / 2,
            HANDLE_SIZE,
            HANDLE_SIZE
          )
          ctx.strokeStyle = '#0066cc'
          ctx.lineWidth = 1
          ctx.strokeRect(
            hx - HANDLE_SIZE / 2,
            hy - HANDLE_SIZE / 2,
            HANDLE_SIZE,
            HANDLE_SIZE
          )
        }
      }

      if (mode === 'selecting') {
        const dpw = Math.round(width * dpr)
        const dph = Math.round(height * dpr)
        const label = `${dpw} × ${dph}`
        const labelX = x + width / 2
        const labelY = y > 25 ? y - 8 : y + height + 18
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif'
        ctx.textAlign = 'center'
        const metrics = ctx.measureText(label)
        const pad = 4
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
        ctx.fillRect(labelX - metrics.width / 2 - pad, labelY - 12, metrics.width + pad * 2, 16)
        ctx.fillStyle = '#ffffff'
        ctx.fillText(label, labelX, labelY)
      }
    }

    if (countdown !== null && selection) {
      const { x, y, width, height } = selection
      const cx = x + width / 2
      const cy = y + height / 2
      const r = 40
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fill()
      ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(String(countdown), cx, cy)
    }
  }, [ready, selection, mode, countdown])

  const handleTimerCapture = useCallback(() => {
    if (!selection) return
    window.api.setOverlayPassthrough(true)
    setCountdown(5)
    let remaining = 5
    const selectionSnapshot = { ...selection }
    countdownRef.current = setInterval(() => {
      remaining--
      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current)
        setCountdown(null)
        const dpr = window.devicePixelRatio || 1
        window.api.sendTimerCapture({
          x: Math.round(selectionSnapshot.x * dpr),
          y: Math.round(selectionSnapshot.y * dpr),
          width: Math.round(selectionSnapshot.width * dpr),
          height: Math.round(selectionSnapshot.height * dpr)
        })
      } else {
        setCountdown(remaining)
      }
    }, 1000)
  }, [selection])

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  const showPopup = mode === 'adjusting' && selection && countdown === null

  return (
    <>
      <canvas ref={canvasRef} />
      {showPopup && (
        <AdjustmentPopup
          selection={selection}
          aspectLocked={aspectLocked}
          onAspectLockedChange={setAspectLocked}
          onSelectionChange={updateSelection}
          onConfirm={confirm}
          onCancel={cancel}
          onTimerCapture={handleTimerCapture}
        />
      )}
    </>
  )
}
