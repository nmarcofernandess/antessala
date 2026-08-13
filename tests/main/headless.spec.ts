import { describe, expect, it } from 'vitest'
import { isHeadlessRun, shouldShowMainWindow } from '../../src/main/headless'

describe('headless Electron mode', () => {
  it('keeps the app running without showing the main window only when explicitly enabled', () => {
    expect(isHeadlessRun({ ANTESSALA_HEADLESS: '1' })).toBe(true)
    expect(shouldShowMainWindow({ ANTESSALA_HEADLESS: '1' })).toBe(false)
    expect(isHeadlessRun({ ANTESSALA_HEADLESS: 'true' })).toBe(false)
    expect(isHeadlessRun({ FLOWKIT_HEADLESS: '1' })).toBe(false)
    expect(shouldShowMainWindow({})).toBe(true)
  })
})
