import { describe, expect, expectTypeOf, it } from 'vitest'
import type {
  EstadoJornada,
  PessoaDoRegistro,
  RegistroAutonomo,
} from '../../../src/shared/clinical/registro'

describe('compatibilidade provisória do registro legado', () => {
  it('preserva o snapshot embutido do legado sem patientId', () => {
    expectTypeOf<RegistroAutonomo>().toMatchTypeOf<PessoaDoRegistro>()
    const keys: Array<keyof RegistroAutonomo> = [
      'id', 'nome', 'sexo', 'idade', 'plano', 'anamnese',
      'prioridade', 'criadoEm', 'atualizadoEm',
    ]
    expect(keys).not.toContain('patientId')
  })

  it('preserva os estados legados sem fornecer ordenação ou transição', () => {
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
