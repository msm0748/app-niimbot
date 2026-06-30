import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import App from './App.svelte'
import Modal from './lib/Modal.svelte'

describe('App', () => {
  it('renders the printer workflow', async () => {
    render(App)

    expect(screen.getByText('NIIMBOT D11_H')).toBeInTheDocument()
    expect(screen.getByText('Label Console')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /print label/i })).toBeDisabled()
    expect(screen.getByText('History')).toBeInTheDocument()
  })

  it('focuses modal confirm button and confirms on enter', async () => {
    const onConfirm = vi.fn()
    render(Modal, {
      title: 'Delete history item?',
      message: 'Delete this item?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      destructive: true,
      onCancel: vi.fn(),
      onConfirm,
    })

    const deleteButton = await screen.findByRole('button', { name: 'Delete' })
    await waitFor(() => expect(deleteButton).toHaveFocus())

    await fireEvent.keyDown(window, { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
