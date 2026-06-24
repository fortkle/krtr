import { contextBridge, ipcRenderer } from 'electron'
import { IPC, Rectangle } from '../shared/types'

const api = {
  captureFullscreen: (): Promise<void> => ipcRenderer.invoke(IPC.CAPTURE_FULLSCREEN),
  sendRegionSelected: (rect: Rectangle): Promise<void> =>
    ipcRenderer.invoke(IPC.CAPTURE_REGION_SELECTED, rect),
  sendTimerCapture: (rect: Rectangle): void => {
    ipcRenderer.send(IPC.CAPTURE_TIMER, rect)
  },
  sendCancelled: (): void => {
    ipcRenderer.send(IPC.CAPTURE_CANCELLED)
  },
  setOverlayPassthrough: (passthrough: boolean): void => {
    ipcRenderer.send(IPC.OVERLAY_SET_PASSTHROUGH, passthrough)
  },
  getPreviewData: (): Promise<string> => ipcRenderer.invoke(IPC.PREVIEW_GET_DATA),
  setFilename: (name: string): void => {
    ipcRenderer.send(IPC.PREVIEW_SET_FILENAME, name)
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
  },
  openScreenRecordingSettings: (): void => {
    ipcRenderer.send('onboarding:open-settings')
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
