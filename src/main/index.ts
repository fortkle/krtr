import { app } from 'electron'
import { createTray } from './tray'
import { registerShortcuts, unregisterShortcuts } from './shortcut'
import { registerIpcHandlers } from './ipc-handlers'
import { registerPreviewIpcHandlers } from './preview-window'
import { captureFullScreen, saveTempScreenshot } from './screenshot'
import { createOverlayWindow, registerOverlayIpcHandlers } from './overlay-window'
import { openPreviewWindow } from './preview-window'

function startRegionCapture(): void {
  createOverlayWindow()
}

async function handleFullscreenCapture(): Promise<void> {
  const image = await captureFullScreen()
  if (!image) return

  const tempPath = await saveTempScreenshot(image)
  openPreviewWindow(image.toDataURL(), tempPath)
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock?.hide()
  }

  registerOverlayIpcHandlers()
  registerPreviewIpcHandlers()
  registerIpcHandlers()

  createTray({
    onCaptureRegion: () => startRegionCapture(),
    onCaptureFullscreen: () => handleFullscreenCapture()
  })

  registerShortcuts({
    onCaptureRegion: () => startRegionCapture(),
    onCaptureFullscreen: () => handleFullscreenCapture()
  })
})

app.on('will-quit', () => {
  unregisterShortcuts()
})

app.on('window-all-closed', () => {
  // Keep app running (tray-resident)
})

process.on('SIGINT', () => app.quit())
process.on('SIGTERM', () => app.quit())
