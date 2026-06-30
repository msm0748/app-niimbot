import { describe, expect, it } from 'vitest'
import { fitFontSize, makeBitmap } from './label'

describe('label bitmap generation', () => {
  it('creates D11_H 12x22 bitmap dimensions', () => {
    const bitmap = makeBitmap('홍길동', '12x22')
    expect(bitmap.width).toBe(264)
    expect(bitmap.height).toBe(144)
    expect(bitmap.pixels).toHaveLength(264 * 144)
  })

  it('creates D11_H 12x30 bitmap dimensions', () => {
    const bitmap = makeBitmap('홍길동', '12x30')
    expect(bitmap.width).toBe(360)
    expect(bitmap.height).toBe(144)
    expect(bitmap.pixels).toHaveLength(360 * 144)
  })

  it('reduces font size for long text', () => {
    const ctx = {
      font: '',
      measureText(text: string) {
        const fontSize = Number.parseInt(this.font.match(/(\d+)px/)?.[1] ?? '12', 10)
        return {
          width: text.length * fontSize,
          actualBoundingBoxAscent: fontSize * 0.8,
          actualBoundingBoxDescent: fontSize * 0.2,
        } as TextMetrics
      },
    }

    const short = fitFontSize(ctx, 'ABC', 200, 100)
    const long = fitFontSize(ctx, 'ABCDEFGHIJKLMN', 200, 100)
    expect(long).toBeLessThan(short)
  })
})
