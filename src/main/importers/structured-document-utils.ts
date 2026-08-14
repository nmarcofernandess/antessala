import fs from 'node:fs'
import path from 'node:path'
import { generateJSON } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'
import TurndownService from 'turndown'
import type {
  StructuredDocumentFormat,
  StructuredDocumentImport,
  StructuredDocumentPage,
  StructuredDocumentWarning,
  TiptapJsonNode,
} from '../../shared/structured-document-import'

const extensions = [StarterKit, TableKit]
const turndown = new TurndownService({ bulletListMarker: '-', codeBlockStyle: 'fenced' })

const MIME_TYPES: Record<StructuredDocumentFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  markdown: 'text/markdown',
  text: 'text/plain',
  html: 'text/html',
  csv: 'text/csv',
  json: 'application/json',
  jsonl: 'application/x-ndjson',
}

export function sanitizeDocumentHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'blockquote',
      'strong', 'b', 'em', 'i', 's', 'strike', 'code', 'pre',
      'ul', 'ol', 'li', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    allowedAttributes: { a: ['href', 'title'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    disallowedTagsMode: 'discard',
  })
}

export function markdownToSafeHtml(markdown: string): string {
  return sanitizeDocumentHtml(marked.parse(markdown, { async: false }) as string)
}

export function htmlToTiptapJson(html: string): TiptapJsonNode {
  return generateJSON(sanitizeDocumentHtml(html), extensions) as TiptapJsonNode
}

export function htmlToMarkdown(html: string): string {
  return turndown.turndown(sanitizeDocumentHtml(html)).trim()
}

export function tiptapToText(node: TiptapJsonNode): string {
  if (typeof node.text === 'string') return node.text
  if (!node.content?.length) return ''
  const separator = ['doc', 'paragraph', 'heading', 'blockquote', 'listItem', 'bulletList', 'orderedList', 'codeBlock'].includes(node.type)
    ? '\n'
    : ''
  return node.content.map(tiptapToText).filter(Boolean).join(separator).replace(/\n{3,}/g, '\n\n').trim()
}

export function countWords(text: string): number {
  return text.trim() ? (text.trim().match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu) ?? []).length : 0
}

export function titleFromTiptap(tiptapJson: TiptapJsonNode, fallback: string): string {
  const heading = tiptapJson.content?.find((node) => node.type === 'heading')
  const title = heading ? tiptapToText(heading).trim() : ''
  return title.slice(0, 120) || fallback
}

export function titleFromFile(filePath: string): string {
  return path.basename(filePath, path.extname(filePath)).replace(/[-_]+/g, ' ').trim() || 'Documento importado'
}

export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return escaped.split(/\n{2,}/).map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`).join('')
}

export function buildStructuredDocument(input: {
  filePath: string
  format: StructuredDocumentFormat
  html: string
  markdown?: string
  pages?: StructuredDocumentPage[]
  suggestedTitle?: string
  warnings?: StructuredDocumentWarning[]
  author?: string
}): StructuredDocumentImport {
  const safeHtml = sanitizeDocumentHtml(input.html)
  const tiptapJson = htmlToTiptapJson(safeHtml)
  const text = tiptapToText(tiptapJson)
  const stats = fs.statSync(input.filePath)
  const pages = input.pages ?? [{ number: 1, text, wordCount: countWords(text) }]
  const warnings = [...(input.warnings ?? [])]
  if (!text.trim() && !warnings.some((warning) => warning.code === 'EMPTY_DOCUMENT')) {
    warnings.push({ code: 'EMPTY_DOCUMENT', message: 'O documento não contém texto extraível.' })
  }

  return {
    format: input.format,
    tiptapJson,
    markdown: (input.markdown ?? htmlToMarkdown(safeHtml)).trim(),
    text,
    suggestedTitle: input.suggestedTitle?.trim().slice(0, 120) || titleFromTiptap(tiptapJson, titleFromFile(input.filePath)),
    pages,
    wordCount: countWords(text),
    warnings,
    metadata: {
      fileName: path.basename(input.filePath),
      extension: path.extname(input.filePath).toLowerCase(),
      mimeType: MIME_TYPES[input.format],
      byteSize: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      pageCount: pages.length,
      ...(input.author ? { author: input.author } : {}),
      sourcePath: path.resolve(input.filePath),
    },
  }
}
