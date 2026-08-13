import { describe, expect, it, vi } from 'vitest'
import {
  installRendererNetworkPolicy,
  isAllowedExternalUrl,
  REMOTE_RENDERER_URLS,
  shouldBlockRendererRequest,
} from '../../src/main/renderer-network-policy'

describe('renderer network policy', () => {
  it('blocks every remote renderer request in a packaged boot', () => {
    expect(shouldBlockRendererRequest('https://tracker.example/pixel')).toBe(true)
    expect(shouldBlockRendererRequest('http://127.0.0.1:8080/collect')).toBe(true)
    expect(shouldBlockRendererRequest('wss://tracker.example/socket')).toBe(true)
    expect(shouldBlockRendererRequest('file:///app/index.html')).toBe(false)
    expect(shouldBlockRendererRequest('data:image/png;base64,AA==')).toBe(false)
  })

  it('allows only the exact electron-vite origin during development', () => {
    const devUrl = 'http://localhost:5173/'
    expect(shouldBlockRendererRequest('http://localhost:5173/src/main.tsx', devUrl)).toBe(false)
    expect(shouldBlockRendererRequest('ws://localhost:5173/', devUrl)).toBe(false)
    expect(shouldBlockRendererRequest('https://example.com/pixel', devUrl)).toBe(true)
    expect(shouldBlockRendererRequest('http://localhost:5174/pixel', devUrl)).toBe(true)
  })

  it('permite abrir externamente apenas URLs HTTPS', () => {
    expect(isAllowedExternalUrl('https://example.com/artigo')).toBe(true)
    expect(isAllowedExternalUrl('http://example.com/artigo')).toBe(false)
    expect(isAllowedExternalUrl('file:///tmp/segredo')).toBe(false)
    expect(isAllowedExternalUrl('custom-app://executar')).toBe(false)
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedExternalUrl('não é uma url')).toBe(false)
  })

  it('installs a fail-closed webRequest hook once per session', () => {
    const onBeforeRequest = vi.fn()
    const session = { webRequest: { onBeforeRequest } } as never

    installRendererNetworkPolicy(session, 'http://localhost:5173/')
    installRendererNetworkPolicy(session, 'http://localhost:5173/')

    expect(onBeforeRequest).toHaveBeenCalledOnce()
    const [filter, listener] = onBeforeRequest.mock.calls[0] as [
      { urls: string[] },
      (details: { url: string }, callback: (result: { cancel: boolean }) => void) => void,
    ]
    expect(filter).toEqual({ urls: [...REMOTE_RENDERER_URLS] })

    const callback = vi.fn()
    listener({ url: 'https://example.com/pixel' }, callback)
    expect(callback).toHaveBeenCalledWith({ cancel: true })
  })
})
