import { globalShortcut } from 'electron'

interface ShortcutActions {
  onCaptureRegion: () => void
  onCaptureFullscreen: () => void
}

export function registerShortcuts(actions: ShortcutActions): void {
  globalShortcut.register('CommandOrControl+Shift+5', actions.onCaptureRegion)
  globalShortcut.register('CommandOrControl+Shift+6', actions.onCaptureFullscreen)
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll()
}
