export function createAnamneseId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `anamnese-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
