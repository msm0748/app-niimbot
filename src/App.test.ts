import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import App from './App.svelte'

describe('App', () => {
  it('renders the printer workflow', async () => {
    render(App)

    expect(screen.getByText('NIIMBOT D11_H Label Printer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /print/i })).toBeDisabled()
    expect(screen.getByText('Print History')).toBeInTheDocument()
  })
})
