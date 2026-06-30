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
