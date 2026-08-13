import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb } from '../../../src/main/db/pglite'
import { createTables } from '../../../src/main/db/schema'
import { queryOne } from '../../../src/main/db/query'
import { executeTool } from '../../../src/main/ia/tools'

describe('IA terminal tool with real filesystem and audit persistence', () => {
  let dbDir: string
  let rootDir: string

  beforeEach(async () => {
    await closeDb()
    dbDir = await mkdtemp(path.join(os.tmpdir(), 'flowkit-terminal-db-'))
    rootDir = await mkdtemp(path.join(os.tmpdir(), 'Flow Kit Terminal Proof '))
    process.env.FLOWKIT_DB_PATH = dbDir
    await initDb()
    await createTables()
  })

  afterEach(async () => {
    await closeDb()
    delete process.env.FLOWKIT_DB_PATH
    await rm(dbDir, { recursive: true, force: true })
    await rm(rootDir, { recursive: true, force: true })
  })

  it('creates and reads a real file in a path with spaces, then records source=ia_tool audit', async () => {
    const cwd = path.join(rootDir, 'pasta com espaço')
    await mkdir(cwd)
    const fileName = 'resultado com espaço.txt'
    const filePath = path.join(cwd, fileName)

    const result = await executeTool('terminal_exec', {
      command: `printf 'pao doce' > ${JSON.stringify(fileName)} && cat ${JSON.stringify(fileName)}`,
      cwd,
      timeout_ms: 5000,
      max_output_chars: 5000,
    })

    expect(result.status).toBe('ok')
    expect(result.result.stdout).toBe('pao doce')
    expect(result.audit).toEqual({ logged: true })
    await expect(readFile(filePath, 'utf-8')).resolves.toBe('pao doce')

    const log = await queryOne<{
      source: string
      command: string
      cwd: string
      status: string
      exit_code: number | null
      timed_out: boolean
      output_preview: string | null
    }>('SELECT source, command, cwd, status, exit_code, timed_out, output_preview FROM terminal_command_log ORDER BY id DESC LIMIT 1')
    expect(log).toMatchObject({
      source: 'ia_tool',
      command: result.result.command,
      cwd,
      status: 'executed',
      exit_code: 0,
      timed_out: false,
      output_preview: 'pao doce',
    })
  })
})
