import crypto from 'node:crypto'
import path from 'node:path'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { app } from 'electron'
import { execute, queryAll } from '../db/query'
import { iaEnviarMensagemStream } from '../ia/cliente'
import type { AiRouteTask } from '../../shared/ia-routing-contract'
import type { IaAnexo, IaContexto, IaMensagem, ToolCall } from '../../shared/types'

function getAnexosBaseDir(): string {
  try {
    if (app?.isPackaged && app.getPath) {
      return path.join(app.getPath('userData'), 'anexos')
    }
  } catch { /* fallback */ }
  return path.join(__dirname, '../../data/anexos')
}

function getAnexosConversaDir(conversaId: string): string {
  const dir = path.join(getAnexosBaseDir(), conversaId)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
    'text/markdown': '.md',
    'application/json': '.json',
  }
  return map[mime] || '.bin'
}

async function persistInlineAttachments(conversaId: string, anexos: IaAnexo[] = []): Promise<IaAnexo[]> {
  return anexos.map((anexo) => {
    if (!anexo.data_base64 || anexo.file_path) return anexo
    const dir = getAnexosConversaDir(conversaId)
    const filePath = path.join(dir, `${anexo.id}${mimeToExt(anexo.mime_type)}`)
    const buffer = Buffer.from(anexo.data_base64, 'base64')
    writeFileSync(filePath, buffer)
    return {
      ...anexo,
      file_path: filePath,
      data_base64: anexo.data_base64,
    }
  })
}

function deserializeMessage(row: any): IaMensagem {
  return {
    id: row.id,
    papel: row.papel,
    conteudo: row.conteudo,
    timestamp: row.timestamp,
    tool_calls: row.tool_calls_json ? JSON.parse(row.tool_calls_json) : undefined,
    anexos: row.anexos_meta_json ? JSON.parse(row.anexos_meta_json) : undefined,
  }
}

export async function createFlowKitConversation(input: { titulo: string }): Promise<{ id: string; titulo: string }> {
  const id = crypto.randomUUID()
  await execute('INSERT INTO ia_conversas (id, titulo) VALUES (?, ?)', id, input.titulo)
  return { id, titulo: input.titulo }
}

export async function saveFlowKitMessage(input: { conversaId: string; mensagem: IaMensagem }): Promise<void> {
  const toolCallsJson = input.mensagem.tool_calls ? JSON.stringify(input.mensagem.tool_calls) : null
  const anexosMetaJson = input.mensagem.anexos?.length
    ? JSON.stringify(input.mensagem.anexos.map(a => ({
        id: a.id,
        tipo: a.tipo,
        mime_type: a.mime_type,
        nome: a.nome,
        tamanho_bytes: a.tamanho_bytes,
        file_path: a.file_path,
      })))
    : null

  await execute(
    `INSERT INTO ia_mensagens (id, conversa_id, papel, conteudo, timestamp, tool_calls_json, anexos_meta_json)
     VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
    input.mensagem.id,
    input.conversaId,
    input.mensagem.papel,
    input.mensagem.conteudo,
    input.mensagem.timestamp,
    toolCallsJson,
    anexosMetaJson,
  )
  await execute('UPDATE ia_conversas SET atualizado_em = NOW(), resumo_compactado = NULL WHERE id = ?', input.conversaId)
}

export async function sendFlowKitChatMessage(input: {
  conversaId: string
  mensagem: string
  contexto: IaContexto
  anexos?: IaAnexo[]
  routeTask?: AiRouteTask
}): Promise<{ resposta: string; acoes: ToolCall[] }> {
  const historicoRows = await queryAll<any>(
    `SELECT id, conversa_id, papel, conteudo, timestamp, tool_calls_json, anexos_meta_json
     FROM ia_mensagens WHERE conversa_id = ? ORDER BY timestamp ASC`,
    input.conversaId,
  )
  const historico = historicoRows.map(deserializeMessage)
  const anexos = await persistInlineAttachments(input.conversaId, input.anexos ?? [])

  await saveFlowKitMessage({
    conversaId: input.conversaId,
    mensagem: {
      id: crypto.randomUUID(),
      papel: 'usuario',
      conteudo: input.mensagem,
      timestamp: new Date().toISOString(),
      anexos: anexos.length > 0 ? anexos : undefined,
    },
  })

  const streamId = crypto.randomUUID()
  const routeArgs = input.routeTask ? [{ task: input.routeTask }] as const : [] as const
  const response = await iaEnviarMensagemStream(
    input.mensagem,
    historico,
    streamId,
    input.contexto,
    input.conversaId,
    anexos,
    ...routeArgs,
  )

  await saveFlowKitMessage({
    conversaId: input.conversaId,
    mensagem: {
      id: crypto.randomUUID(),
      papel: 'assistente',
      conteudo: response.resposta,
      timestamp: new Date().toISOString(),
      tool_calls: response.acoes.length > 0 ? response.acoes : undefined,
    },
  })

  return response
}
