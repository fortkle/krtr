import { ipcMain } from 'electron'
import { IPC, Rectangle } from '../shared/types'
import { captureFullScreen, captureRegion, saveTempScreenshot } from './screenshot'
import { closeOverlayWindow } from './overlay-window'
import { openPreviewWindow } from './preview-window'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function captureAndPreview(rect: Rectangle): Promise<void> {
  closeOverlayWindow()
  await delay(200)
  const image = await captureRegion(rect)
  if (!image) return
  const tempPath = await saveTempScreenshot(image)
  openPreviewWindow(image.toDataURL(), tempPath)
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.CAPTURE_FULLSCREEN, async () => {
    const image = await captureFullScreen()
    if (!image) return
    const tempPath = await saveTempScreenshot(image)
    openPreviewWindow(image.toDataURL(), tempPath)
  })

  ipcMain.handle(IPC.CAPTURE_REGION_SELECTED, async (_event, rect: Rectangle) => {
    await captureAndPreview(rect)
  })

  ipcMain.on(IPC.CAPTURE_TIMER, async (_event, rect: Rectangle) => {
    await captureAndPreview(rect)
  })

  ipcMain.on(IPC.CAPTURE_CANCELLED, () => {
    closeOverlayWindow()
  })
}
