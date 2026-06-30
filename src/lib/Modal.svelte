<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { AlertTriangle, X } from '@lucide/svelte'

  interface Props {
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    destructive?: boolean
    onConfirm?: () => void
    onCancel: () => void
  }

  let {
    title,
    message,
    confirmLabel = 'OK',
    cancelLabel,
    destructive = false,
    onConfirm,
    onCancel,
  }: Props = $props()

  let confirmButton: HTMLButtonElement

  onMount(async () => {
    await tick()
    confirmButton?.focus()
  })

  function confirm() {
    if (onConfirm) {
      onConfirm()
    } else {
      onCancel()
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      confirm()
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<button class="modal-backdrop" aria-label="Close modal" onclick={onCancel}></button>
<div class="modal-layer">
  <div
    class="modal-card"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    tabindex="-1"
  >
    <div class="flex items-start gap-4">
      <div class={destructive ? 'modal-icon danger' : 'modal-icon'}>
        <AlertTriangle size={20} />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-4">
          <h2 id="modal-title" class="text-lg font-bold leading-6 text-zinc-950">{title}</h2>
          <button class="modal-close" aria-label="Close" onclick={onCancel}>
            <X size={17} />
          </button>
        </div>
        <p class="mt-2 text-sm leading-6 text-zinc-600">{message}</p>
      </div>
    </div>

    <div class="mt-6 flex justify-end gap-2">
      {#if cancelLabel}
        <button class="modal-secondary" onclick={onCancel}>{cancelLabel}</button>
      {/if}
      <button
        bind:this={confirmButton}
        class={destructive ? 'modal-primary danger' : 'modal-primary'}
        onclick={confirm}
      >
        {confirmLabel}
      </button>
    </div>
  </div>
</div>
