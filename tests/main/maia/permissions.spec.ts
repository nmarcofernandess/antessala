import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMediaAccessStatus: vi.fn(() => 'granted'),
  isTrustedAccessibilityClient: vi.fn(() => true),
}))

vi.mock('electron', () => ({
  systemPreferences: {
    getMediaAccessStatus: mocks.getMediaAccessStatus,
    isTrustedAccessibilityClient: mocks.isTrustedAccessibilityClient,
  },
}))

describe('Maia macOS permissions', () => {
  it('reports screen and accessibility permission state', async () => {
    const { getMaiaPermissionStatus } = await import('../../../src/main/maia/permissions')

    await expect(getMaiaPermissionStatus()).resolves.toEqual({
      screen: 'granted',
      accessibility: 'granted',
    })
  })
})
