/** @vitest-environment jsdom */

import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  WIDGET_REGISTRY,
  createEmptyAnamnese,
  createWidgetBlock,
  type AdesaoData,
  type AnamneseContent,
  type Bloco,
  type MedicacoesData,
  type ObservacoesGeraisData,
  type ProblemasSaudeData,
} from '../../../src/shared/anamnese'
import {
  AdesaoWidget,
  AnamneseComposer,
  MedicacoesWidget,
  ObservacoesGeraisWidget,
  ProblemasSaudeWidget,
  WIDGET_UI_REGISTRY,
  reorderWidgetsPreservingAnchors,
} from '../../../src/renderer/src/anamnese'

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  })
})

afterAll(() => vi.unstubAllGlobals())
afterEach(cleanup)

function AdesaoHarness(): React.JSX.Element {
  const [data, setData] = useState<AdesaoData>({ seguiu: 'sim', diasPeriodo: 7 })
  return <AdesaoWidget data={data} onChange={setData} />
}

function ObservacoesHarness(): React.JSX.Element {
  const [data, setData] = useState<ObservacoesGeraisData>({ texto: '' })
  return <ObservacoesGeraisWidget data={data} onChange={setData} />
}

function ComposerHarness(): React.JSX.Element {
  const [content, setContent] = useState<AnamneseContent>(createEmptyAnamnese())
  return <AnamneseComposer value={content} onChange={setContent} availableWidgetTypes={['hidratacao']} />
}

function HydrationComposerHarness(): React.JSX.Element {
  const [content, setContent] = useState<AnamneseContent>(() => ({
    _v: 2,
    blocos: [createWidgetBlock('hidratacao', 'hidratacao-1')],
  }))
  return <AnamneseComposer value={content} onChange={setContent} />
}

function DefaultComposerHarness(): React.JSX.Element {
  const [content, setContent] = useState<AnamneseContent>(createEmptyAnamnese())
  return <AnamneseComposer value={content} onChange={setContent} />
}

function MedicacoesHarness(): React.JSX.Element {
  const [data, setData] = useState<MedicacoesData>({ medicacoes: [] })
  return (
    <>
      <MedicacoesWidget data={data} onChange={setData} />
      <output data-testid="medicacoes-data">{JSON.stringify(data)}</output>
    </>
  )
}

function ProblemasSaudeHarness(): React.JSX.Element {
  const [data, setData] = useState<ProblemasSaudeData>({ problemas: [] })
  return (
    <>
      <ProblemasSaudeWidget data={data} onChange={setData} />
      <output data-testid="problemas-data">{JSON.stringify(data)}</output>
    </>
  )
}

