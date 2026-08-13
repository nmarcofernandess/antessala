import { spawn } from 'node:child_process'

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export interface SystemTerminalLaunchCommand {
  file: string
  args: string[]
}

export function buildSystemTerminalLaunchCommand(
  platform: NodeJS.Platform,
  scriptPath: string,
): SystemTerminalLaunchCommand {
  if (platform === 'darwin') {
    const command = `exec ${shellQuote(scriptPath)}`
    const script = `tell application "Terminal" to do script ${JSON.stringify(command)}`
    return { file: 'osascript', args: ['-e', script] }
  }

  if (platform === 'win32') {
    return { file: 'cmd.exe', args: ['/c', 'start', '', scriptPath] }
  }

  if (platform === 'linux') {
    return { file: 'x-terminal-emulator', args: ['-e', scriptPath] }
  }

  throw new Error(`Sistema operacional sem suporte para Terminal IA: ${platform}`)
}

export async function launchSystemTerminalCommand(file: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(file, args, {
      stdio: 'ignore',
      detached: process.platform !== 'darwin',
    })
    let settled = false

    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    }

    child.once('error', finish)
    if (process.platform === 'darwin') {
      child.once('close', (code, signal) => {
        if (code === 0) {
          finish()
          return
        }
        finish(new Error(`Terminal launcher falhou: ${file} saiu com code=${code ?? 'null'} signal=${signal ?? 'null'}`))
      })
    } else {
      child.once('spawn', () => {
        child.unref()
        finish()
      })
    }
  })
}

export async function openSystemTerminalWithScript(scriptPath: string): Promise<void> {
  const command = buildSystemTerminalLaunchCommand(process.platform, scriptPath)
  await launchSystemTerminalCommand(command.file, command.args)
}
