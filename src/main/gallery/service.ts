import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, unlinkSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { queryAll, queryOne, execute } from '../db/query'
import type { GalleryImage } from '@shared/types'

const require = createRequire(import.meta.url)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGalleryBaseDir(): string {
  try {
    const electron = require('electron') as { app?: { isPackaged?: boolean; getPath?: (name: string) => string } }
    if (electron.app?.isPackaged && electron.app.getPath) {
      return path.join(electron.app.getPath('userData'), 'flowkit-gallery')
    }
  } catch { /* dev fallback */ }
  return path.join(process.cwd(), 'data', 'flowkit-gallery')
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/svg+xml': '.svg',
    'application/pdf': '.pdf',
  }
  return map[mime] || '.bin'
}

// ---------------------------------------------------------------------------
// galleryListar
// ---------------------------------------------------------------------------

export interface GalleryListarOpts {
  origem?: string
  favorito?: boolean
  tags?: string[]
  busca?: string
  limite?: number
  offset?: number
}

export async function galleryListar(opts: GalleryListarOpts = {}): Promise<GalleryImage[]> {
  const clauses: string[] = []
  const params: unknown[] = []
  let idx = 0

  if (opts.origem) {
    clauses.push(`origem = $${++idx}`)
    params.push(opts.origem)
  }

  if (opts.favorito !== undefined) {
    clauses.push(`favorito = $${++idx}`)
    params.push(opts.favorito)
  }

  if (opts.tags && opts.tags.length > 0) {
    clauses.push(`tags && $${++idx}`)
    params.push(opts.tags)
  }

  if (opts.busca) {
    clauses.push(`nome_original ILIKE $${++idx}`)
    params.push(`%${opts.busca}%`)
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
  const limite = opts.limite ?? 50
  const offset = opts.offset ?? 0

  return queryAll<GalleryImage>(
    `SELECT * FROM gallery_images ${where} ORDER BY criada_em DESC LIMIT $${++idx} OFFSET $${++idx}`,
    ...params,
    limite,
    offset,
  )
}

// ---------------------------------------------------------------------------
// galleryUpload
// ---------------------------------------------------------------------------

export interface GalleryUploadInput {
  file_path?: string
  data_base64?: string
  mime_type?: string
  nome: string
  origem?: string
  conversa_id?: string
  source_id?: number
}

export async function galleryUpload(input: GalleryUploadInput): Promise<{ id: string; file_path: string }> {
  const id = randomUUID()
  const origem = input.origem ?? 'upload'

  // Determine subdir
  let subdir: string
  if (origem === 'chat' && input.conversa_id) {
    subdir = path.join('chat', input.conversa_id)
  } else if (origem === 'extracted' && input.source_id != null) {
    subdir = path.join('extracted', String(input.source_id))
  } else {
    subdir = 'uploads'
  }

  // Resolve file data
  let buffer: Buffer
  let mime: string
  if (input.data_base64) {
    buffer = Buffer.from(input.data_base64, 'base64')
    mime = input.mime_type ?? 'application/octet-stream'
  } else if (input.file_path) {
    buffer = readFileSync(input.file_path)
    mime = input.mime_type ?? 'application/octet-stream'
  } else {
    throw new Error('Either file_path or data_base64 must be provided')
  }

  const ext = mimeToExt(mime)
  const relPath = path.join(subdir, `${id}${ext}`)
  const absPath = path.join(getGalleryBaseDir(), relPath)
  const dir = path.dirname(absPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(absPath, buffer)

  const stats = statSync(absPath)

  await execute(
    `INSERT INTO gallery_images (id, file_path, nome_original, origem, tipo, conversa_id, source_id, size_bytes, mime_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    id,
    relPath,
    input.nome,
    origem,
    'image',
    input.conversa_id ?? null,
    input.source_id ?? null,
    stats.size,
    mime,
  )

  return { id, file_path: relPath }
}

// ---------------------------------------------------------------------------
// galleryRemover
// ---------------------------------------------------------------------------

export async function galleryRemover(id: string): Promise<void> {
  const row = await queryOne<{ file_path: string }>('SELECT file_path FROM gallery_images WHERE id = $1', id)
  if (!row) throw new Error(`Gallery image not found: ${id}`)

  await execute('DELETE FROM gallery_images WHERE id = $1', id)

  const absPath = path.join(getGalleryBaseDir(), row.file_path)
  if (existsSync(absPath)) unlinkSync(absPath)
}

// ---------------------------------------------------------------------------
// galleryToggleFavorito
// ---------------------------------------------------------------------------

export async function galleryToggleFavorito(id: string): Promise<boolean> {
  const row = await queryOne<{ favorito: boolean }>(
    'UPDATE gallery_images SET favorito = NOT favorito, atualizada_em = NOW() WHERE id = $1 RETURNING favorito',
    id,
  )
  if (!row) throw new Error(`Gallery image not found: ${id}`)
  return row.favorito
}

// ---------------------------------------------------------------------------
// galleryAtualizarTags
// ---------------------------------------------------------------------------

export async function galleryAtualizarTags(id: string, tags: string[]): Promise<string[]> {
  const row = await queryOne<{ tags: string[] }>(
    'UPDATE gallery_images SET tags = $1, atualizada_em = NOW() WHERE id = $2 RETURNING tags',
    tags, id,
  )
  if (!row) throw new Error(`Gallery image not found: ${id}`)
  return row.tags
}

// ---------------------------------------------------------------------------
// galleryLerArquivo
// ---------------------------------------------------------------------------

export async function galleryLerArquivo(relativePath: string): Promise<Buffer> {
  const absPath = path.join(getGalleryBaseDir(), relativePath)
  return readFile(absPath)
}
