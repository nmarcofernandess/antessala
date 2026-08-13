import type { MaiaCaptureOutcome } from '../../../shared/maia-mvp-contract'
import { readClipboardText, writeClipboardText } from './clipboard'

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Captura a seleção atual via Cmd+C e restaura o clipboard. Retorna um outcome
// honesto: sem texto = empty; falha do osascript (sem Acessibilidade) = permission.
export async function captureSelectedText(): Promise<MaiaCaptureOutcome<string>> {
  const { clipboard } = await import('electron')
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const execFileAsync = promisify(execFile)

  const previousText = await readClipboardText()
  try {
    clipboard.clear()
    await execFileAsync('osascript', ['-e', 'tell application "System Events" to keystroke "c" using command down'])
    await wait(120)
    const text = await readClipboardText()
    await writeClipboardText(previousText)
    if (!text.trim()) {
      return { ok: false, reason: 'empty', message: 'Nenhum texto selecionado para capturar.' }
    }
    return { ok: true, value: text }
  } catch (err) {
    if (await readClipboardText() !== previousText) {
      await writeClipboardText(previousText)
    }
    return {
      ok: false,
      reason: 'permission',
      message: `Não consegui capturar a seleção (osascript falhou — provável Acessibilidade): ${(err as Error).message}`,
    }
  }
}
