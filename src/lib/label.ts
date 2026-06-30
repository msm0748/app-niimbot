import { LABEL_SIZES, type BitmapPayload, type LabelSize } from './types'

export function normalizeLabelText(text: string) {
  return text.trim().replace(/\s+/g, ' ')
}

export function makeBitmap(text: string, labelSize: LabelSize): BitmapPayload {
  const size = LABEL_SIZES[labelSize]
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  if (!ctx) {
    throw new Error('Canvas is not available')
  }

  drawLabel(ctx, text, size.width, size.height)
  const data = ctx.getImageData(0, 0, size.width, size.height).data
  const pixels: number[] = new Array(size.width * size.height)

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const alpha = data[i + 3]
    const luminance = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    pixels[p] = alpha > 20 && luminance < 150 ? 1 : 0
  }

  return {
    width: size.width,
    height: size.height,
    pixels,
  }
}

export function drawLabel(
  ctx: CanvasRenderingContext2D,
  rawText: string,
  width: number,
  height: number,
) {
  const text = normalizeLabelText(rawText)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  if (!text) {
    return
  }

  const paddingX = 12
  const paddingY = 10
  const maxWidth = width - paddingX * 2
  const maxHeight = height - paddingY * 2
  const fontSize = fitFontSize(ctx, text, maxWidth, maxHeight)

  ctx.fillStyle = '#000000'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${fontSize}px "Avenir Next", "Apple SD Gothic Neo", sans-serif`
  ctx.fillText(text, width / 2, height / 2, maxWidth)
}

export function fitFontSize(
  ctx: Pick<CanvasRenderingContext2D, 'font' | 'measureText'>,
  text: string,
  maxWidth: number,
  maxHeight: number,
) {
  let low = 6
  let high = maxHeight
  let best = low

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    ctx.font = `600 ${mid}px "Avenir Next", "Apple SD Gothic Neo", sans-serif`
    const metrics = ctx.measureText(text)
    const actualHeight =
      (metrics.actualBoundingBoxAscent || mid * 0.8) + (metrics.actualBoundingBoxDescent || mid * 0.2)

    if (metrics.width <= maxWidth && actualHeight <= maxHeight) {
      best = mid
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  return best
}
