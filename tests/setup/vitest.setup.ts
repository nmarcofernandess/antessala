// Vitest global setup
import '@testing-library/jest-dom'

/**
 * jsdom não implementa `ResizeObserver`, e os primitivos do Radix que medem
 * layout — ScrollArea, Select — quebram no mount sem ele. O stub não observa
 * nada de verdade: só existe para a árvore montar e o teste poder consultar o
 * que está na tela.
 */
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
