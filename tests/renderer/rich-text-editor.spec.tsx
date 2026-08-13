/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RichTextEditor } from '../../src/renderer/src/componentes/RichTextEditor'

for (const target of [HTMLElement.prototype, Node.prototype]) {
  Object.defineProperty(target, 'getClientRects', {
    configurable: true,
    value: () => [{ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }],
  })
}
Object.defineProperty(Node.prototype, 'getBoundingClientRect', {
  configurable: true,
  value: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
})
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => document.body })

const value = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Texto inicial' }] }],
}

describe('RichTextEditor genérico', () => {
  it('preserva a superfície TipTap sem tipos editoriais', () => {
    const onTitleChange = vi.fn()
    render(
      <RichTextEditor
        value={value}
        onChange={vi.fn()}
        title="Nota clínica"
        onTitleChange={onTitleChange}
        status="saved"
        revision={2}
      />,
    )

    expect(document.querySelector('[contenteditable="true"]')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Negrito' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Título 1' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('Salvo · revisão 2')
    fireEvent.change(screen.getByRole('textbox', { name: 'Título' }), {
      target: { value: 'Novo título' },
    })
    expect(onTitleChange).toHaveBeenCalledWith('Novo título')
  })
})
