import { Menu, nativeImage, Tray } from 'electron'
import { join } from 'path'

let tray: Tray | null = null

interface TrayActions {
  onCaptureRegion: () => void
  onCaptureFullscreen: () => void
}

export function createTray(actions: TrayActions): void {
  const iconPath = join(__dirname, '../../resources/trayIconTemplate.png')
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
