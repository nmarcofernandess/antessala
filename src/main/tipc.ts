import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { execute, queryAll, queryOne } from './db/query'
import { iaEnviarMensagem, iaTestarConexao } from './ia/cliente'
import { PROVIDER_DEFAULTS, resolveProviderApiKey } from './ia/config'
import { exportHtmlToPdf } from './export/pdf'
import type { IaConfiguracao, IaMensagem } from '../shared/types'
import { validateAnamneseContent } from '../shared/anamnese'

const require = createRequire(import.meta.url)
const { tipc } = require('@egoist/tipc/main') as typeof import('@egoist/tipc/main')
const t = tipc.create()

type CloudProvider = 'gemini' | 'openrouter'
type ProviderSettings = Partial<Record<CloudProvider, { token?: string; modelo?: string }>>

function assertProvider(value: string): asserts value is CloudProvider {
  if (value !== 'gemini' && value !== 'openrouter') {
    throw new Error('Provider inválido. Escolha Gemini ou OpenRouter.')
  }
}

function parseProviderSettings(raw: unknown): ProviderSettings {
  if (!raw) return {}
  if (typeof raw === 'object') return raw as ProviderSettings
  if (typeof raw !== 'string') return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as ProviderSettings) : {}
  } catch {
    return {}
  }
}

function publicIaConfig(config: IaConfiguracao | undefined) {
  if (!config) return null
  const settings = parseProviderSettings(config.provider_configs_json)
  const redacted = Object.fromEntries(
    Object.entries(settings).map(([provider, value]) => [provider, { modelo: value?.modelo }]),
  )
  return {
    ...config,
    api_key: '',
    configurado: Boolean(resolveProviderApiKey(config)),
    provider_configs_json: JSON.stringify(redacted),
  }
}

const iaConfiguracaoObter = t.procedure.action(async () => {
  const config = await queryOne<IaConfiguracao>('SELECT * FROM configuracao_ia WHERE id = 1')
  return publicIaConfig(config)
})

const iaConfiguracaoSalvar = t.procedure
  .input<{
    provider: CloudProvider
    api_key?: string
    modelo: string
    provider_configs_json?: string
  }>()
  .action(async ({ input }) => {
    assertProvider(input.provider)
    const modelo = input.modelo.trim() || PROVIDER_DEFAULTS[input.provider]
    const current = await queryOne<IaConfiguracao>('SELECT * FROM configuracao_ia WHERE id = 1')
    const settings = parseProviderSettings(current?.provider_configs_json)
    const requested = parseProviderSettings(input.provider_configs_json)
    const legacyToken = current?.provider === input.provider ? current.api_key?.trim() : ''
    const token =
      input.api_key?.trim() ||
      requested[input.provider]?.token?.trim() ||
      settings[input.provider]?.token?.trim() ||
      legacyToken ||
      ''
    settings[input.provider] = { token, modelo }

    await execute(
      `INSERT INTO configuracao_ia (
         id, provider, api_key, modelo, provider_configs_json, ativo, memoria_automatica
       ) VALUES (1, $1, $2, $3, $4, $5, FALSE)
       ON CONFLICT (id) DO UPDATE SET
         provider = EXCLUDED.provider,
         api_key = EXCLUDED.api_key,
         modelo = EXCLUDED.modelo,
         provider_configs_json = EXCLUDED.provider_configs_json,
         ativo = EXCLUDED.ativo,
         memoria_automatica = FALSE,
         atualizado_em = NOW()`,
      input.provider,
      token,
      modelo,
      JSON.stringify(settings),
      Boolean(token),
    )
    const saved = await queryOne<IaConfiguracao>('SELECT * FROM configuracao_ia WHERE id = 1')
    return publicIaConfig(saved)
  })

const iaConfiguracaoTestar = t.procedure
  .input<{
    provider: CloudProvider
    api_key?: string
    modelo: string
    provider_configs_json?: string
  }>()
  .action(async ({ input }) => {
    assertProvider(input.provider)
    const current = await queryOne<IaConfiguracao>('SELECT * FROM configuracao_ia WHERE id = 1')
    const settings = parseProviderSettings(current?.provider_configs_json)
    const requested = parseProviderSettings(input.provider_configs_json)
    const legacyToken = current?.provider === input.provider ? current.api_key?.trim() : ''
    const token =
      input.api_key?.trim() ||
      requested[input.provider]?.token?.trim() ||
      settings[input.provider]?.token?.trim() ||
      legacyToken ||
      ''
    return iaTestarConexao(
      input.provider,
      token,
      input.modelo.trim() || settings[input.provider]?.modelo || PROVIDER_DEFAULTS[input.provider],
    )
  })

const iaChatEnviar = t.procedure
  .input<{ mensagem: string; historico?: IaMensagem[]; conversa_id?: string }>()
  .action(async ({ input }) => iaEnviarMensagem(input.mensagem, input.historico ?? []))

