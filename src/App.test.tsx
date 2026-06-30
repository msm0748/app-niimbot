import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import ConfirmModal from './lib/ConfirmModal'
import { HISTORY_STORAGE_KEY } from './lib/history'

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the printer workflow', () => {
    render(<App />)

    expect(screen.getByText('NIIMBOT D11_H')).toBeInTheDocument()
    expect(screen.getByText('Label Console')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Connect$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Disconnect$/ })).toBeDisabled()
    expect(screen.getByRole('switch', { name: /allow duplicate names/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /print label/i })).toBeDisabled()
    expect(screen.getByText('History')).toBeInTheDocument()
  })

  it('checks duplicates when printing with enter', async () => {
    window.localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify([{ text: '문석민', labelSize: '12x22', printedAt: '2026-06-30T00:00:00.000Z' }]),
    )

    render(<App />)

    const input = screen.getByPlaceholderText('라벨 이름')
    fireEvent.change(input, { target: { value: '문석민' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(await screen.findByText('Same name already exists')).toBeInTheDocument()
  })

  it('focuses modal confirm button and confirms on enter', async () => {
    const onConfirm = vi.fn()
    render(
      <MantineProvider>
        <ConfirmModal
          opened
          title="Delete history item?"
          message="Delete this item?"
          confirmLabel="Delete"
          cancelLabel="Cancel"
          destructive
          onCancel={vi.fn()}
          onConfirm={onConfirm}
        />
      </MantineProvider>,
    )

    const deleteButton = await screen.findByRole('button', { name: 'Delete' })
    await waitFor(() => expect(deleteButton).toHaveFocus())

    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
