// =============================================================================
// TOOL FAMILIES — internal tools collapsed into 3 families LLM-facing
//
// O LLM vê apenas 3 tools. O roteamento interno traduz cada chamada
// para a tool interna correta + argumentos transformados.
// =============================================================================

import { z } from 'zod'

// ==================== SCHEMAS ====================

export const ConsultarContextoSchema = z.object({
  entidade: z.enum([
    'conhecimento', 'grafo', 'fontes', 'status', 'galeria',
  ]).describe('Tipo de consulta. "conhecimento" busca na base RAG, "grafo" explora relações, "fontes" lista fontes, "status" retorna stats do sistema, "galeria" lista imagens.'),
  filtros: z.record(z.string(), z.any()).optional().describe('Filtros adicionais (ex: {"consulta": "minha busca"}).'),
})

export const EditarFichaSchema = z.object({
  entidade: z.enum([
    'memoria', 'fonte', 'documento',
  ]).describe('Tipo de entidade a editar. Use "memoria" para salvar ou remover memorias. Use "documento" para salvar conhecimento.'),
  id: z.number().int().positive().optional().describe('ID do registro. Omitir para criar novo.'),
  operacao: z.enum(['criar', 'atualizar', 'deletar']).default('criar').describe('Tipo de operacao.'),
  dados: z.record(z.string(), z.any()).optional().describe('Campos a criar/atualizar.'),
})

export const ExecutarAcaoSchema = z.object({
  acao: z.enum([
    'backup',
    'terminal_exec',
  ]).describe('Acao a executar.'),
  args: z.record(z.string(), z.any()).describe('Argumentos da acao. Variam por tipo.'),
})

export const SalvarMemoriaSchema = z.object({
  conteudo: z.string().min(1).describe('Fato curto a memorizar.'),
  id: z.number().int().positive().optional().describe('ID da memoria a atualizar. Omitir para criar nova.'),
})

export const RemoverMemoriaSchema = z.object({
  id: z.number().int().positive().describe('ID da memoria a remover.'),
})

// ==================== ROUTING MAPS ====================

const ACAO_TO_TOOL: Record<string, string> = {
  backup: 'fazer_backup',
  terminal_exec: 'terminal_exec',
}

// ==================== ROUTING ====================

export interface FamilyRoute {
  internalTool: string
  internalArgs: Record<string, any>
}

export function routeFamilyTool(familyName: string, args: Record<string, any>): FamilyRoute {
  // --- consultar_contexto ---
  if (familyName === 'consultar_contexto') {
    const { entidade, filtros } = args

    // conhecimento -> buscar_conhecimento (RAG search)
    if (entidade === 'conhecimento') {
      return {
        internalTool: 'buscar_conhecimento',
        internalArgs: { consulta: filtros?.consulta ?? filtros?.query ?? '', limite: filtros?.limite },
      }
    }

    // grafo -> explorar_relacoes
    if (entidade === 'grafo') {
      return {
        internalTool: 'explorar_relacoes',
        internalArgs: { entidade: filtros?.consulta ?? filtros?.entidade ?? '', profundidade: filtros?.profundidade ?? 2 },
      }
    }

    // fontes -> listar_conhecimento
    if (entidade === 'fontes') {
      return {
        internalTool: 'listar_conhecimento',
        internalArgs: { tipo: filtros?.tipo ?? 'todos', limite: filtros?.limite ?? 20 },
      }
    }

    // status -> status_sistema
    if (entidade === 'status') {
      return {
        internalTool: 'status_sistema',
        internalArgs: {},
      }
    }

    // galeria -> listar_galeria
    if (entidade === 'galeria') {
      return {
        internalTool: 'listar_galeria',
        internalArgs: filtros ?? {},
      }
    }

    // Fallback — try knowledge search
    return {
      internalTool: 'buscar_conhecimento',
      internalArgs: { consulta: filtros?.consulta ?? filtros?.query ?? String(entidade), limite: filtros?.limite },
    }
  }

  // --- editar_ficha ---
  if (familyName === 'editar_ficha') {
    const { entidade, id, operacao, dados } = args

    // memoria -> salvar_memoria / remover_memoria
    if (entidade === 'memoria') {
      if (operacao === 'deletar' || operacao === 'remover') {
        return { internalTool: 'remover_memoria', internalArgs: { id: id ?? dados?.id } }
      }
      return { internalTool: 'salvar_memoria', internalArgs: { conteudo: dados?.conteudo, ...(id ? { id } : {}) } }
    }

    // fonte / documento -> salvar_conhecimento
    if (entidade === 'fonte' || entidade === 'documento') {
      return {
        internalTool: 'salvar_conhecimento',
        internalArgs: {
          titulo: dados?.titulo ?? dados?.title ?? 'Sem título',
          conteudo: dados?.conteudo ?? dados?.content ?? '',
          importance: dados?.importance ?? 'high',
        },
      }
    }

    return { internalTool: 'UNKNOWN', internalArgs: {} }
  }

  // --- executar_acao ---
  if (familyName === 'executar_acao') {
    const { acao, args: acaoArgs } = args
    const internalTool = ACAO_TO_TOOL[acao]
    if (!internalTool) {
      return { internalTool: 'UNKNOWN', internalArgs: {} }
    }
    return { internalTool, internalArgs: acaoArgs ?? {} }
  }

  return { internalTool: 'UNKNOWN', internalArgs: {} }
}

// ==================== EXECUTE ====================

export async function executeFamilyTool(familyName: string, args: Record<string, any>): Promise<any> {
  // Lazy import para evitar dependencia circular (tools.ts importa tool-families.ts)
  const { executeTool } = await import('./tools')

  const route = routeFamilyTool(familyName, args)

  if (route.internalTool === 'UNKNOWN') {
    return {
      status: 'error' as const,
      code: 'UNKNOWN_ACTION',
      message: `Acao desconhecida: ${JSON.stringify(args)}`,
      correction: 'Verifique o nome da acao ou entidade.',
    }
  }

  return executeTool(route.internalTool, route.internalArgs)
}

// ==================== FAMILY TOOL DEFINITIONS ====================

export const FAMILY_TOOLS = [
  {
    name: 'consultar_contexto',
    description: 'Consulta o sistema. Entidades: conhecimento (busca RAG), grafo (explorar relações), fontes (listar fontes), status (stats do sistema), galeria (listar imagens). Use filtros.consulta para buscar na base de conhecimento.',
  },
  {
    name: 'editar_ficha',
    description: 'Edita dados. Entidades: memoria (salvar/remover memórias), fonte/documento (salvar conhecimento). Use operacao "criar", "atualizar" ou "deletar".',
  },
  {
    name: 'executar_acao',
    description: 'Executa ações do sistema: backup, terminal_exec.',
  },
] as const

export const FAMILY_SCHEMAS: Record<string, z.ZodTypeAny> = {
  consultar_contexto: ConsultarContextoSchema,
  editar_ficha: EditarFichaSchema,
  executar_acao: ExecutarAcaoSchema,
}
