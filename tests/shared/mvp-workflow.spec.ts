import { describe, expect, it } from 'vitest'
import {
  calculateDemoRequirement,
  createDemoCase,
  transitionCase,
  type SemanticAnswer,
} from '../../src/shared/mvp/workflow'

describe('Antessala pitch-critical workflow', () => {
  it('creates autonomous cases even when the person and referral are repeated', () => {
    const first = createDemoCase({
      personName: 'Marina Lopes',
      sex: 'F',
      age: 71,
      procedure: 'Endoscopia digestiva',
      requesterService: 'Gastroenterologia',
      externalReference: 'GASTRO-42',
    })
    const second = createDemoCase({
      personName: 'Marina Lopes',
      sex: 'F',
      age: 71,
      procedure: 'Endoscopia digestiva',
      requesterService: 'Gastroenterologia',
      externalReference: 'GASTRO-42',
    })

    expect(second.id).not.toBe(first.id)
    expect(second.status).toBe('WAITING_NURSING')
  })

  it('keeps explicit false separate from missing answers and explains duration', () => {
    const answers: Record<string, SemanticAnswer> = {
      allergy: { state: 'ANSWERED', value: false, source: 'PATIENT_REPORT' },
      cardiovascular: { state: 'ANSWERED', value: true, source: 'PATIENT_REPORT' },
      respiratory: { state: 'UNKNOWN', source: 'PATIENT_REPORT' },
      medicationsCount: { state: 'ANSWERED', value: 6, source: 'PATIENT_REPORT' },
      accommodations: { state: 'ANSWERED', value: false, source: 'PROFESSIONAL_OBSERVATION' },
    }

    const result = calculateDemoRequirement(answers)

    expect(result.minutes).toBe(30)
    expect(result.slotClass).toBe('STANDARD')
    expect(result.signals).toEqual([
      expect.objectContaining({ code: 'CARDIOVASCULAR_REVIEW', minutes: 5 }),
      expect.objectContaining({ code: 'MEDICATION_VOLUME', minutes: 5 }),
    ])
    expect(result.explanation).not.toContain('alergia')
    expect(result.explanation).not.toContain('respiratório')
  })

  it('rejects impossible lifecycle jumps', () => {
    expect(() => transitionCase('WAITING_NURSING', 'SCHEDULED')).toThrow('Transição inválida')
    expect(transitionCase('WAITING_NURSING', 'NURSING_IN_PROGRESS')).toBe(
      'NURSING_IN_PROGRESS',
    )
  })
})
