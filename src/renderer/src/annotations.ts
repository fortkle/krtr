export type ShapeKind = 'arrow' | 'rect' | 'ellipse' | 'mosaic'

export interface Point {
  x: number
  y: number
}

export interface Bounds {
  x: number
  y: number
  w: number
  h: number
}

/** A shape drawn on the screenshot. Coordinates are in image pixels. */
export interface Annotation {
  id: number
  kind: ShapeKind
  color: string
  width: number
  outline: boolean
  start: Point
  end: Point
}

/** One paint pass of a shape. The same layers drive the SVG preview and the canvas export. */
export interface ShapeLayer {
  d: string
  fill: string | null
  stroke: string | null
  strokeWidth: number
}

/** Corner handles for box shapes, endpoint handles for arrows. */
export type HandleId = 'start' | 'end' | 'nw' | 'ne' | 'sw' | 'se'

export const COLORS = ['#e5483e', '#f4a23a', '#3d8fd8', '#4cb84b', '#ea4c7c']

const OUTLINE_COLOR = 'rgba(255, 255, 255, 0.95)'

export function bounds(a: Annotation): Bounds {
  return {
    x: Math.min(a.start.x, a.end.x),
    y: Math.min(a.start.y, a.end.y),
    w: Math.abs(a.end.x - a.start.x),
    h: Math.abs(a.end.y - a.start.y)
  }
}

function rectPath(b: Bounds): string {
  return `M ${b.x} ${b.y} H ${b.x + b.w} V ${b.y + b.h} H ${b.x} Z`
}

