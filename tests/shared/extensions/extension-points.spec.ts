import { describe, expect, it } from 'vitest'
import {
  CATALOGO_WIDGETS_ESPECIFICOS,
  CATALOGO_WIDGETS_SPEC_PATH,
  MOTOR_FILA_EXTENSION_POINT,
  MOTOR_FILA_SPEC_PATH,
} from '../../../src/shared/extensions'

describe('Antessala extension points', () => {
  it('leaves the clinical widget and template selection empty for its owner spec', () => {
    expect(CATALOGO_WIDGETS_SPEC_PATH).toBe('hack/specs/02-quais-widgets/')
    expect(CATALOGO_WIDGETS_ESPECIFICOS.widgetTypes).toEqual([])
    expect(CATALOGO_WIDGETS_ESPECIFICOS.templates).toEqual([])
    expect(Object.isFrozen(CATALOGO_WIDGETS_ESPECIFICOS)).toBe(true)
    expect(Object.isFrozen(CATALOGO_WIDGETS_ESPECIFICOS.widgetTypes)).toBe(true)
    expect(Object.isFrozen(CATALOGO_WIDGETS_ESPECIFICOS.templates)).toBe(true)
  })

  it('exposes no executable queue ordering or transition logic', () => {
    expect(MOTOR_FILA_SPEC_PATH).toBe('specs/002-motor-da-fila/')
    expect(Object.keys(MOTOR_FILA_EXTENSION_POINT)).toEqual([])
    expect('ordenarFila' in MOTOR_FILA_EXTENSION_POINT).toBe(false)
    expect('ordenarHub' in MOTOR_FILA_EXTENSION_POINT).toBe(false)
    expect('avancar' in MOTOR_FILA_EXTENSION_POINT).toBe(false)
  })
})
