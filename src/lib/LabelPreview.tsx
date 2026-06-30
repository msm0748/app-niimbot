import { useEffect, useRef } from 'react'
import { drawLabel } from './label'
import { LABEL_SIZES, type LabelSize } from './types'

interface LabelPreviewProps {
  text: string
  labelSize: LabelSize
}

export default function LabelPreview({ text, labelSize }: LabelPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const size = LABEL_SIZES[labelSize]

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    canvas.width = size.width
    canvas.height = size.height
    drawLabel(ctx, text, size.width, size.height)
  }, [labelSize, size.height, size.width, text])

  return <canvas ref={canvasRef} width={size.width} height={size.height} aria-label="Label preview" />
}
