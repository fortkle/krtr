import { ipcMain } from 'electron'
import { IPC, Rectangle } from '../shared/types'
import {
  captureFullScreen,
  captureRegion,
  cropImage,
  notifyCaptureFailed,
  saveTempScreenshot
} from './screenshot'
import { closeOverlayWindow, createOverlayWindow } from './overlay-window'
import { hidePreviewWindow, openPreviewWindow } from './preview-window'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Full-screen image captured when region selection starts. The overlay shows
// this frozen frame and the confirmed selection is cropped from it in memory,
// so no live capture happens while overlay/preview windows are being torn down
// (which breaks getSources on macOS 26+, returning empty images).
let frozenCapture: Electron.NativeImage | null = null

export async function startRegionCapture(): Promise<void> {
  const hidPreview = hidePreviewWindow()
  if (hidPreview) await delay(200)

  const image = await captureFullScreen()
  if (!image) {
    notifyCaptureFailed()
    return
  }

  frozenCapture = image
  createOverlayWindow()
}

export async function captureFullscreenToPreview(): Promise<void> {
  const hidPreview = hidePreviewWindow()
  if (hidPreview) await delay(200)

  const image = await captureFullScreen()
  if (!image) {
    notifyCaptureFailed()
    return
  }

  const tempPath = await saveTempScreenshot(image)
  openPreviewWindow(image.toDataURL(), tempPath)
}

async function openPreviewFor(image: Electron.NativeImage): Promise<void> {
  const tempPath = await saveTempScreenshot(image)
  openPreviewWindow(image.toDataURL(), tempPath)
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.CAPTURE_FULLSCREEN, async () => {
    await captureFullscreenToPreview()
  })

  ipcMain.handle(IPC.OVERLAY_GET_IMAGE, () => {
    return frozenCapture?.toDataURL() ?? null
  })

  ipcMain.handle(IPC.CAPTURE_REGION_SELECTED, async (_event, rect: Rectangle) => {
    const source = frozenCapture
    frozenCapture = null
    closeOverlayWindow()

    const image = source ? cropImage(source, rect) : null
    if (!image) {
      notifyCaptureFailed()
      return
    }
    await openPreviewFor(image)
  })

  ipcMain.on(IPC.CAPTURE_TIMER, async (_event, rect: Rectangle) => {
    // Timer capture shoots the live screen. The overlay has already cleared
    // its content (fully transparent) but stays open, so the capture stream
    // is not disturbed by a window teardown right before capturing.
    frozenCapture = null
    const image = await captureRegion(rect)
    closeOverlayWindow()

    if (!image) {
      notifyCaptureFailed()
      return
    }
    await openPreviewFor(image)
  })

  ipcMain.on(IPC.CAPTURE_CANCELLED, () => {
    frozenCapture = null
    closeOverlayWindow()
  })
}
