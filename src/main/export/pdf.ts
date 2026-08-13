import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import electron from 'electron'
import type { WebRequest } from 'electron'

export interface ExportPdfInput {
  html: string
  filename?: string
  landscape?: boolean
}

export interface ExportPdfResult {
  filepath: string
}

/**
 * A janela de impressão usa uma sessão efêmera própria. Bloquear também
 * WebSocket evita que HTML recebido do renderer abra um canal lateral de rede.
 */
export const PDF_BLOCKED_NETWORK_URLS = [
  'http://*/*',
  'https://*/*',
  'ws://*/*',
  'wss://*/*',
] as const

function htmlDataUrl(html: string): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

/**
 * Porta isolada do handler `export.imprimirPDF` do EscalaFlow.
 *
 * Recebe HTML pronto e usa apenas o motor nativo de impressão do Electron.
 * O router IPC do Antessala pode ligar esta função diretamente quando a
 * superfície de exportação for criada.
 */
export async function exportHtmlToPdf(input: ExportPdfInput): Promise<ExportPdfResult | null> {
  const result = await electron.dialog.showSaveDialog({
    defaultPath: input.filename || 'antessala.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })

  if (result.canceled || !result.filePath) return null

  // Sem o prefixo `persist:`, a sessão não sobrevive ao processo.
  const partition = `antessala-pdf-${randomUUID()}`
  const win = new electron.BrowserWindow({
    show: false,
    width: 794,
    height: 1123,
    webPreferences: {
      partition,
      offscreen: true,
      javascript: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  let webRequest: WebRequest | undefined

  try {
    webRequest = win.webContents.session.webRequest
    webRequest.onBeforeRequest(
      { urls: [...PDF_BLOCKED_NETWORK_URLS] },
      (_details, callback) => callback({ cancel: true }),
    )

    await win.loadURL(htmlDataUrl(input.html))

    const pdfBuffer = await win.webContents.printToPDF({
      pageSize: 'A4',
      landscape: input.landscape ?? true,
      printBackground: true,
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
    })

    await writeFile(result.filePath, pdfBuffer)
    return { filepath: result.filePath }
  } finally {
    // A sessão é exclusiva desta janela, portanto remover o listener não afeta
    // nenhuma outra parte do app.
    try {
      webRequest?.onBeforeRequest(null)
    } finally {
      if (!win.isDestroyed()) win.destroy()
    }
  }
}
