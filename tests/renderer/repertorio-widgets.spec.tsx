/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Repertório › Widgets.
 *
 * O que separa catálogo de galeria é dizer para que a peça serve. Aqui isso é o
 * contador de uso: o widget declara em quantas composições entrou — e "em
 * nenhum protocolo" é informação, não ausência dela.
 */
vi.mock('@/servicos/client', () => ({
  temPersistencia: false,
  client: {},
}))

describe('Repertório › Widgets', () => {
  beforeEach(async () => {
    const { resetarStoreDeProtocolos } = await import(
      '../../src/renderer/src/vitrine/protocolos-store'
    )
    resetarStoreDeProtocolos()
  })

  async function abrirPainel() {
    const { PainelWidgets } = await import(
      '../../src/renderer/src/paginas/repertorio/PainelWidgets'
    )
    render(
      <MemoryRouter>
        <PainelWidgets />
      </MemoryRouter>,
    )
    return userEvent.setup()
  }

  it('mostra as duas gramáticas, separadas', async () => {
    await abrirPainel()

    expect(screen.getByRole('heading', { name: 'Widgets do Antessala' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Herança do DietFlow' })).toBeInTheDocument()

    // Um de cada registro, para provar que os dois renderizam de verdade.
    expect(screen.getByText('Alergias')).toBeInTheDocument()
    expect(screen.getByText('Sono')).toBeInTheDocument()
  })

  it('o contador é derivado das composições, não um enfeite fixo', async () => {
    const { PROTOCOLOS_FIXTURE } = await import('../../src/shared/protocolos')
    await abrirPainel()

    const usosDe = (tipo: string) =>
      PROTOCOLOS_FIXTURE.filter((p) => p.blocos.includes(tipo)).length

    // Alergias entra em toda composição; capacidade funcional em poucas.
    const universal = usosDe('allergies')
    const raro = usosDe('functional_capacity')
    expect(raro).toBeLessThan(universal)

    expect(screen.getAllByText(`em ${universal} protocolos`).length).toBeGreaterThan(0)
    expect(screen.getAllByText(`em ${raro} protocolos`).length).toBeGreaterThan(0)
  })

  it('a herança do DietFlow não conta uso: ela não entra em protocolo nenhum', async () => {
    await abrirPainel()

    expect(
      screen.getByText(/Nenhum destes blocos entra no protocolo pré-anestésico/),
    ).toBeInTheDocument()
  })

  it('a busca filtra as duas seções e some com a que ficou vazia', async () => {
    const user = await abrirPainel()

    await user.type(screen.getByPlaceholderText(/Buscar widget/), 'sono')

    expect(screen.getByText('Sono')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Widgets do Antessala' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Herança do DietFlow' })).toBeInTheDocument()
  })

  it('busca sem resultado avisa em vez de mostrar tela vazia', async () => {
    const user = await abrirPainel()

    await user.type(screen.getByPlaceholderText(/Buscar widget/), 'colonoscopia virtual')

    expect(screen.getByText('Nenhum widget com esse nome.')).toBeInTheDocument()
  })
})
