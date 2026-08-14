// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LoginPagina } from '../../src/renderer/src/mvp/LoginPagina'

describe('Antessala demo login', () => {
  it('offers the five fixture roles and submits the selected account', async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined)
    render(<LoginPagina onLogin={onLogin} />)

    expect(screen.getAllByRole('button', { name: /entrar como/i })).toHaveLength(5)
    await userEvent.click(screen.getByRole('button', { name: /entrar como recepção/i }))

    expect(onLogin).toHaveBeenCalledWith('recepcao@antessala.demo', 'demo123')
  })
})
