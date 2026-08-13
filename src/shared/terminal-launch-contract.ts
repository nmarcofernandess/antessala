import { APP_IDENTITY } from './app-identity'

export const AI_TERMINAL_COMMAND_ARGS = ['chat', '--attach'] as const

type BuildAiTerminalCommandInput = {
  projectCwd?: string
  cliEntryPath?: string
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function buildCliScript(input?: BuildAiTerminalCommandInput): string {
  if (input?.cliEntryPath) {
    return `node ${shellQuote(input.cliEntryPath)}`
  }
  if (input?.projectCwd) {
    return `npm --prefix ${shellQuote(input.projectCwd)} run cli`
  }
  return APP_IDENTITY.cliNpmScript
}

export function buildAiTerminalCommand(input?: BuildAiTerminalCommandInput): string {
  return `${buildCliScript(input)} -- ${AI_TERMINAL_COMMAND_ARGS.join(' ')}`
}

export function buildAiTerminalSingleShotCommand(
  message: string,
  input?: BuildAiTerminalCommandInput,
): string {
  return `${buildCliScript(input)} -- chat ${shellQuote(message)}`
}

export const AI_TERMINAL_COPY = {
  title: APP_IDENTITY.terminalAgentName,
  description: `Abre o ${APP_IDENTITY.assistantName} configurado no Terminal do sistema.`,
  primaryAction: 'Abrir IA no Terminal do Sistema',
  configureAction: 'Configurar IA',
  copyCommandAction: 'Copiar comando',
  noConfig: 'Configure uma IA para abrir no Terminal.',
  manualFallback: 'Cole este comando no Terminal do sistema se a abertura automática for bloqueada.',
} as const