const iaConversasListar = t.procedure
  .input<{ status?: 'ativo' | 'arquivado'; busca?: string } | undefined>()
  .action(async ({ input }) => {
    const status = input?.status ?? 'ativo'
    const busca = input?.busca?.trim() ?? ''
    return queryAll(
      `SELECT * FROM ia_conversas
       WHERE status = $1 AND ($2 = '' OR titulo ILIKE '%' || $2 || '%')
       ORDER BY atualizado_em DESC`,
      status,
      busca,
    )
  })

const iaConversasObter = t.procedure
  .input<{ id: string }>()
  .action(async ({ input }) => {
    const conversa = await queryOne('SELECT * FROM ia_conversas WHERE id = $1', input.id)
    if (!conversa) throw new Error('Conversa não encontrada.')
    const mensagens = await queryAll<{
      id: string
      conversa_id: string
      papel: IaMensagem['papel']
      conteudo: string
      timestamp: string
    }>(
      `SELECT id, conversa_id, papel, conteudo, timestamp
       FROM ia_mensagens WHERE conversa_id = $1 ORDER BY timestamp, id`,
      input.id,
    )
    return { conversa, mensagens }
  })

const iaConversasCriar = t.procedure
  .input<{ titulo?: string } | undefined>()
  .action(async ({ input }) => {
    const id = randomUUID()
    const titulo = input?.titulo?.trim() || 'Nova conversa'
    await execute('INSERT INTO ia_conversas (id, titulo) VALUES ($1, $2)', id, titulo)
    return queryOne('SELECT * FROM ia_conversas WHERE id = $1', id)
  })

const iaConversasRenomear = t.procedure
  .input<{ id: string; titulo: string }>()
  .action(async ({ input }) => {
    const titulo = input.titulo.trim()
    if (!titulo) throw new Error('Título vazio.')
    await execute(
      'UPDATE ia_conversas SET titulo = $1, atualizado_em = NOW() WHERE id = $2',
      titulo,
      input.id,
    )
    return { ok: true }
  })

const iaConversasArquivar = t.procedure
  .input<{ id: string }>()
  .action(async ({ input }) => {
    await execute(
      `UPDATE ia_conversas SET status = 'arquivado', atualizado_em = NOW() WHERE id = $1`,
      input.id,
    )
    return { ok: true }
  })

const iaConversasRestaurar = t.procedure
  .input<{ id: string }>()
  .action(async ({ input }) => {
    await execute(
      `UPDATE ia_conversas SET status = 'ativo', atualizado_em = NOW() WHERE id = $1`,
      input.id,
    )
    return { ok: true }
  })

const iaConversasDeletar = t.procedure
  .input<{ id: string }>()
  .action(async ({ input }) => {
    await execute('DELETE FROM ia_conversas WHERE id = $1', input.id)
    return { ok: true }
  })

const iaConversasArquivarTodas = t.procedure.action(async () => {
  await execute(`UPDATE ia_conversas SET status = 'arquivado', atualizado_em = NOW() WHERE status = 'ativo'`)
  return { ok: true }
})

const iaConversasDeletarArquivadas = t.procedure.action(async () => {
  await execute(`DELETE FROM ia_conversas WHERE status = 'arquivado'`)
  return { ok: true }
})

const iaMensagensSalvar = t.procedure
  .input<{ conversa_id: string; mensagem: IaMensagem }>()
  .action(async ({ input }) => {
    if (input.mensagem.papel !== 'usuario' && input.mensagem.papel !== 'assistente') {
      throw new Error('Papel de mensagem inválido.')
    }
    await execute(
      `INSERT INTO ia_mensagens (id, conversa_id, papel, conteudo, timestamp)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      input.mensagem.id,
      input.conversa_id,
      input.mensagem.papel,
      input.mensagem.conteudo,
      input.mensagem.timestamp,
    )
    await execute('UPDATE ia_conversas SET atualizado_em = NOW() WHERE id = $1', input.conversa_id)
    return { ok: true }
  })

const iaMensagensAtualizar = t.procedure
  .input<{ id: string; conteudo: string }>()
  .action(async ({ input }) => {
    await execute('UPDATE ia_mensagens SET conteudo = $1 WHERE id = $2', input.conteudo, input.id)
    return { ok: true }
  })

const iaMensagensDeletarApos = t.procedure
  .input<{ conversa_id: string; timestamp: string }>()
  .action(async ({ input }) => {
    await execute(
      'DELETE FROM ia_mensagens WHERE conversa_id = $1 AND timestamp > $2',
      input.conversa_id,
      input.timestamp,
    )
    return { ok: true }
  })

export type RegistroInput = {
  nome: string
  sexo: string
  idade: number
  plano: string
  anamnese?: { _v: 2; blocos: unknown[] }
}

const registrosCriar = t.procedure.input<RegistroInput>().action(async ({ input }) => {
  const id = randomUUID()
  const anamnese = validateAnamneseContent(input.anamnese ?? { _v: 2, blocos: [] })
  await execute(
    `INSERT INTO registros (id, nome, sexo, idade, plano, anamnese)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    id,
    input.nome.trim(),
    input.sexo.trim(),
    input.idade,
    input.plano.trim(),
    JSON.stringify(anamnese),
  )
  return queryOne('SELECT * FROM registros WHERE id = $1', id)
})

