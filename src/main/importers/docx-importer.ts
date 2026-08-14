import mammoth from 'mammoth'
import type { StructuredDocumentImport, StructuredDocumentWarning } from '../../shared/structured-document-import'
import { buildStructuredDocument, htmlToMarkdown, sanitizeDocumentHtml } from './structured-document-utils'

export async function importDocxStructured(filePath: string): Promise<StructuredDocumentImport> {
  const result = await mammoth.convertToHtml({ path: filePath })
  const safeHtml = sanitizeDocumentHtml(result.value)
  const warnings: StructuredDocumentWarning[] = result.messages.map((message) => ({
    code: 'DOCX_CONVERSION_WARNING',
    message: message.message,
  }))
  return buildStructuredDocument({
    filePath,
    format: 'docx',
    html: safeHtml,
    markdown: htmlToMarkdown(safeHtml),
    warnings,
  })
}
