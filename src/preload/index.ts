import { contextBridge, ipcRenderer } from 'electron'
import { IPC, Rectangle } from '../shared/types'

const api = {
  captureFullscreen: (): Promise<void> => ipcRenderer.invoke(IPC.CAPTURE_FULLSCREEN),
  sendRegionSelected: (rect: Rectangle): Promise<void> =>
    ipcRenderer.invoke(IPC.CAPTURE_REGION_SELECTED, rect),
  sendCancelled: (): void => {
    ipcRenderer.send(IPC.CAPTURE_CANCELLED)
  },
  sendOverlayReady: (): void => {
    ipcRenderer.send(IPC.OVERLAY_READY)
  },
  onScreenshotData: (callback: (dataUrl: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, dataUrl: string): void => {
      callback(dataUrl)
    }
    ipcRenderer.on(IPC.SCREENSHOT_DATA, handler)
    return () => ipcRenderer.removeListener(IPC.SCREENSHOT_DATA, handler)
  },
  onPreviewData: (callback: (dataUrl: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, dataUrl: string): void => {
      callback(dataUrl)
    }
    ipcRenderer.on(IPC.PREVIEW_DATA, handler)
    return () => ipcRenderer.removeListener(IPC.PREVIEW_DATA, handler)
  },
  startDrag: (): void => {
    ipcRenderer.send(IPC.PREVIEW_START_DRAG)
  },
  saveToDesktop: (): Promise<void> => ipcRenderer.invoke(IPC.PREVIEW_SAVE),
  copyToClipboard: (): void => {
    ipcRenderer.send(IPC.PREVIEW_COPY)
  },
  closePreview: (): void => {
    ipcRenderer.send(IPC.PREVIEW_CLOSE)
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
