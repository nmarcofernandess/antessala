import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// O nome do app vem de app-config; em dev o app.getPath('userData') resolve
// para ".../Electron/..." porque o binário se chama "Electron". O dir de
// modelos deve estar SEMPRE ancorado no nome real do produto.
vi.mock('../../../src/main/config/app-config', () => ({
  APP_CONFIG: {
    name: 'FlowKit',
  },
  isGeminiCloudApiEnabled: vi.fn(() => true),
}))

describe('getModelDir — ancorado no nome do app', () => {
  const originalEnv = process.env.FLOWKIT_LOCAL_MODELS_DIR

  beforeEach(() => {
    delete process.env.FLOWKIT_LOCAL_MODELS_DIR
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.FLOWKIT_LOCAL_MODELS_DIR
    } else {
      process.env.FLOWKIT_LOCAL_MODELS_DIR = originalEnv
    }
  })

  it('sem env override, ancora o dir no nome do app (não em /Electron/models)', async () => {
    const { getModelDir } = await import('../../../src/main/ia/local-llm')

    const dir = getModelDir()

    expect(dir).toContain('FlowKit')
    expect(dir.endsWith('/Electron/models')).toBe(false)
    expect(dir).not.toContain(`${'/Electron/'}models`)
  })

  it('com FLOWKIT_LOCAL_MODELS_DIR setado, retorna exatamente o override', async () => {
    process.env.FLOWKIT_LOCAL_MODELS_DIR = '/tmp/x'

    const { getModelDir } = await import('../../../src/main/ia/local-llm')

    expect(getModelDir()).toBe('/tmp/x')
  })

  // Invariante anti-split-brain: o dir de modelos ancora em APP_CONFIG.name,
  // mas o userData REAL do app empacotado vem do productName do
  // electron-builder.yml. Se divergirem, o modelo aponta pra fora do userData
  // empacotado. Este teste compara o YAML REAL com o APP_CONFIG REAL
  // (via importActual, ignorando o mock de cima) — se alguém driftar
  // APP_IDENTITY.appName ou o productName, este teste quebra.
  it('invariante: productName do electron-builder.yml === APP_CONFIG.name (real)', async () => {
    const { APP_CONFIG } = await vi.importActual<typeof import('../../../src/main/config/app-config')>(
      '../../../src/main/config/app-config',
    )

    const ymlPath = path.resolve(__dirname, '../../../electron-builder.yml')
    const ymlRaw = fs.readFileSync(ymlPath, 'utf8')

    // Regex sem dependencia (js-yaml nao e dep declarada deste kit, que existe
    // para ser forkado). productName e um escalar top-level no YAML.
    const match = ymlRaw.match(/^productName:\s*(.+?)\s*$/m)
    const productName = match?.[1]

    expect(productName).toBeTypeOf('string')
    expect(productName).toBe(APP_CONFIG.name)
  })
})
