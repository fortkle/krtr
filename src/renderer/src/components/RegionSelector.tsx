import { useEffect, useRef, useState } from 'react'
import { useRegionSelect } from '../hooks/useRegionSelect'

export function RegionSelector(): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [screenshotImage, setScreenshotImage] = useState<HTMLImageElement | null>(null)
  const { selection, isDragging } = useRegionSelect(canvasRef)

  useEffect(() => {
    const cleanup = window.api.onScreenshotData((dataUrl) => {
      setScreenshotUrl(dataUrl)
    })
    window.api.sendOverlayReady()
    return cleanup
  }, [])

  useEffect(() => {
    if (!screenshotUrl) return
    const img = new Image()
    img.onload = () => setScreenshotImage(img)
    img.src = screenshotUrl
  }, [screenshotUrl])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !screenshotImage) return

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

    ctx.drawImage(screenshotImage, 0, 0, w, h)

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
    ctx.fillRect(0, 0, w, h)

    if (selection) {
      const { x, y, width, height } = selection
      ctx.save()
      ctx.beginPath()
      ctx.rect(x, y, width, height)
      ctx.clip()
      ctx.drawImage(screenshotImage, 0, 0, w, h)
      ctx.restore()

      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1
      ctx.strokeRect(x, y, width, height)

      const label = `${Math.round(width * (window.devicePixelRatio || 1))} × ${Math.round(height * (window.devicePixelRatio || 1))}`
      const labelX = x + width / 2
      const labelY = y > 25 ? y - 8 : y + height + 18
      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.textAlign = 'center'
      const metrics = ctx.measureText(label)
      const pad = 4
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(
        labelX - metrics.width / 2 - pad,
        labelY - 12,
        metrics.width + pad * 2,
        16
      )
      ctx.fillStyle = '#ffffff'
      ctx.fillText(label, labelX, labelY)
    }
  }, [screenshotImage, selection, isDragging])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        window.api.sendCancelled()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return <canvas ref={canvasRef} />
}
