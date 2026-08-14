export const ACTIVE_IPC_CHANNELS = [
  'auth.login',
  'auth.logout',
  'auth.current',
  'mvp.cases.list',
  'mvp.cases.create',
  'mvp.cases.startNursing',
  'mvp.triage.submit',
  'mvp.requirements.confirm',
  'mvp.slots.listCompatible',
  'mvp.bookings.confirm',
  'mvp.users.list',
  'ia.configuracao.obter',
  'ia.configuracao.salvar',
  'ia.configuracao.testar',
  'ia.chat.enviar',
  'ia.conversas.listar',
  'ia.conversas.obter',
  'ia.conversas.criar',
  'ia.conversas.renomear',
  'ia.conversas.arquivar',
  'ia.conversas.restaurar',
  'ia.conversas.deletar',
  'ia.conversas.arquivarTodas',
  'ia.conversas.deletarArquivadas',
  'ia.mensagens.salvar',
  'ia.mensagens.atualizar',
  'ia.mensagens.deletarApos',
  'app:version',
] as const

export type ActiveIpcChannel = (typeof ACTIVE_IPC_CHANNELS)[number]

const ACTIVE_IPC_CHANNEL_SET = new Set<string>(ACTIVE_IPC_CHANNELS)

export function isActiveIpcChannel(channel: unknown): channel is ActiveIpcChannel {
  return typeof channel === 'string' && ACTIVE_IPC_CHANNEL_SET.has(channel)
}
