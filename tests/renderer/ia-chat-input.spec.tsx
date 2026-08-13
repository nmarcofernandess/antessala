/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IaChatInput } from '../../src/renderer/src/componentes/IaChatInput'

describe('IaChatInput cloud direto', () => {
  it('envia texto e não oferece microfone, anexo ou troca de modelo', async () => {
    const onEnviar = vi.fn()
    const user = userEvent.setup()
    render(
      <IaChatInput
        value="Avalie este caso"
        onChange={vi.fn()}
        onEnviar={onEnviar}
        disabled={false}
        providerLabel="Google Gemini"
        modelo="gemini-3.5-flash"
      />,
    )

    expect(screen.getByText('Google Gemini · gemini-3.5-flash')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ditado|microfone|anexar/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/IA local|roteamento|ferramenta/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(onEnviar).toHaveBeenCalledTimes(1)
  })

  it('explica que os dados clínicos precisam de revisão humana', () => {
    render(
      <IaChatInput
        value=""
        onChange={vi.fn()}
        onEnviar={vi.fn()}
        disabled
        providerLabel="IA não configurada"
      />,
    )

    expect(screen.getByText(/Revise informações clínicas/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
  })
})
