import '@testing-library/jest-dom/vitest'

class CanvasRenderingContext2DMock {
  font = ''
  fillStyle = ''
  textAlign = ''
  textBaseline = ''

  clearRect() {}
  fillRect() {}
  fillText() {}

  measureText(text: string) {
    const fontSize = Number.parseInt(this.font.match(/(\d+)px/)?.[1] ?? '12', 10)
    return {
      width: text.length * fontSize * 0.62,
      actualBoundingBoxAscent: fontSize * 0.78,
      actualBoundingBoxDescent: fontSize * 0.22,
    }
  }

  getImageData(_x: number, _y: number, width: number, height: number) {
    return { data: new Uint8ClampedArray(width * height * 4) }
  }
}

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => new CanvasRenderingContext2DMock(),
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
})

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
})

class LocalStorageMock implements Storage {
  private values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

const localStorageMock = new LocalStorageMock()

Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: localStorageMock,
})

Object.defineProperty(globalThis, 'localStorage', {
  writable: true,
  value: localStorageMock,
})
