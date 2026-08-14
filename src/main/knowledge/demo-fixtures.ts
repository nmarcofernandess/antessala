import { queryOne } from '../db/query'
import { ingestKnowledge } from './ingest'
import { enrichAllChunksWithModel, type EnrichmentModel } from './enrichment'

type DemoFixture = {
  id: string
  titulo: string
  contexto: string
  sourceUrl: string
  conteudo: string
  resumo: string
  tags: string[]
  entidades: Array<{ nome: string; tipo: string }>
  relacoes: Array<{ from: string; to: string; tipo_relacao: string; peso: number }>
}

export const KNOWLEDGE_DEMO_FIXTURES: DemoFixture[] = [
  {
    id: 'seguranca-cirurgica-brasil-v1',
    titulo: 'Cirurgia segura: três momentos de verificação',
    contexto: 'Use para dúvidas educativas sobre as pausas de segurança antes da indução, da incisão e da saída da sala.',
    sourceUrl: 'https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/servicosdesaude/publicacoes/protocolo-de-cirurgia-segura',
    conteudo: `FIXTURE EDUCACIONAL SINTÉTICA — não substitui protocolo institucional nem decisão clínica.

Uma lista de verificação de cirurgia segura organiza confirmações em três momentos. Antes da indução anestésica, a equipe confirma identidade, local, procedimento e consentimento, além de alergias conhecidas, risco de via aérea difícil e risco de perda sanguínea. Antes da incisão, os integrantes se apresentam, reconfirmam paciente, procedimento e local e compartilham pontos críticos. Antes da saída da sala, a equipe confirma o procedimento realizado, a contagem de instrumentos e compressas, a identificação de amostras e os pontos relevantes para recuperação.

Fonte de referência: ANVISA, Protocolo para Cirurgia Segura. Conteúdo desta fixture é resumo autoral e não reproduz o documento integral.`,
    resumo: 'A lista de cirurgia segura estrutura confirmações da equipe em três pausas perioperatórias.',
    tags: ['cirurgia segura', 'checklist', 'sign in', 'time out', 'sign out', 'segurança perioperatória'],
    entidades: [
      { nome: 'Lista de cirurgia segura', tipo: 'documento' },
      { nome: 'Antes da indução', tipo: 'etapa' },
      { nome: 'Antes da incisão', tipo: 'etapa' },
      { nome: 'Antes da saída', tipo: 'etapa' },
      { nome: 'Equipe perioperatória', tipo: 'funcao' },
    ],
    relacoes: [
      { from: 'Lista de cirurgia segura', to: 'Antes da indução', tipo_relacao: 'possui_etapa', peso: 1 },
      { from: 'Lista de cirurgia segura', to: 'Antes da incisão', tipo_relacao: 'possui_etapa', peso: 1 },
      { from: 'Lista de cirurgia segura', to: 'Antes da saída', tipo_relacao: 'possui_etapa', peso: 1 },
      { from: 'Equipe perioperatória', to: 'Lista de cirurgia segura', tipo_relacao: 'executa', peso: 1 },
    ],
  },
  {
    id: 'responsabilidades-pre-anestesicas-v1',
    titulo: 'Responsabilidades na avaliação pré-anestésica',
    contexto: 'Use para explicar limites do Antessala, autoria clínica e responsabilidade humana na avaliação pré-anestésica.',
    sourceUrl: 'https://sistemas.cfm.org.br/normas/arquivos/resolucoes/BR/2017/2174_2017.pdf',
    conteudo: `FIXTURE EDUCACIONAL SINTÉTICA — consulte a norma vigente e o protocolo institucional.

A avaliação pré-anestésica reúne história, exame e informações disponíveis para subsidiar o planejamento anestésico. A decisão de realizar o ato anestésico e sua documentação pertencem ao médico anestesiologista. O Antessala organiza dados e pode recuperar conhecimento, mas não atribui classificação ASA, não declara aptidão anestésica e não substitui julgamento humano. Ausência de informação deve permanecer ausência, nunca ser convertida automaticamente em negativa.

Fonte de referência: Conselho Federal de Medicina, Resolução CFM nº 2.174/2017. Conteúdo desta fixture é paráfrase autoral.`,
    resumo: 'A avaliação pré-anestésica subsidia uma decisão documentada cuja responsabilidade permanece humana.',
    tags: ['avaliação pré-anestésica', 'anestesiologista', 'responsabilidade', 'ASA', 'decisão humana', 'registro'],
    entidades: [
      { nome: 'Avaliação pré-anestésica', tipo: 'processo' },
      { nome: 'Anestesiologista', tipo: 'funcao' },
      { nome: 'Decisão humana', tipo: 'conceito' },
      { nome: 'Classificação ASA', tipo: 'conceito' },
      { nome: 'Antessala', tipo: 'sistema' },
    ],
    relacoes: [
      { from: 'Anestesiologista', to: 'Avaliação pré-anestésica', tipo_relacao: 'realiza', peso: 1 },
      { from: 'Avaliação pré-anestésica', to: 'Decisão humana', tipo_relacao: 'subsidia', peso: 1 },
      { from: 'Antessala', to: 'Decisão humana', tipo_relacao: 'nao_substitui', peso: 1 },
      { from: 'Antessala', to: 'Classificação ASA', tipo_relacao: 'nao_atribui', peso: 1 },
    ],
  },
  {
    id: 'implantacao-checklist-v1',
    titulo: 'Como implantar um checklist com a equipe',
    contexto: 'Use para dúvidas educativas sobre liderança, treinamento, feedback e adaptação local de listas de segurança.',
    sourceUrl: 'https://www.who.int/publications/i/item/9789241598590',
    conteudo: `FIXTURE EDUCACIONAL SINTÉTICA — resumo autoral para demonstração.

A implantação de uma lista de segurança depende de apoio da liderança, participação multidisciplinar e uma pessoa responsável por conduzir a mudança local. Treinamento e prática ajudam a equipe a transformar itens escritos em confirmação verbal compartilhada. A adaptação local deve preservar a intenção dos itens essenciais. Feedback sobre o uso permite identificar fricções, corrigir o processo e sustentar a adoção.

Fonte de referência: World Health Organization, Implementation Manual WHO Surgical Safety Checklist 2009. Esta fixture não contém texto integral nem marcas da OMS.`,
    resumo: 'Uma implantação sustentável combina liderança, treinamento, participação da equipe, adaptação local e feedback.',
    tags: ['implementação', 'checklist', 'liderança', 'treinamento', 'feedback', 'adaptação local'],
    entidades: [
      { nome: 'Implementação do checklist', tipo: 'processo' },
      { nome: 'Lista de cirurgia segura', tipo: 'documento' },
      { nome: 'Liderança', tipo: 'conceito' },
      { nome: 'Treinamento', tipo: 'processo' },
      { nome: 'Feedback', tipo: 'processo' },
      { nome: 'Equipe perioperatória', tipo: 'funcao' },
    ],
    relacoes: [
      { from: 'Implementação do checklist', to: 'Lista de cirurgia segura', tipo_relacao: 'implementa', peso: 1 },
      { from: 'Implementação do checklist', to: 'Liderança', tipo_relacao: 'requer', peso: 1 },
      { from: 'Implementação do checklist', to: 'Treinamento', tipo_relacao: 'requer', peso: 1 },
      { from: 'Implementação do checklist', to: 'Feedback', tipo_relacao: 'usa', peso: 1 },
      { from: 'Equipe perioperatória', to: 'Implementação do checklist', tipo_relacao: 'participa_de', peso: 1 },
    ],
  },
]

