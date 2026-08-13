// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  isSafeMessageImageSource,
  MessageResponse,
} from '../../src/renderer/src/components/ai-elements/message'

describe('MessageResponse', () => {
  it('never mounts an HTTP image supplied by a model response', () => {
    const { container } = render(
      <MessageResponse>{'![prontuário](https://tracker.example/paciente-123)'}</MessageResponse>,
    )

    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('Imagem remota bloqueada: prontuário')).toBeInTheDocument()
  })

  it('still accepts inline image data without network access', () => {
    expect(isSafeMessageImageSource('data:image/png;base64,AA==')).toBe(true)
    expect(isSafeMessageImageSource('blob:https://app.local/id')).toBe(true)
    expect(isSafeMessageImageSource('https://example.com/image.png')).toBe(false)
    expect(isSafeMessageImageSource('//example.com/image.png')).toBe(false)
  })
})
