import { BrowserWindow, ipcMain, nativeImage } from 'electron'
import { rename, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { is } from '@electron-toolkit/utils'
import { CropResult, IPC, Rectangle } from '../shared/types'
import { copyImageToClipboard, saveScreenshotWithDialog } from './screenshot'

let previewWindow: BrowserWindow | null = null
let currentTempPath: string | null = null
// The unannotated image. Annotations are flattened by the renderer and only
// written to the temp file, so crops keep working on the clean image.
let currentDataUrl: string | null = null

// Serializes every write/rename of the temp file so a rename never races a
// write and the last flattened image always wins.
let fileQueue: Promise<void> = Promise.resolve()
function enqueueFileOp(op: () => Promise<void>): Promise<void> {
  const next = fileQueue.then(op, op)
  fileQueue = next.catch(() => {})
  return next
}

const MIN_WINDOW_WIDTH = 450

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
    width: Math.max(MIN_WINDOW_WIDTH, Math.round(imageSize.width * scale) + padding * 2),
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
    minWidth: MIN_WINDOW_WIDTH,
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

  ipcMain.on(IPC.PREVIEW_SET_FILENAME, (_event, filename: string) => {
    void enqueueFileOp(async () => {
      if (!currentTempPath) return
      const newPath = join(dirname(currentTempPath), filename)
      try {
        await rename(currentTempPath, newPath)
        currentTempPath = newPath
      } catch {
        // ignore rename errors
      }
    })
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

  ipcMain.handle(IPC.PREVIEW_CROP, async (event, rect: Rectangle): Promise<CropResult | null> => {
    if (!currentDataUrl) return null

    const image = nativeImage.createFromDataURL(currentDataUrl)
    const size = image.getSize()
    const x = Math.min(Math.max(0, Math.round(rect.x)), size.width - 1)
    const y = Math.min(Math.max(0, Math.round(rect.y)), size.height - 1)
    const width = Math.min(Math.round(rect.width), size.width - x)
    const height = Math.min(Math.round(rect.height), size.height - y)
    if (width < 1 || height < 1) return null

    const cropped = image.crop({ x, y, width, height })
    const croppedDataUrl = cropped.toDataURL()
    currentDataUrl = croppedDataUrl
    await enqueueFileOp(async () => {
      if (currentTempPath) await writeFile(currentTempPath, cropped.toPNG())
    })

    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      const { width: winWidth, height: winHeight } = windowSizeForImage(cropped.getSize())
      win.setSize(winWidth, winHeight)
    }

    return { dataUrl: croppedDataUrl, offsetX: x, offsetY: y }
  })

  // Receives the flattened (annotated) PNG, or null to restore the clean image.
  ipcMain.handle(IPC.PREVIEW_SET_ANNOTATED, async (_event, dataUrl: string | null) => {
    const source = dataUrl ?? currentDataUrl
    if (!source) return
    const png = nativeImage.createFromDataURL(source).toPNG()
    await enqueueFileOp(async () => {
      if (currentTempPath) await writeFile(currentTempPath, png)
    })
  })

  ipcMain.handle(IPC.PREVIEW_SAVE, async () => {
    await fileQueue
    if (!currentTempPath) return
    await saveScreenshotWithDialog(currentTempPath)
  })

  ipcMain.on(IPC.PREVIEW_COPY, async (event) => {
    await fileQueue
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

export function hidePreviewWindow(): boolean {
  if (previewWindow && previewWindow.isVisible()) {
    previewWindow.hide()
    return true
  }
  return false
}

export function closePreviewWindow(): void {
  if (previewWindow) {
    previewWindow.close()
    previewWindow = null
  }
}
