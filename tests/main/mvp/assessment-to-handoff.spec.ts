import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, initDb } from '../../../src/main/db/pglite'
import { createTables } from '../../../src/main/db/schema'
import {
  acknowledgeDelivery,
  bookCompatibleSlot,
  checkInBooking,
  confirmRequirement,
  createCase,
  finalizeResult,
  getCurrentResult,
  login,
  logout,
  listCompatibleSlots,
  openPendency,
  reviseResult,
  seedMvpData,
  sendResultToRequester,
  startAssessment,
  startNursing,
  saveAndSubmitTriage,
} from '../../../src/main/mvp/service'

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'antessala-assessment-'))

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

describe('MVP assessment, result and handoff', () => {
  it('keeps clinical authority human and delivers a versioned result', async () => {
    await login({ email: 'recepcao@antessala.demo', password: 'demo123' })
    const item = await createCase({
      personName: 'Antônio Reis', sex: 'M', age: 58, procedure: 'Colonoscopia',
      requesterService: 'Gastroenterologia', externalReference: 'GASTRO-77',
    })
    await logout()
    await login({ email: 'enfermagem@antessala.demo', password: 'demo123' })
    await startNursing(item.id)
    await saveAndSubmitTriage(item.id, {
      allergy: { state: 'ANSWERED', value: false, source: 'PATIENT_REPORT' },
    })
    await confirmRequirement(item.id, { decision: 'CONFIRM', reason: null })
    await logout()
    await login({ email: 'recepcao@antessala.demo', password: 'demo123' })
    const [slot] = await listCompatibleSlots(item.id)
    expect(slot).toBeDefined()
    await bookCompatibleSlot(item.id, slot!.id)
    await checkInBooking(item.id)

    await logout()
    await login({ email: 'anestesia@antessala.demo', password: 'demo123' })
    await startAssessment(item.id)
    const pendency = await openPendency(item.id, {
      description: 'Trazer hemograma recente', impact: 'DOES_NOT_BLOCK_CURRENT_RESULT',
      ownerRole: 'SOLICITANTE', requiresReturn: false,
    })
    expect(pendency.status).toBe('OPEN')
    const first = await finalizeResult(item.id, {
      summary: 'Avaliação realizada; orientação humana registrada.',
      conclusion: 'Conclusão demonstrativa registrada pelo anestesiologista.',
    })
    expect(first.version).toBe(1)
    const corrected = await reviseResult(item.id, {
      kind: 'CORRECTION', reason: 'Correção de redação',
      summary: 'Avaliação realizada; orientação revisada.',
      conclusion: 'Conclusão demonstrativa revisada pelo anestesiologista.',
    })
    expect(corrected.version).toBe(2)
    expect((await getCurrentResult(item.id))?.id).toBe(corrected.id)

    await logout()
    await login({ email: 'recepcao@antessala.demo', password: 'demo123' })
    await sendResultToRequester(item.id)
    await logout()
    await login({ email: 'solicitante@antessala.demo', password: 'demo123' })
    const delivery = await acknowledgeDelivery(item.id)
    expect(delivery.status).toBe('ACKNOWLEDGED')
  })
})
