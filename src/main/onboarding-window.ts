import { BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { checkScreenCapturePermission } from './screenshot'

let onboardingWindow: BrowserWindow | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

export function showOnboardingIfNeeded(onReady: () => void): void {
  if (checkScreenCapturePermission()) {
    onReady()
    return
  }

  onboardingWindow = new BrowserWindow({
    width: 480,
    height: 340,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    onboardingWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#onboarding')
  } else {
    onboardingWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'onboarding' })
  }

  pollTimer = setInterval(() => {
    if (checkScreenCapturePermission()) {
      if (pollTimer) clearInterval(pollTimer)
      pollTimer = null
      if (onboardingWindow) {
        onboardingWindow.close()
        onboardingWindow = null
      }
      onReady()
    }
  }, 1500)

  onboardingWindow.on('closed', () => {
    onboardingWindow = null
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    onReady()
  })
}

export function registerOnboardingIpcHandlers(): void {
  ipcMain.on('onboarding:open-settings', () => {
    shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
    )
  })
}
