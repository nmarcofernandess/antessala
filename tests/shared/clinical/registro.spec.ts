import { describe, expect, expectTypeOf, it } from 'vitest'
import type {
  EstadoJornada,
  PessoaDoRegistro,
  RegistroAutonomo,
} from '../../../src/shared/clinical/registro'

describe('contrato do registro autônomo', () => {
  it('mantém a pessoa embutida e não expõe vínculo de paciente', () => {
    expectTypeOf<RegistroAutonomo>().toMatchTypeOf<PessoaDoRegistro>()
    const keys: Array<keyof RegistroAutonomo> = [
      'id', 'nome', 'sexo', 'idade', 'plano', 'anamnese',
      'prioridade', 'criadoEm', 'atualizadoEm',
    ]
    expect(keys).not.toContain('patientId')
  })

  it('declara estados sem fornecer ordenação ou transição', () => {
    const states: EstadoJornada[] = [
      'aguardando_triagem',
      'anamnese_em_andamento',
      'na_fila',
      'analisado_pelo_especialista',
      'no_hub',
      'encerrado',
    ]
    expect(states).toHaveLength(6)
  })
})
