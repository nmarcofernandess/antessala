import { describe, expect, it } from 'vitest'
import {
  AI_RUNTIME_READINESS_COPY,
  AI_TERMINAL_COMMAND_ARGS,
  AI_TERMINAL_COPY,
  buildAiTerminalCommand,
  type AiRuntimeReadinessCode,
} from '../../src/shared'

const EXPECTED_CODES: AiRuntimeReadinessCode[] = [
  'configMissing',
  'credentialMissing',
  'credentialInvalid',
  'providerUnreachable',
  'rateLimited',
  'modelDownloadRequired',
  'modelDownloading',
  'modelDownloadCanceled',
  'modelNeedsValidation',
  'modelLoadingFailed',
  'modelCorrupt',
  'cliMissing',
  'toolsUnavailable',
  'osUnsupported',
  'ready',
]

describe('AI terminal shared contract', () => {
  it('keeps the full readiness matrix explicit', () => {
    expect(Object.keys(AI_RUNTIME_READINESS_COPY).sort()).toEqual([...EXPECTED_CODES].sort())

    for (const code of EXPECTED_CODES) {
      expect(AI_RUNTIME_READINESS_COPY[code]).toMatchObject({
        code,
        label: expect.any(String),
        message: expect.any(String),
        action: expect.any(String),
        blocksLaunch: expect.any(Boolean),
      })
    }
  })

  it('builds the single canonical AI terminal command', () => {
    expect(AI_TERMINAL_COMMAND_ARGS).toEqual(['chat', '--attach'])
    expect(buildAiTerminalCommand()).toBe('npm run cli -- chat --attach')
    expect(buildAiTerminalCommand({ projectCwd: '/tmp/Flow Kit' })).toBe(
      "npm --prefix '/tmp/Flow Kit' run cli -- chat --attach",
    )
    expect(buildAiTerminalCommand({ cliEntryPath: '/tmp/Flow Kit/cli/index.js' })).toBe(
      "node '/tmp/Flow Kit/cli/index.js' -- chat --attach",
    )
    expect(AI_TERMINAL_COPY.primaryAction).toBe('Abrir IA no Terminal do Sistema')
    expect(AI_TERMINAL_COPY.copyCommandAction).toBe('Copiar comando')
  })
})
