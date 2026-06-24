import { app } from 'electron'
import { createTray } from './tray'
import { registerShortcuts, unregisterShortcuts } from './shortcut'
import { registerIpcHandlers } from './ipc-handlers'
import { registerPreviewIpcHandlers } from './preview-window'
import { captureFullScreen, saveTempScreenshot } from './screenshot'
import { createOverlayWindow, registerOverlayIpcHandlers } from './overlay-window'
import { openPreviewWindow } from './preview-window'
import { showOnboardingIfNeeded, registerOnboardingIpcHandlers } from './onboarding-window'

function startRegionCapture(): void {
  createOverlayWindow()
}

async function handleFullscreenCapture(): Promise<void> {
  const image = await captureFullScreen()
  if (!image) return

  const tempPath = await saveTempScreenshot(image)
  openPreviewWindow(image.toDataURL(), tempPath)
}

function setupApp(): void {
  createTray({
    onCaptureRegion: () => startRegionCapture(),
    onCaptureFullscreen: () => handleFullscreenCapture()
  })

  registerShortcuts({
    onCaptureRegion: () => startRegionCapture(),
    onCaptureFullscreen: () => handleFullscreenCapture()
  })
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock?.hide()
  }

  registerOnboardingIpcHandlers()
  registerOverlayIpcHandlers()
  registerPreviewIpcHandlers()
  registerIpcHandlers()

  showOnboardingIfNeeded(() => {
    if (process.platform === 'darwin') {
      app.dock?.hide()
    }
    setupApp()
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
