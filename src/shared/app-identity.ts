export const APP_IDENTITY = {
  appName: 'Antessala',
  productName: 'Antessala',
  assistantName: 'Assistente da triagem',
  terminalAgentName: 'Assistente IA no Terminal',
  cliName: 'antessala',
  cliDisplayName: 'Antessala CLI',
  cliNpmScript: 'npm run cli',
  enableTerminalLauncher: false,
} as const

export type AppIdentity = typeof APP_IDENTITY
