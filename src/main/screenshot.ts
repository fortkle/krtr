import { app, clipboard, desktopCapturer, dialog, Notification, screen, systemPreferences } from 'electron'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, basename } from 'path'
import { homedir } from 'os'
import type { Rectangle } from '../shared/types'

export function checkScreenCapturePermission(): boolean {
  if (process.platform === 'darwin') {
    return systemPreferences.getMediaAccessStatus('screen') === 'granted'
  }
  return true
}

export async function requestScreenCapturePermission(): Promise<void> {
  // macOS only registers an app in the Screen Recording permission list
  // (and shows the system prompt) when the app actually attempts a capture.
  // Fire a minimal capture attempt so the user can grant permission.
  try {
    await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1, height: 1 }
    })
  } catch {
    // ignore — this call exists only to trigger the permission prompt
  }
}

const CAPTURE_MAX_ATTEMPTS = 4
const CAPTURE_RETRY_DELAY_MS = 150

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function captureFullScreen(
  displayId?: string
): Promise<Electron.NativeImage | null> {
  const display = displayId
    ? screen.getAllDisplays().find((d) => String(d.id) === displayId)
    : screen.getPrimaryDisplay()

  if (!display) return null

  const { width, height } = display.size
  const scaleFactor = display.scaleFactor

  // On macOS 26+, getSources returns an empty image for a few seconds after
  // any window of this app changes on screen (shown/hidden/closed/repainted).
  // The failed call resets the capture stream, so a follow-up attempt succeeds.
  for (let attempt = 0; attempt < CAPTURE_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await delay(CAPTURE_RETRY_DELAY_MS)

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(width * scaleFactor),
        height: Math.round(height * scaleFactor)
      }
    })

    const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0]
    if (source && !source.thumbnail.isEmpty()) {
      return source.thumbnail
    }
  }

  return null
}

export function cropImage(
  image: Electron.NativeImage,
  rect: Rectangle
): Electron.NativeImage | null {
  const size = image.getSize()
  const x = Math.min(Math.max(0, Math.round(rect.x)), size.width - 1)
  const y = Math.min(Math.max(0, Math.round(rect.y)), size.height - 1)
  const width = Math.min(Math.round(rect.width), size.width - x)
  const height = Math.min(Math.round(rect.height), size.height - y)
  if (width < 1 || height < 1) return null
  return image.crop({ x, y, width, height })
}

export async function captureRegion(rect: Rectangle): Promise<Electron.NativeImage | null> {
  const image = await captureFullScreen()
  if (!image) return null
  return cropImage(image, rect)
}

export function notifyCaptureFailed(): void {
  new Notification({
    title: 'krtr',
    body: 'Screen capture failed. Please try again.'
  }).show()
}


export async function saveTempScreenshot(image: Electron.NativeImage): Promise<string> {
  const tempDir = join(app.getPath('temp'), 'krtr')
  await mkdir(tempDir, { recursive: true })
  const filepath = join(tempDir, 'image.png')
  await writeFile(filepath, image.toPNG())
  return filepath
}

export async function saveScreenshotWithDialog(tempPath: string): Promise<void> {
  const defaultName = basename(tempPath)
  const { filePath, canceled } = await dialog.showSaveDialog({
    defaultPath: join(homedir(), 'Desktop', defaultName),
    filters: [{ name: 'PNG Image', extensions: ['png'] }]
  })
  if (canceled || !filePath) return

  const data = await readFile(tempPath)
  await writeFile(filePath, data)

  new Notification({
    title: 'krtr',
    body: `Saved to ${basename(filePath)}`
  }).show()
}

export function copyImageToClipboard(image: Electron.NativeImage): void {
  clipboard.writeImage(image)
}
