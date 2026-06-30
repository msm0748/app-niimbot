<script lang="ts">
  import { X } from '@lucide/svelte'

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

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') onCancel()
  }
</script>

<svelte:window onkeydown={onKeydown} />

<button class="fixed inset-0 z-40 cursor-default bg-slate-950/30" aria-label="Close modal" onclick={onCancel}></button>
<div class="fixed inset-0 z-50 grid place-items-center p-6 pointer-events-none">
  <dialog
    open
    class="pointer-events-auto w-full max-w-sm rounded-lg border border-stone-200 bg-white p-5 text-left shadow-2xl"
    aria-modal="true"
    aria-labelledby="modal-title"
  >
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 id="modal-title" class="text-base font-semibold text-stone-950">{title}</h2>
        <p class="mt-2 text-sm leading-6 text-stone-600">{message}</p>
      </div>
      <button class="btn btn-ghost btn-sm btn-square" aria-label="Close" onclick={onCancel}>
        <X size={17} />
      </button>
    </div>

    <div class="mt-5 flex justify-end gap-2">
      {#if cancelLabel}
        <button class="btn btn-ghost btn-sm" onclick={onCancel}>{cancelLabel}</button>
      {/if}
      <button
        class={destructive ? 'btn btn-error btn-sm text-white' : 'btn btn-neutral btn-sm'}
        onclick={() => (onConfirm ? onConfirm() : onCancel())}
      >
        {confirmLabel}
      </button>
    </div>
  </dialog>
</div>
