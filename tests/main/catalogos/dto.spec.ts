import { describe, expect, it } from 'vitest'
import {
  mapCatalogoCidRow,
  mapCatalogoMedicamentoRow,
} from '../../../src/main/catalogos/dto'

describe('DTOs dos catálogos clínicos', () => {
  it('expõe CID no contrato camelCase consumido pela anamnese', () => {
    expect(mapCatalogoCidRow({
      id: 'SUBCATEGORIA:J45',
      codigo: 'J45',
      descricao: 'Asma',
      capitulo_descricao: 'Doenças do aparelho respiratório',
    })).toEqual({
      id: 'SUBCATEGORIA:J45',
      codigo: 'J45',
      nome: 'Asma',
      categoria: 'Doenças do aparelho respiratório',
    })
  })

  it('normaliza medicamento e JSONB para o contrato do widget', () => {
    expect(mapCatalogoMedicamentoRow({
      id: 'metformina',
      nome: 'Metformina',
      principio_ativo: 'Cloridrato de metformina',
      nomes_comerciais: '["Glifage","Glifage XR"]',
      classe_terapeutica: 'Antidiabéticos',
      grupo_risco: 'Antidiabético',
    })).toEqual({
      id: 'metformina',
      nome: 'Metformina',
      principioAtivo: 'Cloridrato de metformina',
      nomesComerciais: ['Glifage', 'Glifage XR'],
      classeTerapeutica: 'Antidiabéticos',
      grupoRisco: 'Antidiabético',
    })
  })

  it('não deixa JSONB inválido escapar como shape arbitrário', () => {
    const item = mapCatalogoMedicamentoRow({
      id: 'x',
      nome: 'X',
      principio_ativo: 'X',
      nomes_comerciais: '{inválido',
      classe_terapeutica: null,
      grupo_risco: null,
    })

    expect(item.nomesComerciais).toEqual([])
    expect(item).not.toHaveProperty('classeTerapeutica')
  })
})
