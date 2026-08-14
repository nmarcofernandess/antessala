import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const corpusDir = path.resolve(process.cwd(), 'src/data/knowledge-corpus')
const manifest = JSON.parse(fs.readFileSync(path.join(corpusDir, 'manifest.json'), 'utf8')) as {
  documents: Array<{
    file: string
    title: string
    source_revision?: string
    source_pages?: string
    word_count?: number
    content_sha256?: string
    relations: Array<{
      evidence?: { source_revision?: string; section?: string; source_pages?: string }
    }>
  }>
}

const expectedTitles = [
  'Cirurgia segura: três pausas que organizam a equipe',
  'Lista de Verificação de Segurança Cirúrgica da OMS',
  'Como implantar um checklist cirúrgico sem virar burocracia',
  'Diretrizes para cirurgia segura e cuidado perioperatório',
  'Responsabilidades antes, durante e depois da anestesia',
  'Identificação correta do paciente',
  'Segurança na prescrição, uso e administração de medicamentos',
  'Prevenção de quedas em serviços de saúde',
  'Prevenção de lesão por pressão',
  'Higiene das mãos em serviços de saúde',
]

function words(content: string): number {
  return content.trim().split(/\s+/u).filter(Boolean).length
}

describe('bundled knowledge corpus contract', () => {
  it('contains exactly the ten planned official documents in stable order', () => {
    expect(manifest.documents).toHaveLength(10)
    expect(manifest.documents.map((document) => document.title)).toEqual(expectedTitles)
    expect(new Set(manifest.documents.map((document) => document.file)).size).toBe(10)
  })

  it.each(manifest.documents)('$file is a substantial, structured and checksummed multipage document', (document) => {
    const content = fs.readFileSync(path.join(corpusDir, document.file), 'utf8').trim()
    const headings = [...content.matchAll(/^##\s+(.+)$/gmu)].map((match) => match[1].trim())
    const pageEvidence = [...content.matchAll(/<!-- source-pages: ([^>]+) -->/gmu)]
    const hash = createHash('sha256').update(`${content}\n`, 'utf8').digest('hex')

    expect(content.startsWith(`# ${document.title}\n`)).toBe(true)
    expect(words(content)).toBeGreaterThanOrEqual(800)
    expect(headings.length).toBeGreaterThanOrEqual(8)
    expect(pageEvidence.length).toBeGreaterThanOrEqual(2)
    expect(document.source_revision).toMatch(/\S/)
    expect(document.source_pages).toMatch(/\d/)
    expect(document.word_count).toBe(words(content))
    expect(document.content_sha256).toBe(hash)

    for (const relation of document.relations) {
      expect(relation.evidence?.source_revision).toBe(document.source_revision)
      expect(relation.evidence?.source_pages).toMatch(/\d/)
      expect(headings).toContain(relation.evidence?.section)
    }
  })
})
