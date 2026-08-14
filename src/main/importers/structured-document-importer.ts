import fs from 'node:fs'
import path from 'node:path'
import type { StructuredDocumentFormat, StructuredDocumentImport } from '../../shared/structured-document-import'
import { importDocxStructured } from './docx-importer'
import { importPdfStructured } from './pdf-importer'
import {
  buildStructuredDocument,
  htmlToMarkdown,
  markdownToSafeHtml,
  sanitizeDocumentHtml,
  textToHtml,
  titleFromFile,
} from './structured-document-utils'

const FORMAT_BY_EXTENSION: Record<string, StructuredDocumentFormat> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.txt': 'text',
  '.html': 'html',
  '.htm': 'html',
  '.csv': 'csv',
  '.json': 'json',
  '.jsonl': 'jsonl',
}

const EXPLICITLY_UNSUPPORTED = new Set(['.doc', '.odt', '.rtf'])

export function detectStructuredFormat(filePath: string): StructuredDocumentFormat | 'unsupported' | 'unknown' {
  const extension = path.extname(filePath).toLowerCase()
  if (EXPLICITLY_UNSUPPORTED.has(extension)) return 'unsupported'
  return FORMAT_BY_EXTENSION[extension] ?? 'unknown'
}

function unsupportedMessage(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase() || 'sem extensão'
  return `Formato ${extension} não suportado. Converta o arquivo para PDF, DOCX, HTML, Markdown ou TXT.`
}

function normalizeJson(content: string, format: 'json' | 'jsonl'): string {
  if (format === 'json') return JSON.stringify(JSON.parse(content), null, 2)
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.stringify(JSON.parse(line), null, 2))
    .join('\n')
}

export async function importStructuredDocument(filePath: string): Promise<StructuredDocumentImport> {
  const format = detectStructuredFormat(filePath)
  if (format === 'unsupported' || format === 'unknown') throw new Error(unsupportedMessage(filePath))
  if (format === 'pdf') return importPdfStructured(filePath)
  if (format === 'docx') return importDocxStructured(filePath)

  const raw = fs.readFileSync(filePath, 'utf8')
  if (format === 'markdown') {
    return buildStructuredDocument({ filePath, format, html: markdownToSafeHtml(raw), markdown: raw })
  }
  if (format === 'html') {
    const safeHtml = sanitizeDocumentHtml(raw)
    return buildStructuredDocument({ filePath, format, html: safeHtml, markdown: htmlToMarkdown(safeHtml) })
  }

  const text = format === 'json' || format === 'jsonl' ? normalizeJson(raw, format) : raw
  return buildStructuredDocument({
    filePath,
    format,
    html: textToHtml(text),
    markdown: text,
    suggestedTitle: titleFromFile(filePath),
  })
}
