import { app, dialog, shell } from 'electron'
import { createTray } from './tray'
import { registerShortcuts, unregisterShortcuts } from './shortcut'
import { registerIpcHandlers } from './ipc-handlers'
import { registerPreviewIpcHandlers } from './preview-window'
import { captureFullScreen, checkScreenCapturePermission, saveTempScreenshot } from './screenshot'
import { createOverlayWindow, registerOverlayIpcHandlers } from './overlay-window'
import { openPreviewWindow } from './preview-window'

async function ensurePermission(): Promise<boolean> {
  if (checkScreenCapturePermission()) return true

  const { response } = await dialog.showMessageBox({
    type: 'warning',
    message: 'Screen recording permission is required.',
    detail: 'Please enable krtr in System Settings > Privacy & Security > Screen Recording.',
    buttons: ['Open Settings', 'Cancel']
  })
  if (response === 0) {
    shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
    )
  }
  return false
}

async function startRegionCapture(): Promise<void> {
  if (!(await ensurePermission())) return
  createOverlayWindow()
}

async function handleFullscreenCapture(): Promise<void> {
  if (!(await ensurePermission())) return

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