function ellipsePath(b: Bounds): string {
  const rx = b.w / 2
  const ry = b.h / 2
  const cx = b.x + rx
  const cy = b.y + ry
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`
}

interface ArrowGeometry {
  head: number
}

function arrowGeometry(len: number, width: number): ArrowGeometry & { headLen: number } {
  const headLen = Math.min(len * 0.6, width * 5)
  return { headLen, head: Math.min(headLen * 0.6, width * 2.6) }
}

/** Tapered arrow with swept-back barbs, drawn as a filled polygon. */
function arrowPath(start: Point, end: Point, width: number): string {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const len = Math.hypot(dx, dy)
  if (len < 1) return ''
  const ux = dx / len
  const uy = dy / len
  const nx = -uy
  const ny = ux

  const { headLen, head } = arrowGeometry(len, width)
  const neckHalf = width * 0.9
  const tailHalf = width * 0.25

  const barb = { x: end.x - ux * headLen, y: end.y - uy * headLen }
  const neck = { x: end.x - ux * headLen * 0.75, y: end.y - uy * headLen * 0.75 }

  const pts: Point[] = [
    { x: start.x + nx * tailHalf, y: start.y + ny * tailHalf },
    { x: neck.x + nx * neckHalf, y: neck.y + ny * neckHalf },
    { x: barb.x + nx * head, y: barb.y + ny * head },
    end,
    { x: barb.x - nx * head, y: barb.y - ny * head },
    { x: neck.x - nx * neckHalf, y: neck.y - ny * neckHalf },
    { x: start.x - nx * tailHalf, y: start.y - ny * tailHalf }
  ]
  return 'M ' + pts.map((p) => `${p.x} ${p.y}`).join(' L ') + ' Z'
}

/** Vector layers of a shape. Mosaics have none; they are painted from the pixelated image. */
export function shapeLayers(a: Annotation): ShapeLayer[] {
  if (a.kind === 'mosaic') return []
  const outlineExtra = Math.max(1, a.width * 0.3) * 2

  if (a.kind === 'arrow') {
    const d = arrowPath(a.start, a.end, a.width)
    if (!d) return []
    const edge = a.width * 0.35
    const body: ShapeLayer = { d, fill: a.color, stroke: a.color, strokeWidth: edge }
    if (!a.outline) return [body]
    return [{ d, fill: null, stroke: OUTLINE_COLOR, strokeWidth: edge + outlineExtra }, body]
  }

  const b = bounds(a)
  const d = a.kind === 'rect' ? rectPath(b) : ellipsePath(b)
  const body: ShapeLayer = { d, fill: null, stroke: a.color, strokeWidth: a.width }
  if (!a.outline) return [body]
  return [{ d, fill: null, stroke: OUTLINE_COLOR, strokeWidth: a.width + outlineExtra }, body]
}

/** Mosaics are painted first so they never hide arrows or frames drawn on top of them. */
export function paintOrder(list: Annotation[]): Annotation[] {
  return [...list.filter((a) => a.kind === 'mosaic'), ...list.filter((a) => a.kind !== 'mosaic')]
}

/** Constrains a drag: square/circle for box shapes, 45° steps for arrows. */
export function constrainEnd(kind: ShapeKind, start: Point, end: Point): Point {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (kind === 'arrow') {
    const len = Math.hypot(dx, dy)
    const step = Math.PI / 4
    const angle = Math.round(Math.atan2(dy, dx) / step) * step
    return { x: start.x + Math.cos(angle) * len, y: start.y + Math.sin(angle) * len }
  }
  const size = Math.max(Math.abs(dx), Math.abs(dy))
  return { x: start.x + Math.sign(dx || 1) * size, y: start.y + Math.sign(dy || 1) * size }
}

export function isTooSmall(a: Annotation): boolean {
  const dx = Math.abs(a.end.x - a.start.x)
  const dy = Math.abs(a.end.y - a.start.y)
  const min = a.width * 2
  if (a.kind === 'arrow') return Math.hypot(dx, dy) < min
  if (a.kind === 'mosaic') return dx < min || dy < min
  return dx < min && dy < min
}

export function translateAnnotation(a: Annotation, dx: number, dy: number): Annotation {
  return {
    ...a,
    start: { x: a.start.x + dx, y: a.start.y + dy },
    end: { x: a.end.x + dx, y: a.end.y + dy }
  }
}

export function handlesOf(a: Annotation): { id: HandleId; point: Point }[] {
  if (a.kind === 'arrow') {
    return [
      { id: 'start', point: a.start },
      { id: 'end', point: a.end }
    ]
  }
  const b = bounds(a)
  return [
    { id: 'nw', point: { x: b.x, y: b.y } },
    { id: 'ne', point: { x: b.x + b.w, y: b.y } },
    { id: 'sw', point: { x: b.x, y: b.y + b.h } },
    { id: 'se', point: { x: b.x + b.w, y: b.y + b.h } }
  ]
}

export function handleAt(a: Annotation, p: Point, radius: number): HandleId | null {
  for (const h of handlesOf(a)) {
    if (Math.hypot(p.x - h.point.x, p.y - h.point.y) <= radius) return h.id
  }
  return null
}

/** Drags one handle to `p`. Box shapes keep the opposite corner fixed. */
export function resizeAnnotation(a: Annotation, handle: HandleId, p: Point, constrain: boolean): Annotation {
  if (a.kind === 'arrow') {
    if (handle === 'start') {
      return { ...a, start: constrain ? constrainEnd('arrow', a.end, p) : p }
    }
    return { ...a, end: constrain ? constrainEnd('arrow', a.start, p) : p }
  }
  const b = bounds(a)
  const anchor: Point = {
    x: handle === 'nw' || handle === 'sw' ? b.x + b.w : b.x,
    y: handle === 'nw' || handle === 'ne' ? b.y + b.h : b.y
  }
  return { ...a, start: anchor, end: constrain ? constrainEnd(a.kind, anchor, p) : p }
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/**
 * Whether `p` grabs the shape. Frames are grabbed by their line, not their
 * inside, so new shapes can still be drawn within a frame.
 */
export function hitTest(a: Annotation, p: Point, tolerance: number): boolean {
  const b = bounds(a)
  if (a.kind === 'mosaic') {
    return p.x >= b.x - tolerance && p.x <= b.x + b.w + tolerance && p.y >= b.y - tolerance && p.y <= b.y + b.h + tolerance
  }
  if (a.kind === 'arrow') {
    const len = Math.hypot(a.end.x - a.start.x, a.end.y - a.start.y)
    const reach = Math.max(a.width, arrowGeometry(len, a.width).head * 0.7) + tolerance
    return distanceToSegment(p, a.start, a.end) <= reach
  }
  const reach = a.width / 2 + tolerance
  if (a.kind === 'rect') {
    const inOuter = p.x >= b.x - reach && p.x <= b.x + b.w + reach && p.y >= b.y - reach && p.y <= b.y + b.h + reach
    const inInner = p.x > b.x + reach && p.x < b.x + b.w - reach && p.y > b.y + reach && p.y < b.y + b.h - reach
    return inOuter && !inInner
  }
  const rx = b.w / 2
  const ry = b.h / 2
  const dx = p.x - (b.x + rx)
  const dy = p.y - (b.y + ry)
  if (rx < 1 || ry < 1) return Math.hypot(dx, dy) <= Math.max(rx, ry) + reach
  const r = Math.hypot(dx / rx, dy / ry)
  if (r === 0) return Math.min(rx, ry) <= reach
  // Distance along the ray from the center to the ellipse edge.
  return Math.abs(1 - 1 / r) * Math.hypot(dx, dy) <= reach
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

/** The whole image pixelated into `block`-sized squares; mosaics show clipped parts of it. */
export function pixelate(img: HTMLImageElement, block: number): HTMLCanvasElement {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const small = document.createElement('canvas')
  small.width = Math.max(1, Math.ceil(w / block))
  small.height = Math.max(1, Math.ceil(h / block))
  const sctx = small.getContext('2d')
  if (!sctx) throw new Error('Canvas 2D context unavailable')
  sctx.imageSmoothingQuality = 'high'
  sctx.drawImage(img, 0, 0, small.width * block, small.height * block, 0, 0, small.width, small.height)

  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const octx = out.getContext('2d')
  if (!octx) throw new Error('Canvas 2D context unavailable')
  octx.imageSmoothingEnabled = false
  octx.drawImage(small, 0, 0, small.width * block, small.height * block)
  return out
}

/** Draws the annotations onto the image at full resolution and returns a PNG data URL. */
export async function flattenAnnotations(
  imageUrl: string,
  annotations: Annotation[],
  mosaicBlock: number
): Promise<string> {
  const img = await loadImage(imageUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  ctx.drawImage(img, 0, 0)
  const ordered = paintOrder(annotations)
  const pixelated = ordered.some((a) => a.kind === 'mosaic') ? pixelate(img, mosaicBlock) : null

  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const a of ordered) {
    if (a.kind === 'mosaic' && pixelated) {
      const b = bounds(a)
      ctx.save()
      ctx.beginPath()
      ctx.rect(b.x, b.y, b.w, b.h)
      ctx.clip()
      ctx.drawImage(pixelated, 0, 0)
      ctx.restore()
      continue
    }
    for (const layer of shapeLayers(a)) {
      const path = new Path2D(layer.d)
      if (layer.stroke) {
        ctx.strokeStyle = layer.stroke
        ctx.lineWidth = layer.strokeWidth
        ctx.stroke(path)
      }
      if (layer.fill) {
        ctx.fillStyle = layer.fill
        ctx.fill(path)
      }
    }
  }
  return canvas.toDataURL('image/png')
}
