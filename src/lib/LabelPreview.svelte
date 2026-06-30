<script lang="ts">
  import { onMount } from 'svelte'
  import { drawLabel } from './label'
  import { LABEL_SIZES, type LabelSize } from './types'

  interface Props {
    text: string
    labelSize: LabelSize
  }

  let { text, labelSize }: Props = $props()
  let canvas: HTMLCanvasElement

  function render() {
    const size = LABEL_SIZES[labelSize]
    if (!canvas) return
    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawLabel(ctx, text, size.width, size.height)
  }

  onMount(() => {
    render()
  })
  $effect(() => {
    render()
  })
</script>

<div class="label-paper rounded-lg border border-stone-300 p-4 shadow-inner">
  <canvas
    bind:this={canvas}
    class="h-36 w-full rounded border border-stone-300 bg-white object-contain"
    aria-label="Label preview"
  ></canvas>
</div>
