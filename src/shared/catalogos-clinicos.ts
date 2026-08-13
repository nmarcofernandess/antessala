export interface CatalogoCidItem {
  id: string
  codigo: string
  nome: string
  categoria?: string
}

export interface CatalogoMedicamentoItem {
  id: string
  nome: string
  principioAtivo: string
  nomesComerciais: string[]
  classeTerapeutica?: string
  grupoRisco?: string
}
