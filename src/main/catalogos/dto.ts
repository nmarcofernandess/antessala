import type {
  CatalogoCidItem,
  CatalogoMedicamentoItem,
} from '../../shared/catalogos-clinicos'

export interface CatalogoCidRow {
  id: string
  codigo: string
  descricao: string
  capitulo_descricao: string | null
}

export interface CatalogoMedicamentoRow {
  id: string
  nome: string
  principio_ativo: string
  nomes_comerciais: unknown
  classe_terapeutica: string | null
  grupo_risco: string | null
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

export function mapCatalogoCidRow(row: CatalogoCidRow): CatalogoCidItem {
  return {
    id: row.id,
    codigo: row.codigo,
    nome: row.descricao,
    ...(row.capitulo_descricao ? { categoria: row.capitulo_descricao } : {}),
  }
}

export function mapCatalogoMedicamentoRow(
  row: CatalogoMedicamentoRow,
): CatalogoMedicamentoItem {
  return {
    id: row.id,
    nome: row.nome,
    principioAtivo: row.principio_ativo,
    nomesComerciais: stringArray(row.nomes_comerciais),
    ...(row.classe_terapeutica ? { classeTerapeutica: row.classe_terapeutica } : {}),
    ...(row.grupo_risco ? { grupoRisco: row.grupo_risco } : {}),
  }
}
