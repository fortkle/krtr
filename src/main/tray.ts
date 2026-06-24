import { Menu, nativeImage, Tray } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let tray: Tray | null = null

interface TrayActions {
  onCaptureRegion: () => void
  onCaptureFullscreen: () => void
}

export function createTray(actions: TrayActions): void {
  const resourcesPath = is.dev
    ? join(__dirname, '../../resources')
    : join(process.resourcesPath, 'resources')
  const iconPath = join(resourcesPath, 'trayIconTemplate.png')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Capture Region', click: actions.onCaptureRegion },
    { label: 'Capture Full Screen', click: actions.onCaptureFullscreen },
    { type: 'separator' },
    { label: 'Quit', role: 'quit' }
  ])

  tray.setToolTip('krtr')
  tray.setContextMenu(contextMenu)
}
