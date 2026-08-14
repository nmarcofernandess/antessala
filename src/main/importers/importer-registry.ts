import fs from 'fs'
import path from 'path'
import type { DetectedFormat, ImportResult } from '../../shared/importer-types'
import { importChatGptFromString } from './chatgpt-importer'
import { importClaudeFromString } from './claude-importer'
import { importZip } from './zip-importer'
import { detectStructuredFormat, importStructuredDocument } from './structured-document-importer'

/**
 * Sniff the first N chars of a JSON string to decide if it's ChatGPT or Claude format.
 */
export function detectJsonFormat(sample: string): 'chatgpt' | 'claude' | 'unknown' {
  if (sample.includes('"mapping"')) return 'chatgpt'
  if (sample.includes('"chat_messages"')) return 'claude'
  return 'unknown'
}

export function detectFormat(filePath: string): DetectedFormat {
  const ext = path.extname(filePath).toLowerCase()

  if (ext === '.pdf') return 'pdf'
  if (ext === '.zip') return 'zip'

  if (ext === '.json') {
    const sample = fs.readFileSync(filePath, 'utf-8').substring(0, 1000)
    const jsonFormat = detectJsonFormat(sample)
    if (jsonFormat !== 'unknown') return jsonFormat
    return 'text' // JSON but unknown format — treat as text
  }

  const structuredFormat = detectStructuredFormat(filePath)
  return structuredFormat === 'unsupported' || structuredFormat === 'unknown' ? 'unknown' : 'text'
}

export async function importFile(filePath: string): Promise<ImportResult> {
  const format = detectFormat(filePath)

  try {
    switch (format) {
      case 'text':
      case 'pdf': {
        const document = await importStructuredDocument(filePath)
        const bridgeText = ['markdown', 'html', 'docx'].includes(document.format)
          ? document.markdown
          : document.text
        return {
          type: 'text',
          data: {
            text: bridgeText,
            metadata: {
              fileName: document.metadata.fileName,
              charCount: bridgeText.length,
              format: document.format === 'pdf' ? 'pdf' : 'text',
              pageCount: document.metadata.pageCount,
              author: document.metadata.author,
            },
          },
        }
      }
      case 'chatgpt': {
        const content = fs.readFileSync(filePath, 'utf-8')
        return { type: 'conversations', data: importChatGptFromString(content, path.basename(filePath)) }
      }
      case 'claude': {
        const content = fs.readFileSync(filePath, 'utf-8')
        return { type: 'conversations', data: importClaudeFromString(content, path.basename(filePath)) }
      }
      case 'zip':
        return await importZip(filePath)
      default:
        return { type: 'error', error: `Falha ao importar: Formato não suportado. Converta o arquivo para PDF, DOCX, HTML, Markdown ou TXT.` }
    }
  } catch (err) {
    return { type: 'error', error: `Falha ao importar: ${(err as Error).message}` }
  }
}
