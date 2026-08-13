/** @vitest-environment jsdom */

import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  WIDGET_REGISTRY,
  createEmptyAnamnese,
  type AdesaoData,
  type AnamneseContent,
  type ObservacoesGeraisData,
} from '../../../src/shared/anamnese'
import {
  AdesaoWidget,
  AnamneseComposer,
  ObservacoesGeraisWidget,
  WIDGET_UI_REGISTRY,
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
})
