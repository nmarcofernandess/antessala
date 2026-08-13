import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getSources: vi.fn() }))

vi.mock('electron', () => ({
  desktopCapturer: { getSources: mocks.getSources },
}))

function fakeSource(empty: boolean) {
  return {
    thumbnail: {
      isEmpty: () => empty,
      toPNG: () => Buffer.from('fake image'),
    },
  }
}

describe('Maiá capture contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('normalizes screenshot capture into a FlowKit image attachment', async () => {
    const { makeScreenshotAttachment } = await import('../../../src/main/maia/capture/screenshot')
    const data = Buffer.from('fake image').toString('base64')

    const attachment = makeScreenshotAttachment({ pngBase64: data })

    expect(attachment).toMatchObject({
      tipo: 'image',
      mime_type: 'image/png',
      nome: 'maia-screenshot.png',
      tamanho_bytes: Buffer.from('fake image').byteLength,
      data_base64: data,
    })
  })

  it('returns an ok capture outcome with the attachment when a screen source exists', async () => {
    mocks.getSources.mockResolvedValue([fakeSource(false)])
    const { capturePrimaryDisplayScreenshot } = await import('../../../src/main/maia/capture/screenshot')

    const outcome = await capturePrimaryDisplayScreenshot()

    expect(outcome.ok).toBe(true)
    expect(outcome.value).toMatchObject({ tipo: 'image', mime_type: 'image/png' })
  })

  it('returns a not-ok outcome with a reason when no screen source is available', async () => {
    mocks.getSources.mockResolvedValue([])
    const { capturePrimaryDisplayScreenshot } = await import('../../../src/main/maia/capture/screenshot')

    const outcome = await capturePrimaryDisplayScreenshot()

    expect(outcome.ok).toBe(false)
    expect(outcome.reason).toBe('no-source')
    expect(outcome.message).toBeTruthy()
  })
})