describe('editores shadcn da anamnese', () => {
  it('mantém um componente de UI separado para cada definição headless', () => {
    expect(Object.keys(WIDGET_UI_REGISTRY)).toEqual(Object.keys(WIDGET_REGISTRY))
    for (const [type, entry] of Object.entries(WIDGET_UI_REGISTRY)) {
      expect(entry.definition).toBe(WIDGET_REGISTRY[type as keyof typeof WIDGET_REGISTRY])
      expect(entry.Component).toBeTypeOf('function')
    }
  })

  it('renderiza os oito editores com seus defaults', () => {
    for (const entry of Object.values(WIDGET_UI_REGISTRY)) {
      const Component = entry.Component
      const view = render(
        <Component
          data={structuredClone(entry.definition.defaultData) as Record<string, unknown>}
          onChange={vi.fn()}
        />,
      )
      expect(view.container).not.toBeEmptyDOMElement()
      view.unmount()
    }
  })

  it('edita a resposta de adesão', async () => {
    const user = userEvent.setup()
    render(<AdesaoHarness />)

    await user.click(screen.getByRole('button', { name: 'Não' }))
    expect(screen.getByRole('button', { name: 'Não' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('edita observações em um textarea controlado', async () => {
    const user = userEvent.setup()
    render(<ObservacoesHarness />)

    const textarea = screen.getByLabelText('Observações')
    await user.type(textarea, 'Sem intercorrências')
    expect(textarea).toHaveValue('Sem intercorrências')
  })

  it('adiciona um widget pelo drawer sem ativar template clínico', async () => {
    const user = userEvent.setup()
    render(<ComposerHarness />)

    await user.click(screen.getByRole('button', { name: 'Adicionar bloco' }))
    await user.click(await screen.findByRole('button', { name: /Hidratação/ }))

    expect(await screen.findByText('Consumo de água em litros por dia')).toBeInTheDocument()
    expect(screen.getByLabelText('Litros por dia')).toHaveValue(2)
  })

  it('usa o ponto de extensão vazio como catálogo padrão do composer', async () => {
    const user = userEvent.setup()
    render(<DefaultComposerHarness />)

    await user.click(screen.getByRole('button', { name: 'Adicionar bloco' }))

    expect(await screen.findByText('Nenhum bloco encontrado.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Hidratação/ })).not.toBeInTheDocument()
  })

  it('mantém nova medicação em draft local até existir um nome válido', async () => {
    const user = userEvent.setup()
    render(<MedicacoesHarness />)

    await user.click(screen.getByRole('button', { name: 'Adicionar medicação' }))
    const nome = screen.getByLabelText('Nome da medicação')
    expect(screen.getByTestId('medicacoes-data')).toHaveTextContent('{"medicacoes":[]}')

    await user.type(nome, 'Metformina')
    expect(screen.getByTestId('medicacoes-data')).toHaveTextContent('{"medicacoes":[]}')

    await user.tab()
    expect(screen.getByTestId('medicacoes-data')).toHaveTextContent('Metformina')
  })

  it('mantém nova condição em draft local até existir um nome válido', async () => {
    const user = userEvent.setup()
    render(<ProblemasSaudeHarness />)

    await user.click(screen.getByRole('button', { name: 'Adicionar condição' }))
    const nome = screen.getByLabelText('Nome da condição')
    expect(screen.getByTestId('problemas-data')).toHaveTextContent('{"problemas":[]}')

    await user.type(nome, 'Asma')
    expect(screen.getByTestId('problemas-data')).toHaveTextContent('{"problemas":[]}')

    await user.tab()
    expect(screen.getByTestId('problemas-data')).toHaveTextContent('Asma')
  })

  it('preserva o editor durante um número intermediário inválido e permite corrigi-lo', async () => {
    const user = userEvent.setup()
    render(<HydrationComposerHarness />)

    const peso = screen.getByLabelText('Peso para cálculo local (kg)')
    await user.type(peso, '7')
    await user.tab()

    expect(peso).toHaveValue(7)
    expect(screen.getByRole('alert')).toHaveTextContent('Valor mínimo: 20.')
    expect(screen.queryByText(/dados deste widget são inválidos/i)).not.toBeInTheDocument()

    await user.click(peso)
    await user.type(peso, '0')
    await user.tab()

    expect(peso).toHaveValue(70)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('reordena widgets sem deslocar snapshots e resultados', () => {
    const blocos: Bloco[] = [
      createWidgetBlock('adesao', 'w1'),
      {
        id: 'snapshot',
        type: 'snapshot',
        dataCaptura: '2026-08-13T10:00:00Z',
        dados: { dataCaptura: '2026-08-13T10:00:00Z' },
      },
      createWidgetBlock('sono', 'w2'),
      createWidgetBlock('hidratacao', 'w3'),
      {
        id: 'resultado',
        type: 'resultado_protocolo',
        protocoloTipo: 'teste',
        protocoloId: 'p1',
        scoreCapturado: 1,
        dataCaptura: '2026-08-13T10:00:00Z',
      },
    ]

    const reordered = reorderWidgetsPreservingAnchors(blocos, 'w3', 'w1')
    expect(reordered.map((bloco) => bloco.id)).toEqual([
      'w3',
      'snapshot',
      'w1',
      'w2',
      'resultado',
    ])
  })
})
