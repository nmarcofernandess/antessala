import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, initDb } from '../../../src/main/db/pglite'
import { createTables } from '../../../src/main/db/schema'
import {
  approveKnowledgeRelation,
  confirmFieldProposal,
  createCase,
  login,
  proposeFieldsFromTranscript,
  searchApprovedKnowledge,
  seedMvpData,
  suggestKnowledgeRelation,
} from '../../../src/main/mvp/service'

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'antessala-ai-memory-'))

beforeAll(async () => {
  process.env.ANTESSALA_DB_PATH = testDir
  await initDb()
  await createTables()
  await seedMvpData()
})

afterAll(async () => {
  await closeDb()
  delete process.env.ANTESSALA_DB_PATH
  fs.rmSync(testDir, { recursive: true, force: true })
})

describe('assistive AI and approved memory', () => {
  it('keeps proposals as drafts and never promotes a case automatically', async () => {
    await login({ email: 'recepcao@antessala.demo', password: 'demo123' })
    const item = await createCase({
      personName: 'Nelson Prado', sex: 'M', age: 62, procedure: 'Endoscopia',
      requesterService: 'Gastroenterologia', externalReference: null,
    })
    await login({ email: 'enfermagem@antessala.demo', password: 'demo123' })
    const proposals = await proposeFieldsFromTranscript(
      item.id,
      'Uso cinco medicamentos e tenho alergia a dipirona.',
      async () => [
        { fieldPath: 'allergy', value: true, evidence: 'alergia a dipirona', explanation: 'Relato explícito' },
        { fieldPath: 'medicationsCount', value: 5, evidence: 'cinco medicamentos', explanation: 'Contagem relatada' },
      ],
    )
    expect(proposals.every((proposal) => proposal.status === 'DRAFT')).toBe(true)
    const accepted = await confirmFieldProposal(proposals[0]!.id, 'ACCEPT')
    expect(accepted.status).toBe('ACCEPTED')

    await login({ email: 'anestesia@antessala.demo', password: 'demo123' })
    const relation = await suggestKnowledgeRelation({
      subject: 'Endoscopia', predicate: 'pode_requerer', object: 'revisão de alergias',
      rationale: 'Relação demonstrativa criada por profissional; não derivada automaticamente do caso.',
    })
    expect(await searchApprovedKnowledge('Endoscopia')).toEqual([])
    await approveKnowledgeRelation(relation.id)
    expect((await searchApprovedKnowledge('Endoscopia'))[0]?.status).toBe('ACTIVE')
  })
})
