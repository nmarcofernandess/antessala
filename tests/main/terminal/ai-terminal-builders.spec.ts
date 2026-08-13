import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildSystemTerminalLaunchCommand } from '../../../src/main/terminal/open-system-terminal'
import { buildAiTerminalWrapperContent } from '../../../src/main/terminal/terminal-wrapper'
import { resolveAiTerminalCliCommand } from '../../../src/main/terminal/cli-command'

describe('AI terminal launch builders', () => {
  it('quotes macOS Terminal scripts without executing path fragments', () => {
    const command = buildSystemTerminalLaunchCommand('darwin', '/tmp/Flow Kit/open terminal.sh')

    expect(command.file).toBe('osascript')
    expect(command.args).toHaveLength(2)
    expect(command.args[1]).toContain('tell application "Terminal"')
    expect(command.args[1]).toContain("exec '/tmp/Flow Kit/open terminal.sh'")
  })

  it('passes Windows wrapper paths as one start argument', () => {
    const scriptPath = 'C:\\Users\\Marco Flow\\App Data\\open-flowkit-ai-terminal.cmd'
    const command = buildSystemTerminalLaunchCommand('win32', scriptPath)

    expect(command.file).toBe('cmd.exe')
    expect(command.args).toEqual(['/c', 'start', '', scriptPath])
  })

  it('writes Unix wrapper content with a quoted cwd containing spaces', () => {
    const wrapper = buildAiTerminalWrapperContent({
      platform: 'darwin',
      cwd: "/Users/marco/Flow Kit's App",
      command: 'npm run cli -- chat --attach',
    })

    expect(wrapper.extension).toBe('.sh')
    expect(wrapper.content).toContain("cd '/Users/marco/Flow Kit'\\''s App'")
    expect(wrapper.content).toContain('exec npm run cli -- chat --attach')
  })

  it('writes Windows wrapper content with a quoted cwd containing spaces', () => {
    const wrapper = buildAiTerminalWrapperContent({
      platform: 'win32',
      cwd: 'C:\\Users\\Marco Flow\\App Data',
      command: 'npm run cli -- chat --attach',
    })

    expect(wrapper.extension).toBe('.cmd')
    expect(wrapper.content).toContain('cd /d "C:\\Users\\Marco Flow\\App Data"')
    expect(wrapper.content).toContain('npm run cli -- chat --attach')
  })

  it('resolves packaged CLI artifacts before project source commands', () => {
    const original = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
    const dir = mkdtempSync(path.join(os.tmpdir(), 'flowkit-cli-artifact-'))
    const cliDir = path.join(dir, 'cli')
    mkdirSync(cliDir, { recursive: true })
    writeFileSync(path.join(cliDir, 'index.js'), '#!/usr/bin/env node\n')

    Object.defineProperty(process, 'resourcesPath', {
      value: dir,
      configurable: true,
    })

    try {
      const resolved = resolveAiTerminalCliCommand('/tmp/Flow Kit Source')

      expect(resolved.exists).toBe(true)
      expect(resolved.source).toBe('packaged')
      expect(resolved.command).toBe(`node '${path.join(cliDir, 'index.js')}' -- chat --attach`)
    } finally {
      Object.defineProperty(process, 'resourcesPath', {
        value: original,
        configurable: true,
      })
    }
  })
})
