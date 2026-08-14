export type StructuredDocumentFormat =
  | 'pdf'
  | 'docx'
  | 'markdown'
  | 'text'
  | 'html'
  | 'csv'
  | 'json'
  | 'jsonl'

export interface TiptapJsonNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TiptapJsonNode[]
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
  text?: string
}

export interface StructuredDocumentPage {
  number: number
  text: string
  wordCount: number
}

export type StructuredDocumentWarningCode =
  | 'OCR_NEEDED'
  | 'DOCX_CONVERSION_WARNING'
  | 'EMPTY_DOCUMENT'

export interface StructuredDocumentWarning {
  code: StructuredDocumentWarningCode
  message: string
  page?: number
}

export interface StructuredDocumentImport {
  format: StructuredDocumentFormat
  tiptapJson: TiptapJsonNode
  markdown: string
  text: string
  suggestedTitle: string
  pages: StructuredDocumentPage[]
  wordCount: number
  warnings: StructuredDocumentWarning[]
  metadata: {
    fileName: string
    extension: string
    mimeType: string
    byteSize: number
    modifiedAt: string
    pageCount: number
    author?: string
    sourcePath: string
  }
}
