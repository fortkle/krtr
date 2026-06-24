import { BrowserWindow, ipcMain, nativeImage } from 'electron'
import { rename } from 'fs/promises'
import { join, dirname } from 'path'
import { is } from '@electron-toolkit/utils'
import { IPC } from '../shared/types'
import { copyImageToClipboard, saveScreenshotWithDialog } from './screenshot'

let previewWindow: BrowserWindow | null = null
let currentTempPath: string | null = null
let currentDataUrl: string | null = null

export function openPreviewWindow(dataUrl: string, tempPath: string): void {
  if (previewWindow) {
    previewWindow.removeAllListeners('closed')
    previewWindow.close()
    previewWindow = null
  }

  currentTempPath = tempPath
  currentDataUrl = dataUrl

  const image = nativeImage.createFromDataURL(dataUrl)
  const imageSize = image.getSize()

  const padding = 24
  const chromeHeight = 80
  const maxWidth = 700
  const maxHeight = 550
  const scale = Math.min(1, maxWidth / (imageSize.width + padding * 2), maxHeight / (imageSize.height + padding * 2))
  const winWidth = Math.max(300, Math.round(imageSize.width * scale) + padding * 2)
  const winHeight = Math.round(imageSize.height * scale) + padding * 2 + chromeHeight

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

export function closePreviewWindow(): void {
  if (previewWindow) {
    previewWindow.close()
    previewWindow = null
  }
}
