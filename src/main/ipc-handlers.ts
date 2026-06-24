import { ipcMain } from 'electron'
import { IPC, Rectangle } from '../shared/types'
import { captureFullScreen, captureRegion, saveTempScreenshot } from './screenshot'
import { closeOverlayWindow } from './overlay-window'
import { openPreviewWindow } from './preview-window'

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.CAPTURE_FULLSCREEN, async () => {
    const image = await captureFullScreen()
    if (!image) return
    const tempPath = await saveTempScreenshot(image)
    openPreviewWindow(image.toDataURL(), tempPath)
  })

  ipcMain.handle(IPC.CAPTURE_REGION_SELECTED, async (_event, rect: Rectangle) => {
    closeOverlayWindow()
    const image = await captureRegion(rect)
    if (!image) return
    const tempPath = await saveTempScreenshot(image)
    openPreviewWindow(image.toDataURL(), tempPath)
  })

  ipcMain.on(IPC.CAPTURE_CANCELLED, () => {
    closeOverlayWindow()
  })
}
