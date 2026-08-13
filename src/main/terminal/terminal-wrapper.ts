import { chmod, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export interface AiTerminalWrapper {
  path: string
  command: string
  cwd: string
}

export interface AiTerminalWrapperContent {
  extension: '.cmd' | '.sh'
  content: string
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function windowsQuote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function buildAiTerminalWrapperContent(input: {
  cwd: string
  command: string
  title?: string
  platform?: NodeJS.Platform
}): AiTerminalWrapperContent {
  const platform = input.platform ?? process.platform
  const title = input.title || 'FlowKit IA no Terminal'

  if (platform === 'win32') {
    return {
      extension: '.cmd',
      content: [
        '@echo off',
        `title ${title}`,
        `cd /d ${windowsQuote(input.cwd)}`,
        `echo ${title}`,
        `echo CWD: ${input.cwd}`,
        `echo Comando: ${input.command}`,
        'echo.',
        input.command,
        '',
      ].join('\r\n'),
    }
  }

  return {
    extension: '.sh',
    content: [
      '#!/usr/bin/env zsh',
      'set -e',
      `cd ${shellQuote(input.cwd)}`,
      `printf '%s\\n' ${shellQuote(title)}`,
      `printf 'CWD: %s\\n' "$PWD"`,
      `printf 'Comando: %s\\n\\n' ${shellQuote(input.command)}`,
      `exec ${input.command}`,
      '',
    ].join('\n'),
  }
}

export async function writeAiTerminalWrapper(input: {
  cwd: string
  command: string
  title?: string
}): Promise<AiTerminalWrapper> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'flowkit-ai-terminal-'))
  const wrapper = buildAiTerminalWrapperContent(input)
  const scriptPath = path.join(dir, `open-flowkit-ai-terminal${wrapper.extension}`)

  if (wrapper.extension === '.cmd') {
    await writeFile(scriptPath, wrapper.content, 'utf-8')
    return { path: scriptPath, command: input.command, cwd: input.cwd }
  }

  await writeFile(scriptPath, wrapper.content, 'utf-8')
  await chmod(scriptPath, 0o700)

  return { path: scriptPath, command: input.command, cwd: input.cwd }
}
