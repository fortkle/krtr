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
