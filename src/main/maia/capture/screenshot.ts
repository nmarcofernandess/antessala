import crypto from 'node:crypto'
import type { IaAnexo } from '../../../shared/types'
import type { MaiaCaptureOutcome } from '../../../shared/maia-mvp-contract'

export function makeScreenshotAttachment(input: { pngBase64: string }): IaAnexo {
  const buffer = Buffer.from(input.pngBase64, 'base64')
  return {
    id: crypto.randomUUID(),
    tipo: 'image',
    mime_type: 'image/png',
    nome: 'maia-screenshot.png',
    tamanho_bytes: buffer.byteLength,
    data_base64: input.pngBase64,
  }
}

export async function capturePrimaryDisplayScreenshot(): Promise<MaiaCaptureOutcome<IaAnexo>> {
  try {
    const { desktopCapturer } = await import('electron')
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1440, height: 900 },
    })
    const source = sources[0]
    if (!source || source.thumbnail.isEmpty()) {
      return { ok: false, reason: 'no-source', message: 'Nenhuma tela disponível para captura.' }
    }
    return {
      ok: true,
      value: makeScreenshotAttachment({ pngBase64: source.thumbnail.toPNG().toString('base64') }),
    }
  } catch (err) {
    // desktopCapturer pode rejeitar (permissão revogada em runtime, toPNG falhar).
    // Honramos o contrato de outcome em vez de deixar a exceção abortar o comando.
    return { ok: false, reason: 'error', message: `Falha ao capturar a tela: ${(err as Error).message}` }
  }
}
