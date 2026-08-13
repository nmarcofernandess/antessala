import { APP_IDENTITY } from '../../shared/app-identity'

/**
 * Antessala — configuração central do app.
 *
 * O nome vem de shared/app-identity.ts; nao duplicar aqui.
 * Para renomear o projeto: app-identity.ts, package.json e electron-builder.yml.
 */

export const APP_CONFIG = {
  /** Nome exibido na sidebar, title bar, wizard */
  name: APP_IDENTITY.appName,

  /** Nome do icone lucide-react pra sidebar header */
  icon: 'Workflow',

  /** Descrição curta (about) */
  description: 'Triagem pré-anestésica offline',

  /** Nome do diretorio PGlite dentro de userData */
  dbName: 'antessala-pg',

  /** Tema default no primeiro boot */
  defaultTheme: 'dark' as const,

  /** Env vars pra fallback de API keys */
  envKeys: {
    gemini: 'GOOGLE_API_KEY',
    geminiAlternate: 'GEMINI_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
  } as Record<string, string>,
}

/**
 * API Gemini direta (Google Generative AI / @ai-sdk/google).
 * Fica ligada por padrão; use `ANTESSALA_GEMINI_ENABLE=0` para desligar.
 * O nome legado continua aceito apenas para não quebrar ambientes existentes.
 */
export function isGeminiCloudApiEnabled(): boolean {
  const v = (
    process.env.ANTESSALA_GEMINI_ENABLE ?? process.env.FLOWKIT_GEMINI_ENABLE
  )?.trim().toLowerCase()
  if (v === '0' || v === 'false' || v === 'no') return false
  if (v === '1' || v === 'true' || v === 'yes') return true
  return true
}
