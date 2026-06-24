export type CaptureMode = 'fullscreen' | 'region'

export interface Rectangle {
  x: number
  y: number
  width: number
  height: number
}

export const IPC = {
  CAPTURE_FULLSCREEN: 'capture:fullscreen',
  CAPTURE_REGION_START: 'capture:region-start',
  CAPTURE_REGION_SELECTED: 'capture:region-selected',
  CAPTURE_TIMER: 'capture:timer',
  CAPTURE_CANCELLED: 'capture:cancelled',
  OVERLAY_SET_PASSTHROUGH: 'overlay:set-passthrough',
  PREVIEW_GET_DATA: 'preview:get-data',
  PREVIEW_SET_FILENAME: 'preview:set-filename',
  PREVIEW_START_DRAG: 'preview:start-drag',
  PREVIEW_SAVE: 'preview:save',
  PREVIEW_COPY: 'preview:copy',
  PREVIEW_CLOSE: 'preview:close'
} as const
