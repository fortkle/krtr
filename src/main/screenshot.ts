import { app, clipboard, desktopCapturer, Notification, screen, systemPreferences } from 'electron'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import type { Rectangle } from '../shared/types'

export function checkScreenCapturePermission(): boolean {
  if (process.platform === 'darwin') {
    return systemPreferences.getMediaAccessStatus('screen') === 'granted'
  }
  return true
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

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(width * scaleFactor),
      height: Math.round(height * scaleFactor)
    }
  })

  const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[0]
  if (!source) return null

  return source.thumbnail
}

export async function captureRegion(rect: Rectangle): Promise<Electron.NativeImage | null> {
  const image = await captureFullScreen()
  if (!image) return null
  return image.crop(rect)
}

function generateFilename(): string {
  const now = new Date()
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('')
  return `krtr-${timestamp}.png`
}

export async function saveTempScreenshot(image: Electron.NativeImage): Promise<string> {
  const tempDir = join(app.getPath('temp'), 'krtr')
  await mkdir(tempDir, { recursive: true })
  const filename = generateFilename()
  const filepath = join(tempDir, filename)
  await writeFile(filepath, image.toPNG())
  return filepath
}

export async function saveScreenshotToDesktop(tempPath: string): Promise<void> {
  const { readFile } = await import('fs/promises')
  const data = await readFile(tempPath)
  const desktopPath = join(homedir(), 'Desktop')
  const filename = generateFilename()
  const filepath = join(desktopPath, filename)
  await mkdir(desktopPath, { recursive: true })
  await writeFile(filepath, data)

  new Notification({
    title: 'krtr',
    body: `Saved to Desktop/${filename}`
  }).show()
}

export function copyImageToClipboard(image: Electron.NativeImage): void {
  clipboard.writeImage(image)
}
