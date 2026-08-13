import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// Toca um arquivo de áudio (hoje só WAV) no main, sem plumbing de áudio no renderer.
// macOS-only: `afplay` é nativo. Em outra plataforma, levanta erro claro (o MVP é macOS).
export async function playAudioFile(filePath: string): Promise<void> {
  if (process.platform !== 'darwin') {
    throw new Error('Reprodução de áudio da Maiá só está disponível no macOS (afplay).')
  }
  await execFileAsync('afplay', [filePath])
}
