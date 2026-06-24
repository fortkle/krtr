import { BrowserWindow, ipcMain, nativeImage } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IPC } from '../shared/types'
import { copyImageToClipboard, saveScreenshotToDesktop } from './screenshot'

let previewWindow: BrowserWindow | null = null
let currentTempPath: string | null = null

export function openPreviewWindow(dataUrl: string, tempPath: string): void {
  if (previewWindow) {
    previewWindow.close()
    previewWindow = null
  }

  currentTempPath = tempPath

  const image = nativeImage.createFromDataURL(dataUrl)
  const imageSize = image.getSize()

  const maxWidth = 600
  const maxHeight = 500
  const dragTabHeight = 48
  const scale = Math.min(1, maxWidth / imageSize.width, maxHeight / imageSize.height)
  const winWidth = Math.max(200, Math.round(imageSize.width * scale))
  const winHeight = Math.round(imageSize.height * scale) + dragTabHeight

  previewWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    resizable: false,
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

  previewWindow.webContents.once('dom-ready', () => {
    previewWindow?.webContents.send(IPC.PREVIEW_DATA, dataUrl)
  })

  previewWindow.on('closed', () => {
    previewWindow = null
    currentTempPath = null
  })
}

export function registerPreviewIpcHandlers(): void {
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
    await saveScreenshotToDesktop(currentTempPath)
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
