export const APP_IDENTITY = {
  appName: 'Antessala',
  productName: 'Antessala',
  assistantName: 'Assistente da triagem',
} as const

export type AppIdentity = typeof APP_IDENTITY

/**
 * A conta única da demonstração.
 *
 * Não é usuário, não autentica, não carrega permissão: é o rótulo que o menu do
 * rodapé exibe para deixar claro que uma conta sintética integrada está vendo
 * todas as ferramentas — em vez de sugerir que existem cinco logins. Autoria de
 * ação continua sendo responsabilidade do processo principal; isto é etiqueta de
 * tela.
 */
export const DEMO_ACCOUNT = {
  nome: 'Conta da demonstração',
  badge: 'Demonstração integrada',
  iniciais: 'CD',
} as const
