import { app } from 'electron'
import { createTray } from './tray'
import { registerShortcuts, unregisterShortcuts } from './shortcut'
import {
  captureFullscreenToPreview,
  registerIpcHandlers,
  startRegionCapture
} from './ipc-handlers'
import { registerPreviewIpcHandlers } from './preview-window'
import { registerOverlayIpcHandlers } from './overlay-window'
import { showOnboardingIfNeeded, registerOnboardingIpcHandlers } from './onboarding-window'

function setupApp(): void {
  createTray({
    onCaptureRegion: () => startRegionCapture(),
    onCaptureFullscreen: () => captureFullscreenToPreview()
  })

  registerShortcuts({
    onCaptureRegion: () => startRegionCapture(),
    onCaptureFullscreen: () => captureFullscreenToPreview()
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
