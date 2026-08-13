import type { IaAnexo } from '../../shared/types'
import type { MaiaOutputMode } from './contextual-flow'
import type { MaiaCommand, MaiaCommandResult } from './command-types'
import { captureSelectedText } from './capture/clipboard-selection'
import { capturePrimaryDisplayScreenshot } from './capture/screenshot'
import { pasteClipboardText, readClipboardText, replaceSelectedText, writeClipboardText } from './capture/clipboard'
import { readLiteralText } from './literal-reading'
import { runContextualQuestion } from './contextual-flow'
import { getMaiaCapabilities } from './capabilities'

export interface MaiaLiteralReadInput {
  text?: string
}

export interface MaiaLiteralReadResult {
  spoken: true
  textLength: number
}

export interface MaiaContextualAskInput {
  prompt: string
  selectedText?: string
  manualText?: string
  includeScreenshot?: boolean
  outputMode?: MaiaOutputMode
}

export interface MaiaContextualSummarizeInput {
  selectedText?: string
  manualText?: string
  includeScreenshot?: boolean
  outputMode?: MaiaOutputMode
}

export interface MaiaContextualAskResult {
  conversaId: string
  resposta: string
  outputMode: MaiaOutputMode
  captured: {
    selectedText: boolean
    screenshot: boolean
  }
}

async function selectedTextOrCapture(text?: string): Promise<string> {
  if (text?.trim()) return text.trim()
  const outcome = await captureSelectedText()
  if (outcome.ok) return outcome.value.trim()
  // Nem permission nem empty somem caladas — ambas viram log rastreável.
  // (permission = Acessibilidade negada; empty = nada selecionado.)
  console.warn(`[maia] selection capture (${outcome.reason}):`, outcome.message)
  return ''
}

// Screenshot só é capturado/enviado quando há visão real (rota com visão ou
// Gemma+mmproj) E Screen Recording concedido. Nunca mandamos imagem a uma rota
// sem visão — a Maiá não finge enxergar.
async function captureScreenshotIfSupported(wanted: boolean): Promise<IaAnexo | null> {
  if (!wanted) return null
  const caps = await getMaiaCapabilities()
  if (!caps.supportsScreenshot) return null
  const outcome = await capturePrimaryDisplayScreenshot()
  if (outcome.ok) return outcome.value
  // Prometemos visão (supportsScreenshot) mas a captura falhou: não fingimos.
  // A ação segue sem imagem e `captured.screenshot:false` declara isso à UI.
  console.warn('[maia] screenshot capture failed after promising vision:', outcome.message)
  return null
}

export async function runLiteralReadAction(input: MaiaLiteralReadInput): Promise<MaiaLiteralReadResult> {
  const text = await selectedTextOrCapture(input.text)
  await readLiteralText({ text })
  return { spoken: true, textLength: text.length }
}

export async function runContextualAskAction(input: MaiaContextualAskInput): Promise<MaiaContextualAskResult> {
  const selectedText = await selectedTextOrCapture(input.selectedText)
  const includeScreenshot = input.includeScreenshot ?? true
  const screenshotAttachment = await captureScreenshotIfSupported(includeScreenshot)

  const result = await runContextualQuestion({
    prompt: input.prompt,
    selectedText,
    manualText: input.manualText,
    screenshotAttachment,
    outputMode: input.outputMode ?? 'voice',
  })

  return {
    ...result,
    captured: {
      selectedText: selectedText.length > 0,
      screenshot: Boolean(screenshotAttachment),
    },
  }
}

export async function runContextualSummarizeAction(input: MaiaContextualSummarizeInput): Promise<MaiaContextualAskResult> {
  return runContextualAskAction({
    ...input,
    includeScreenshot: input.includeScreenshot ?? false,
    prompt: 'Resuma o conteudo capturado com foco no que eu preciso entender, decidir ou responder.',
  })
}

async function captureSelectionIfEnabled(enabled: boolean): Promise<string> {
  if (!enabled) return ''
  return selectedTextOrCapture('')
}

async function captureClipboardIfEnabled(enabled: boolean): Promise<string> {
  if (!enabled) return ''
  try {
    return await readClipboardText()
  } catch (err) {
    console.warn('[maia] clipboard capture skipped:', (err as Error).message)
    return ''
  }
}

function promptForCommand(command: MaiaCommand): string {
  if (command.kind === 'summarize_clipboard') {
    return 'Resuma o conteudo capturado com foco no que eu preciso entender, decidir ou responder.'
  }
  if (command.kind === 'draft_reply') {
    return command.prompt.trim() || 'Escreva uma resposta que eu possa colar, usando o contexto capturado.'
  }
  return command.prompt.trim()
}

function manualTextFromClipboard(clipboardText: string): string {
  return clipboardText ? `[Clipboard]\n${clipboardText}` : ''
}

function emptySideEffects(): MaiaCommandResult['sideEffects'] {
  return { spoke: false, copied: false, pasted: false, replaced: false, openedChat: false }
}

async function applyCommandOutput(output: MaiaCommand['output'], text: string): Promise<MaiaCommandResult['sideEffects']> {
  const sideEffects = emptySideEffects()
  if (output === 'copy') {
    await writeClipboardText(text)
    sideEffects.copied = true
  }
  if (output === 'paste') {
    await writeClipboardText(text)
    await pasteClipboardText()
    sideEffects.copied = true
    sideEffects.pasted = true
  }
  if (output === 'replace') {
    await replaceSelectedText(text)
    sideEffects.replaced = true
  }
  return sideEffects
}

export async function runMaiaCommandAction(command: MaiaCommand): Promise<MaiaCommandResult> {
  const selection = await captureSelectionIfEnabled(command.inputSources.selection)
  const clipboardText = await captureClipboardIfEnabled(command.inputSources.clipboard)

  if (command.kind === 'dictate_clipboard') {
    await readLiteralText({ text: clipboardText })
    return {
      resposta: clipboardText,
      output: command.output,
      sideEffects: { ...emptySideEffects(), spoke: true },
      captured: { selection: false, clipboard: clipboardText.length > 0, screenshot: false },
    }
  }

  const screenshotAttachment = await captureScreenshotIfSupported(command.inputSources.screenshot)

  const outputMode: MaiaOutputMode = command.output === 'voice' ? 'voice' : 'text'
  const result = await runContextualQuestion({
    prompt: promptForCommand(command),
    selectedText: selection,
    manualText: manualTextFromClipboard(clipboardText),
    screenshotAttachment,
    outputMode,
  })

  const sideEffects = await applyCommandOutput(command.output, result.resposta)
  if (command.output === 'voice') sideEffects.spoke = true
  if (command.output === 'chat' || command.openChatAfter) sideEffects.openedChat = true

  return {
    conversaId: result.conversaId,
    resposta: result.resposta,
    output: command.output,
    sideEffects,
    captured: {
      selection: selection.length > 0,
      clipboard: clipboardText.length > 0,
      screenshot: Boolean(screenshotAttachment),
    },
  }
}
