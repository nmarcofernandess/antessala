import fs from 'node:fs'
import path from 'node:path'
import { buildAiTerminalCommand } from '../../shared/terminal-launch-contract'

export interface AiTerminalCliResolution {
  command: string
  exists: boolean
  source: 'packaged' | 'project' | 'missing'
  cliPath: string | null
  projectCwd: string
}

function packagedCliPath(): string | null {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  return resourcesPath ? path.join(resourcesPath, 'cli', 'index.js') : null
}

function fileExists(filePath: string | null): filePath is string {
  return Boolean(filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile())
}

export function resolveAiTerminalCliCommand(projectCwd = process.cwd()): AiTerminalCliResolution {
  const packaged = packagedCliPath()
  if (fileExists(packaged)) {
    return {
      command: buildAiTerminalCommand({ cliEntryPath: packaged }),
      exists: true,
      source: 'packaged',
      cliPath: packaged,
      projectCwd,
    }
  }

  const sourceCli = path.resolve(projectCwd, 'src/cli/index.ts')
  const builtCli = path.resolve(projectCwd, 'out/cli/index.js')
  if (fileExists(sourceCli) || fileExists(builtCli)) {
    return {
      command: buildAiTerminalCommand({ projectCwd }),
      exists: true,
      source: 'project',
      cliPath: fileExists(sourceCli) ? sourceCli : builtCli,
      projectCwd,
    }
  }

  return {
    command: buildAiTerminalCommand({ projectCwd }),
    exists: false,
    source: 'missing',
    cliPath: null,
    projectCwd,
  }
}
