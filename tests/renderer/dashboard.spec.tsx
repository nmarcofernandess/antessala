/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SidebarProvider } from '../../src/renderer/src/components/ui/sidebar'

const respostas = vi.hoisted(() => ({
  casos: [] as unknown[],
  contagens: {} as Record<string, number>,
  agenda: { resources: [], dias: [] as unknown[] },
}))

/**
 * O painel deixou de ler fixture e passou a contar o banco. As proibições que o
 * esqueleto protegia continuam sendo o coração deste teste: contar não é
 * inventar. O painel não fala por outro subsistema, não pergunta configuração de
 * IA nem de backup, e não carimba achado clínico ao lado do nome de ninguém.
 */
vi.mock('@/servicos/client', () => ({
  temPersistencia: true,
  client: {
    'cases.listForActor': async () => respostas.casos,
    'cases.counts': async () => respostas.contagens,
    'scheduling.range': async () => respostas.agenda,
  },
}))

vi.mock('@/componentes/PageHeader', () => ({
  PageHeader: ({ breadcrumbs }: { breadcrumbs: Array<{ label: string }> }) => (
    <header>{breadcrumbs.map(({ label }) => label).join(' / ')}</header>
  ),
}))

function stubMatchMedia() {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

const CASO_AGENDADO = {
  id: 'caso-1',
  displayCode: 'ANT-2026-0001',
  personName: 'Marta Ribeiro Alves',
  personAge: 78,
  procedureDescription: 'Colonoscopia diagnóstica',
  requesterLabel: 'Dr. Aurélio Prado',
  serviceName: 'Gastroenterologia',
  status: 'SCHEDULED',
  responsibility: { currentRoles: ['RECEPCAO'], nextRoles: ['ANESTESIOLOGISTA'] },
  version: 6,
  openedAt: '2026-08-14T09:00:00.000Z',
  updatedAt: '2026-08-14T10:00:00.000Z',
  booking: {
    id: 'b1',
    startsAt: '2026-08-14T11:00:00.000Z',
    endsAt: '2026-08-14T11:35:00.000Z',
    slotClass: 'STANDARD',
  },
  requirement: { id: 'r1', slotClass: 'STANDARD', durationMinutes: 35 },
}

describe('Painel do dia — conta o que existe, não inventa', () => {
  beforeEach(() => {
    stubMatchMedia()
    respostas.casos = []
    respostas.contagens = {}
    respostas.agenda = { resources: [], dias: [] }
    Object.assign(window, {
      electron: { ipcRenderer: { invoke: vi.fn(async () => '1.0.0'), on: vi.fn(() => vi.fn()) } },
    })
  })

  async function montar() {
    const { Dashboard } = await import('../../src/renderer/src/paginas/Dashboard')
    render(
      <MemoryRouter>
        <SidebarProvider>
          <Dashboard />
        </SidebarProvider>
      </MemoryRouter>,
    )
    await screen.findByText('Painel do dia')
  }

  it('mostra o painel operacional do dia e assume que o dado é sintético', async () => {
    await montar()

    expect(screen.getByText('Painel do dia')).toBeInTheDocument()
    expect(screen.getByText('Fluxo do dia')).toBeInTheDocument()

    // Sem este carimbo o painel passaria por dado real de hospital.
    expect(screen.getByText('Dados sintéticos')).toBeInTheDocument()
  })

  it('banco vazio mostra banco vazio, com o caminho do primeiro encaminhamento', async () => {
    await montar()

    const fila = within(screen.getByTestId('fila-do-dia'))
    expect(fila.getByText('Nenhum encaminhamento registrado')).toBeInTheDocument()
    expect(fila.getByRole('link', { name: /Registrar encaminhamento/ })).toHaveAttribute(
      'href',
      '/casos/novo',
    )
  })

  it('não inventa status de sistema, memória, embedding nem fonte de conhecimento', async () => {
    await montar()

    expect(screen.queryByText('Status do sistema')).not.toBeInTheDocument()
    expect(screen.queryByText('Embedding')).not.toBeInTheDocument()
    expect(screen.queryByText('Fontes')).not.toBeInTheDocument()
    expect(screen.queryByText(/Importe documentos/)).not.toBeInTheDocument()
  })

  it('não expõe motivo clínico na fila da recepção', async () => {
    respostas.casos = [CASO_AGENDADO]
    respostas.contagens = { SCHEDULED: 1 }
    await montar()

    // A fila mostra classe, duração e recurso — nunca o achado que os produziu.
    // O escopo é a fila, e não a página: explicar a regra de dimensionamento em
    // outro bloco é legítimo; carimbar o achado ao lado do nome de alguém não é.
    const fila = within(screen.getByTestId('fila-do-dia'))
    expect(fila.getByText('Marta Ribeiro Alves')).toBeInTheDocument()
    expect(fila.getByText('Vaga normal')).toBeInTheDocument()

    // Termos inequívocos de achado: o nome do procedimento pode conter
    // "diagnóstica" sem ser um diagnóstico, e isso é dado do encaminhamento.
    for (const clinico of [
      /alergia/i,
      /anticoagulante/i,
      /comorbidade/i,
      /hipertens/i,
      /diabet/i,
      /\bCID\b/,
      /\bASA\b/,
    ]) {
      expect(fila.queryByText(clinico)).not.toBeInTheDocument()
    }
  })

  it('não consulta configuração de IA nem de backup ao abrir', async () => {
    await montar()

    const invoke = (window as unknown as { electron: { ipcRenderer: { invoke: ReturnType<typeof vi.fn> } } })
      .electron.ipcRenderer.invoke
    const canais = invoke.mock.calls.map(([canal]) => canal)
    expect(canais).not.toContain('ia.configuracao.obter')
    expect(canais).not.toContain('backup.config.obter')
  })
})
