import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import { useEffect, useRef } from 'react'

interface ConfirmModalProps {
  opened: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  opened,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!opened) return
    const focusTimer = window.setTimeout(() => confirmRef.current?.focus(), 50)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        onConfirm()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onConfirm, opened])

  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={title}
      centered
      overlayProps={{ blur: 2, opacity: 0.45 }}
      radius="md"
      size="sm"
      withinPortal
      withCloseButton={false}
    >
      <Stack gap="lg">
        <Text c="dimmed" size="sm">
          {message}
        </Text>
        <Group justify="flex-end" gap="xs">
          {cancelLabel ? (
            <Button variant="default" onClick={onCancel}>
              {cancelLabel}
            </Button>
          ) : null}
          <Button
            ref={confirmRef}
            autoFocus
            data-autofocus
            color={destructive ? 'red' : 'dark'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
