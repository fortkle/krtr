import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IPC } from '../shared/types'

let overlayWindow: BrowserWindow | null = null

export function createOverlayWindow(screenshotDataUrl: string): void {
  if (overlayWindow) {
    overlayWindow.close()
    overlayWindow = null
  }

  const display = screen.getPrimaryDisplay()
  const { bounds } = display

  overlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    resizable: false,
    movable: false,
    enableLargerThanScreen: true,
    focusable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  overlayWindow.setAlwaysOnTop(true, 'screen-saver')

  if (process.platform === 'darwin') {
    overlayWindow.setVisibleOnAllWorkspaces(true)
  }

  overlayWindow.webContents.on('did-finish-load', () => {
    // Wait for overlay:ready IPC, then send screenshot
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    overlayWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    overlayWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  overlayWindow.once('ready-to-show', () => {
    overlayWindow?.show()
    overlayWindow?.focus()
  })

  // Store screenshot data to send when overlay signals ready
  overlayWindow.webContents.once('dom-ready', () => {
    overlayWindow?.webContents.send(IPC.SCREENSHOT_DATA, screenshotDataUrl)
  })
}

export function closeOverlayWindow(): void {
  if (overlayWindow) {
    overlayWindow.close()
    overlayWindow = null
  }
}
