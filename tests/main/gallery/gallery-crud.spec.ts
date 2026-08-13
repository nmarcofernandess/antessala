import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock: DB layer
// ---------------------------------------------------------------------------
const queryAll = vi.fn()
const queryOne = vi.fn()
const execute = vi.fn()

vi.mock('../../../src/main/db/query', () => ({
  queryAll,
  queryOne,
  execute,
}))

// ---------------------------------------------------------------------------
// Mock: node:fs
// ---------------------------------------------------------------------------
const readFileSync = vi.fn(() => Buffer.from('fake-image'))
const writeFileSync = vi.fn()
const mkdirSync = vi.fn()
const existsSync = vi.fn(() => true)
const statSync = vi.fn(() => ({ size: 1024 }))
const unlinkSync = vi.fn()

vi.mock('node:fs', () => ({
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  statSync,
  unlinkSync,
}))

// ---------------------------------------------------------------------------
// Mock: electron (getPath fallback)
// ---------------------------------------------------------------------------
vi.mock('electron', () => ({
  app: { isPackaged: false },
}))

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------
const {
  galleryUpload,
  galleryListar,
  galleryToggleFavorito,
  galleryAtualizarTags,
  galleryRemover,
} = await import('../../../src/main/gallery/service')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Gallery CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('galleryUpload creates DB record and copies file', async () => {
    execute.mockResolvedValueOnce(undefined)

    const result = await galleryUpload({
      file_path: '/tmp/photo.png',
      mime_type: 'image/png',
      nome: 'photo.png',
    })

    expect(result.id).toBeDefined()
    expect(result.file_path).toContain('.png')
    expect(readFileSync).toHaveBeenCalledWith('/tmp/photo.png')
    expect(writeFileSync).toHaveBeenCalled()
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO gallery_images'),
      expect.any(String),   // id
      expect.any(String),   // file_path
      'photo.png',          // nome
      'upload',             // origem
      'image',              // tipo
      null,                 // conversa_id
      null,                 // source_id
      1024,                 // size_bytes
      'image/png',          // mime
    )
  })

  it('galleryListar returns images from DB', async () => {
    const mockImages = [{ id: '1', nome_original: 'a.png' }]
    queryAll.mockResolvedValueOnce(mockImages)

    const result = await galleryListar()

    expect(result).toEqual(mockImages)
    expect(queryAll).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM gallery_images'),
      50,
      0,
    )
  })

  it('galleryListar filters by origem', async () => {
    queryAll.mockResolvedValueOnce([])

    await galleryListar({ origem: 'chat' })

    expect(queryAll).toHaveBeenCalledWith(
      expect.stringContaining('WHERE'),
      'chat',
      50,
      0,
    )
  })

  it('galleryToggleFavorito toggles correctly', async () => {
    queryOne.mockResolvedValueOnce({ favorito: true })

    const result = await galleryToggleFavorito('abc-123')

    expect(result).toBe(true)
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('SET favorito = NOT favorito'),
      'abc-123',
    )
  })

  it('galleryAtualizarTags sets tags', async () => {
    queryOne.mockResolvedValueOnce({ tags: ['nature', 'sunset'] })

    const result = await galleryAtualizarTags('abc-123', ['nature', 'sunset'])

    expect(result).toEqual(['nature', 'sunset'])
    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('SET tags'),
      ['nature', 'sunset'],
      'abc-123',
    )
  })

  it('galleryRemover deletes record and file', async () => {
    queryOne.mockResolvedValueOnce({ file_path: 'uploads/abc.png' })
    execute.mockResolvedValueOnce(undefined)

    await galleryRemover('abc-123')

    expect(queryOne).toHaveBeenCalledWith(
      expect.stringContaining('SELECT file_path'),
      'abc-123',
    )
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM gallery_images'),
      'abc-123',
    )
    expect(unlinkSync).toHaveBeenCalled()
  })
})
