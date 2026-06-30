import { invoke } from '@tauri-apps/api/core'
import type { BitmapPayload, LabelSize, PrinterStatus } from './types'

export interface DiscoveredPrinter {
  name: string
  services: string[]
  matched: boolean
}

export interface NiimbotPrinter {
  scanAndConnect(): Promise<PrinterStatus>
  disconnect(): Promise<PrinterStatus>
  scanPrinters(): Promise<DiscoveredPrinter[]>
  getStatus(): Promise<PrinterStatus>
  printLabel(bitmap: BitmapPayload, quantity: number, labelSize: LabelSize): Promise<void>
}

export class TauriNiimbotPrinter implements NiimbotPrinter {
  async scanAndConnect(): Promise<PrinterStatus> {
    return invoke<PrinterStatus>('scan_and_connect')
  }

  async scanPrinters(): Promise<DiscoveredPrinter[]> {
    return invoke<DiscoveredPrinter[]>('scan_printers')
  }

  async disconnect(): Promise<PrinterStatus> {
    return invoke<PrinterStatus>('disconnect_printer')
  }

  async getStatus(): Promise<PrinterStatus> {
    return invoke<PrinterStatus>('printer_status')
  }

  async printLabel(bitmap: BitmapPayload, quantity: number, labelSize: LabelSize) {
    await invoke('print_label', { bitmap, quantity, labelSize })
  }
}

export class BrowserPreviewPrinter implements NiimbotPrinter {
  async scanAndConnect(): Promise<PrinterStatus> {
    return { connected: true, deviceName: 'Preview D11_H' }
  }

  async getStatus(): Promise<PrinterStatus> {
    return { connected: false }
  }

  async disconnect(): Promise<PrinterStatus> {
    return { connected: false }
  }

  async scanPrinters(): Promise<DiscoveredPrinter[]> {
    return [{ name: 'Preview D11_H', services: [], matched: true }]
  }

  async printLabel() {
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}

export function createPrinter(): NiimbotPrinter {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
    ? new TauriNiimbotPrinter()
    : new BrowserPreviewPrinter()
}
