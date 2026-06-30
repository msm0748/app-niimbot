<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { ComposedModal, ModalBody, ModalFooter, ModalHeader } from 'carbon-components-svelte'

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

  onMount(async () => {
    await tick()
    window.setTimeout(() => {
      const primary = document.querySelector<HTMLButtonElement>(
        '.bx--modal-footer .bx--btn--primary, .bx--modal-footer .bx--btn--danger',
      )
      primary?.focus()
    }, 0)
  })

  function confirm() {
    if (onConfirm) {
      onConfirm()
    } else {
      onCancel()
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault()
      confirm()
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<ComposedModal
  open
  danger={destructive}
  size="xs"
  selectorPrimaryFocus="[data-modal-primary-focus]"
  on:close={onCancel}
  on:submit={confirm}
>
  <ModalHeader {title} label={destructive ? 'Confirm deletion' : 'Notice'} />
  <ModalBody>
    <p>{message}</p>
  </ModalBody>
  <ModalFooter
    danger={destructive}
    primaryButtonText={confirmLabel}
    secondaryButtonText={cancelLabel}
    on:click:button--secondary={onCancel}
  />
</ComposedModal>
