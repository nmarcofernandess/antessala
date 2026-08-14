import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, initDb } from '../../../src/main/db/pglite'
import { createTables } from '../../../src/main/db/schema'
import {
  bookCompatibleSlot,
  confirmRequirement,
  createCase,
  getCurrentSession,
  listCasesForCurrentRole,
  listCompatibleSlots,
  login,
  logout,
  saveAndSubmitTriage,
  seedMvpData,
  startNursing,
} from '../../../src/main/mvp/service'

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'antessala-mvp-'))

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

describe('MVP flow from referral to booking', () => {
  it('enforces the current role and completes the first vertical slice', async () => {
    const reception = await login({ email: 'recepcao@antessala.demo', password: 'demo123' })
    expect(reception.role).toBe('RECEPCAO')
    expect(getCurrentSession()?.userId).toBe(reception.userId)

    const created = await createCase({
      personName: 'Marina Lopes',
      sex: 'F',
      age: 71,
      procedure: 'Endoscopia digestiva',
      requesterService: 'Gastroenterologia',
      externalReference: 'GASTRO-42',
    })
    expect(created.status).toBe('WAITING_NURSING')

    await logout()
    await login({ email: 'enfermagem@antessala.demo', password: 'demo123' })
    await startNursing(created.id)
    const calculated = await saveAndSubmitTriage(created.id, {
      allergy: { state: 'ANSWERED', value: false, source: 'PATIENT_REPORT' },
      cardiovascular: { state: 'ANSWERED', value: true, source: 'PATIENT_REPORT' },
      medicationsCount: { state: 'ANSWERED', value: 6, source: 'PATIENT_REPORT' },
      accommodations: { state: 'ANSWERED', value: false, source: 'PROFESSIONAL_OBSERVATION' },
    })
    expect(calculated.slotClass).toBe('STANDARD')
    await confirmRequirement(created.id, { decision: 'CONFIRM', reason: null })

    await logout()
    await login({ email: 'recepcao@antessala.demo', password: 'demo123' })
    const ready = await listCasesForCurrentRole()
    expect(ready.some((item) => item.id === created.id && item.status === 'READY_FOR_SCHEDULING')).toBe(true)
    const slots = await listCompatibleSlots(created.id)
    expect(slots.length).toBeGreaterThan(0)
    expect(slots.every((slot) => slot.slotClass === 'STANDARD')).toBe(true)
    const booking = await bookCompatibleSlot(created.id, slots[0]!.id)
    expect(booking.status).toBe('CONFIRMED')
  })

  it('does not expose the reception worklist to nursing', async () => {
    await logout()
    await login({ email: 'enfermagem@antessala.demo', password: 'demo123' })
    const cases = await listCasesForCurrentRole()
    expect(cases.every((item) => ['WAITING_NURSING', 'NURSING_IN_PROGRESS', 'TRIAGE_PENDING'].includes(item.status))).toBe(true)
  })
})
