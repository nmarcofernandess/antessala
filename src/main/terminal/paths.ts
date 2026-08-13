import path from 'node:path'
import { stat } from 'node:fs/promises'

export async function resolveExistingDirectory(input?: string): Promise<string> {
  const resolved = path.resolve(input || process.cwd())
  const fileStat = await stat(resolved)
  if (!fileStat.isDirectory()) {
    throw new Error(`Diretorio nao encontrado: ${resolved}`)
  }
  return resolved
}