const registrosListar = t.procedure.action(async () =>
  queryAll('SELECT * FROM registros ORDER BY criado_em, id'),
)

const registrosObter = t.procedure.input<{ id: string }>().action(async ({ input }) => {
  const registro = await queryOne('SELECT * FROM registros WHERE id = $1', input.id)
  if (!registro) throw new Error('Registro não encontrado.')
  const jornada = await queryAll(
    'SELECT * FROM registro_jornada WHERE registro_id = $1 ORDER BY entrou_em, id',
    input.id,
  )
  return { registro, jornada }
})

const registrosSalvarAnamnese = t.procedure
  .input<{ id: string; anamnese: { _v: 2; blocos: unknown[] } }>()
  .action(async ({ input }) => {
    const anamnese = validateAnamneseContent(input.anamnese)
    await execute(
      'UPDATE registros SET anamnese = $1::jsonb, atualizado_em = NOW() WHERE id = $2',
      JSON.stringify(anamnese),
      input.id,
    )
    return { ok: true }
  })

const jornadaAdicionar = t.procedure
  .input<{
    registro_id: string
    estado:
      | 'aguardando_triagem'
      | 'anamnese_em_andamento'
      | 'na_fila'
      | 'analisado_pelo_especialista'
      | 'no_hub'
      | 'encerrado'
    entrou_em?: string
  }>()
  .action(async ({ input }) => {
    await execute(
      `INSERT INTO registro_jornada (registro_id, estado, entrou_em)
       VALUES ($1, $2, COALESCE($3::timestamptz, NOW()))`,
      input.registro_id,
      input.estado,
      input.entrou_em ?? null,
    )
    return { ok: true }
  })

const catalogoCidBuscar = t.procedure
  .input<{ busca: string; limite?: number }>()
  .action(async ({ input }) =>
    queryAll(
      `SELECT codigo, descricao, nivel, parent_id
       FROM catalogo_cid10
       WHERE codigo ILIKE '%' || $1 || '%' OR descricao ILIKE '%' || $1 || '%'
       ORDER BY relevancia DESC NULLS LAST, codigo
       LIMIT $2`,
      input.busca.trim(),
      Math.min(Math.max(input.limite ?? 20, 1), 100),
    ),
  )

const catalogoMedicamentosBuscar = t.procedure
  .input<{ busca: string; limite?: number }>()
  .action(async ({ input }) =>
    queryAll(
      `SELECT m.id, m.nome, m.principio_ativo, m.nomes_comerciais,
              c.nome AS classe_terapeutica, g.rotulo AS grupo_risco
       FROM catalogo_medicamentos m
       LEFT JOIN catalogo_classes_terapeuticas c ON c.id = m.classe_id
       LEFT JOIN catalogo_grupos_risco g ON g.id = m.grupo_risco_id
       WHERE m.nome ILIKE '%' || $1 || '%'
          OR m.principio_ativo ILIKE '%' || $1 || '%'
          OR m.nomes_comerciais::text ILIKE '%' || $1 || '%'
       ORDER BY m.nome
       LIMIT $2`,
      input.busca.trim(),
      Math.min(Math.max(input.limite ?? 20, 1), 100),
    ),
  )

export const router = {
  'ia.configuracao.obter': iaConfiguracaoObter,
  'ia.configuracao.salvar': iaConfiguracaoSalvar,
  'ia.configuracao.testar': iaConfiguracaoTestar,
  'ia.chat.enviar': iaChatEnviar,
  'ia.conversas.listar': iaConversasListar,
  'ia.conversas.obter': iaConversasObter,
  'ia.conversas.criar': iaConversasCriar,
  'ia.conversas.renomear': iaConversasRenomear,
  'ia.conversas.arquivar': iaConversasArquivar,
  'ia.conversas.restaurar': iaConversasRestaurar,
  'ia.conversas.deletar': iaConversasDeletar,
  'ia.conversas.arquivarTodas': iaConversasArquivarTodas,
  'ia.conversas.deletarArquivadas': iaConversasDeletarArquivadas,
  'ia.mensagens.salvar': iaMensagensSalvar,
  'ia.mensagens.atualizar': iaMensagensAtualizar,
  'ia.mensagens.deletarApos': iaMensagensDeletarApos,
  'registros.criar': registrosCriar,
  'registros.listar': registrosListar,
  'registros.obter': registrosObter,
  'registros.salvarAnamnese': registrosSalvarAnamnese,
  'registros.jornada.adicionar': jornadaAdicionar,
  'catalogos.cid10.buscar': catalogoCidBuscar,
  'catalogos.medicamentos.buscar': catalogoMedicamentosBuscar,
  'export.imprimirPDF': t.procedure
    .input<{ html: string; filename?: string; landscape?: boolean }>()
    .action(async ({ input }) => exportHtmlToPdf(input)),
  'app:version': t.procedure.action(async () => {
    try {
      const electron = require('electron') as { app?: { getVersion?: () => string } }
      return electron.app?.getVersion?.() ?? '0.0.0'
    } catch {
      return '0.0.0'
    }
  }),
}

export type Router = typeof router
