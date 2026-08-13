import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { clipboard } from 'electron'

const execFileAsync = promisify(execFile)

export async function readClipboardText(): Promise<string> {
  return clipboard.readText().trim()
}

export async function writeClipboardText(text: string): Promise<void> {
  clipboard.writeText(text)
}

export async function pasteClipboardText(): Promise<void> {
  await execFileAsync('osascript', [
    '-e',
    'tell application "System Events" to keystroke "v" using command down',
  ])
}

export async function replaceSelectedText(text: string): Promise<void> {
  const previous = clipboard.readText()
  clipboard.writeText(text)
  try {
    await pasteClipboardText()
  } finally {
    clipboard.writeText(previous)
  }
}
