import fs from 'fs'
import path from 'path'
import type { ImportedText } from '../../shared/importer-types'
import type { StructuredDocumentImport, StructuredDocumentPage, StructuredDocumentWarning } from '../../shared/structured-document-import'
import { buildStructuredDocument, countWords, markdownToSafeHtml, titleFromFile } from './structured-document-utils'

interface PdfTextItem {
  str?: string
  hasEOL?: boolean
}

interface PdfPageData {
  getTextContent: () => Promise<{ items: PdfTextItem[] }>
}

interface ParsedPdf {
  text: string
  numpages: number
  info?: { Title?: unknown; Author?: unknown }
}

async function renderPdfPage(pageData: PdfPageData): Promise<string> {
  const content = await pageData.getTextContent()
  return content.items
    .map((item) => `${item.str ?? ''}${item.hasEOL ? '\n' : ' '}`)
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export async function importPdfStructured(filePath: string): Promise<StructuredDocumentImport> {
  const pdfParse = (await import('pdf-parse')).default
  const buffer = fs.readFileSync(filePath)
  const extractedPages: string[] = []
  const parseWithPages = pdfParse as unknown as (
    data: Buffer,
    options: { pagerender: (pageData: PdfPageData) => Promise<string> },
  ) => Promise<ParsedPdf>
  const result = await parseWithPages(buffer, {
    pagerender: async (pageData: PdfPageData) => {
      const page = await renderPdfPage(pageData)
      extractedPages.push(page)
      return page
    },
  })
  while (extractedPages.length < result.numpages) extractedPages.push('')

  const pages: StructuredDocumentPage[] = extractedPages.map((text, index) => ({
    number: index + 1,
    text,
    wordCount: countWords(text),
  }))
  const warnings: StructuredDocumentWarning[] = pages
    .filter((page) => !page.text.trim())
    .map((page) => ({
      code: 'OCR_NEEDED',
      message: `A página ${page.number} não contém texto extraível e pode exigir OCR.`,
      page: page.number,
    }))
  if (pages.length > 0 && pages.every((page) => !page.text.trim())) {
    throw new Error('PDF sem camada de texto. OCR necessário antes da importação.')
  }
  const markdown = pages.map((page) => `## Página ${page.number}\n\n${page.text || '_Texto não extraído; OCR necessário._'}`).join('\n\n')

  return buildStructuredDocument({
    filePath,
    format: 'pdf',
    html: markdownToSafeHtml(markdown),
    markdown,
    pages,
    suggestedTitle: typeof result.info?.Title === 'string' && result.info.Title.trim()
      ? result.info.Title.trim()
      : titleFromFile(filePath),
    author: typeof result.info?.Author === 'string' && result.info.Author.trim() ? result.info.Author.trim() : undefined,
    warnings,
  })
}

export async function importPdf(filePath: string): Promise<ImportedText> {
  const result = await importPdfStructured(filePath)

  return {
    text: result.text,
    metadata: {
      fileName: path.basename(filePath),
      charCount: result.text.length,
      format: 'pdf',
      pageCount: result.metadata.pageCount,
      author: result.metadata.author,
    },
  }
}
