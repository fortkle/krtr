import { BrowserWindow, ipcMain, nativeImage } from 'electron'
import { rename, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { is } from '@electron-toolkit/utils'
import { IPC, Rectangle } from '../shared/types'
import { copyImageToClipboard, saveScreenshotWithDialog } from './screenshot'

let previewWindow: BrowserWindow | null = null
let currentTempPath: string | null = null
let currentDataUrl: string | null = null

function windowSizeForImage(imageSize: Electron.Size): { width: number; height: number } {
  const padding = 24
  const chromeHeight = 80
  const maxWidth = 700
  const maxHeight = 550
  const scale = Math.min(
    1,
    maxWidth / (imageSize.width + padding * 2),
    maxHeight / (imageSize.height + padding * 2)
  )
  return {
    width: Math.max(300, Math.round(imageSize.width * scale) + padding * 2),
    height: Math.max(200, Math.round(imageSize.height * scale) + padding * 2 + chromeHeight)
  }
}

export function openPreviewWindow(dataUrl: string, tempPath: string): void {
  if (previewWindow) {
    previewWindow.removeAllListeners('closed')
    previewWindow.close()
    previewWindow = null
  }

  currentTempPath = tempPath
  currentDataUrl = dataUrl

  const image = nativeImage.createFromDataURL(dataUrl)
  const { width: winWidth, height: winHeight } = windowSizeForImage(image.getSize())

  previewWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    minWidth: 300,
    minHeight: 200,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    previewWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#preview')
  } else {
    previewWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'preview' })
  }

  previewWindow.on('closed', () => {
    previewWindow = null
    currentTempPath = null
    currentDataUrl = null
  })
}

export function registerPreviewIpcHandlers(): void {
  ipcMain.handle(IPC.PREVIEW_GET_DATA, () => {
    return currentDataUrl
  })

  ipcMain.on(IPC.PREVIEW_SET_FILENAME, async (_event, filename: string) => {
    if (!currentTempPath) return
    const dir = dirname(currentTempPath)
    const newPath = join(dir, filename)
    try {
      await rename(currentTempPath, newPath)
      currentTempPath = newPath
    } catch {
      // ignore rename errors
    }
  })

  ipcMain.on(IPC.PREVIEW_START_DRAG, (event) => {
    if (!currentTempPath) return
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return

    const icon = nativeImage.createFromPath(currentTempPath).resize({ width: 128 })

    event.sender.startDrag({
      file: currentTempPath,
      icon
    })
  })

  ipcMain.handle(IPC.PREVIEW_CROP, async (event, rect: Rectangle) => {
    if (!currentDataUrl) return null

    const image = nativeImage.createFromDataURL(currentDataUrl)
    const size = image.getSize()
    const x = Math.min(Math.max(0, Math.round(rect.x)), size.width - 1)
    const y = Math.min(Math.max(0, Math.round(rect.y)), size.height - 1)
    const width = Math.min(Math.round(rect.width), size.width - x)
    const height = Math.min(Math.round(rect.height), size.height - y)
    if (width < 1 || height < 1) return null

    const cropped = image.crop({ x, y, width, height })
    currentDataUrl = cropped.toDataURL()
    if (currentTempPath) {
      await writeFile(currentTempPath, cropped.toPNG())
    }

    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      const { width: winWidth, height: winHeight } = windowSizeForImage(cropped.getSize())
      win.setSize(winWidth, winHeight)
    }

    return currentDataUrl
  })

  ipcMain.handle(IPC.PREVIEW_SAVE, async () => {
    if (!currentTempPath) return
    await saveScreenshotWithDialog(currentTempPath)
  })

  ipcMain.on(IPC.PREVIEW_COPY, (event) => {
    if (!currentTempPath) return
    const image = nativeImage.createFromPath(currentTempPath)
    copyImageToClipboard(image)
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.close()
  })

  ipcMain.on(IPC.PREVIEW_CLOSE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) win.close()
  })
}

export function hidePreviewWindow(): void {
  if (previewWindow) {
    previewWindow.hide()
  }
}

export function closePreviewWindow(): void {
  if (previewWindow) {
    previewWindow.close()
    previewWindow = null
  }
}
