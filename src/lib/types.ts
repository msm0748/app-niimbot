export const LABEL_SIZES = {
  '12x22': {
    id: '12x22',
    name: '12 x 22 mm',
    width: 264,
    height: 144,
    mmWidth: 22,
    mmHeight: 12,
  },
  '12x30': {
    id: '12x30',
    name: '12 x 30 mm',
    width: 360,
    height: 144,
    mmWidth: 30,
    mmHeight: 12,
  },
} as const

export type LabelSize = keyof typeof LABEL_SIZES

export interface BitmapPayload {
  width: number
  height: number
  pixels: number[]
}

export interface PrintHistoryItem {
  text: string
  labelSize: LabelSize
  printedAt: string
}

export interface PrinterStatus {
  connected: boolean
  deviceName?: string
}
