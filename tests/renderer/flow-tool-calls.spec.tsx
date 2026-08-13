/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FlowToolCalls } from '../../src/renderer/src/componentes/ai/FlowToolCalls'
import type { ToolCall } from '../../src/shared/types'

describe('FlowToolCalls', () => {
  it('renders completed and errored tool states', () => {
    const calls: ToolCall[] = [
      { id: 'a', name: 'terminal_exec', args: { command: 'pwd' }, result: { ok: true } },
      { id: 'b', name: 'buscar_conhecimento', args: {}, result: { error: 'sem fonte' } },
    ]

    render(<FlowToolCalls toolCalls={calls} />)

    expect(screen.getByText('terminal_exec')).toBeInTheDocument()
    expect(screen.getByText('Concluída')).toBeInTheDocument()
    expect(screen.getByText('buscar_conhecimento')).toBeInTheDocument()
    // "Erro" surfaces both in the status badge and the output frame header, both correct PT labels.
    expect(screen.getAllByText('Erro').length).toBeGreaterThan(0)
  })

  it('renders running tools from streaming state through the same tool UI', () => {
    render(
      <FlowToolCalls
        toolCalls={[]}
        runningTools={{
          c: {
            tool_name: 'terminal_exec',
            args: { command: 'cat "/tmp/a b.txt"' },
            started_at: 1,
          },
        }}
      />,
    )

    expect(screen.getByText('terminal_exec')).toBeInTheDocument()
    expect(screen.getByText('Executando')).toBeInTheDocument()
  })
})