function fixtureForPrompt(prompt: string): DemoFixture {
  return KNOWLEDGE_DEMO_FIXTURES.find((fixture) => prompt.includes(`SOURCE: "${fixture.titulo}"`))
    ?? KNOWLEDGE_DEMO_FIXTURES[0]
}

export const demoFixtureEnrichmentModel: EnrichmentModel = {
  provider: 'fixture',
  modelo: 'curated-demo-v1',
  async generate(prompt) {
    const fixture = fixtureForPrompt(prompt)
    const chunkCount = Math.max(1, (prompt.match(/=== CHUNK \d+/g) ?? []).length)
    return {
      chunks: Array.from({ length: chunkCount }, (_, index) => ({
        index,
        resumo: fixture.resumo,
        tags: fixture.tags,
        entidades: fixture.entidades,
        relacoes: fixture.relacoes,
      })),
    }
  },
}

export async function seedKnowledgeDemo() {
  const sourceIds: number[] = []
  let imported = 0

  for (const fixture of KNOWLEDGE_DEMO_FIXTURES) {
    const existing = await queryOne<{ id: number }>(
      `SELECT id FROM knowledge_sources WHERE metadata->>'demo_fixture_id' = $1 LIMIT 1`,
      fixture.id,
    )
    let sourceId = existing?.id
    if (!sourceId) {
      const result = await ingestKnowledge(fixture.titulo, fixture.conteudo, 'high', {
        tipo: 'importacao_usuario',
        context_hint: fixture.contexto,
        demo_fixture_id: fixture.id,
        source_url: fixture.sourceUrl,
        synthetic_fixture: true,
        retrieved_at: '2026-08-14',
      })
      sourceId = result.source_id
      imported++
    }
    sourceIds.push(sourceId)
    await enrichAllChunksWithModel(demoFixtureEnrichmentModel, { sourceId })
  }

  return {
    imported,
    sources_count: sourceIds.length,
    source_ids: sourceIds,
    fixture_version: 'curated-demo-v1',
  }
}
