import type { globalShortcut as ElectronGlobalShortcut } from 'electron'
import type { MaiaHotkeyStatus } from '../../shared/maia-mvp-contract'
import { runLiteralReadAction } from './runtime-actions'
import { openMaiaCommandBar } from './command-bar-window'

let literalReadRegistered = false
let commandBarRegistered = false

export const MAIA_LITERAL_READ_ACCELERATOR = 'Shift+Delete'
export const MAIA_COMMAND_BAR_ACCELERATOR = 'CommandOrControl+Shift+Space'

export function registerMaiaHotkeys(globalShortcut: typeof ElectronGlobalShortcut): void {
  try {
    literalReadRegistered = globalShortcut.register(MAIA_LITERAL_READ_ACCELERATOR, () => {
      runLiteralReadAction({}).catch((err) => {
        console.warn('[maia] literal hotkey failed:', (err as Error).message)
      })
    })

    if (!literalReadRegistered) {
      console.warn(`[maia] ${MAIA_LITERAL_READ_ACCELERATOR} hotkey was not registered.`)
    }

    commandBarRegistered = globalShortcut.register(MAIA_COMMAND_BAR_ACCELERATOR, () => {
      openMaiaCommandBar().catch((err) => {
        console.warn('[maia] command bar hotkey failed:', (err as Error).message)
      })
    })

    if (!commandBarRegistered) {
      console.warn(`[maia] ${MAIA_COMMAND_BAR_ACCELERATOR} hotkey was not registered.`)
    }
  } catch (err) {
    literalReadRegistered = false
    commandBarRegistered = false
    console.warn('[maia] hotkey registration skipped:', (err as Error).message)
  }
}

// Status honesto pro capability snapshot: o acelerador e se ele foi de fato
// registrado (pode falhar por conflito do SO/outro app dono do atalho).
export function getMaiaHotkeyStatus(): MaiaHotkeyStatus {
  return {
    literalReading: { accelerator: MAIA_LITERAL_READ_ACCELERATOR, registered: literalReadRegistered },
    commandBar: { accelerator: MAIA_COMMAND_BAR_ACCELERATOR, registered: commandBarRegistered },
  }
}

export function unregisterMaiaHotkeys(globalShortcut: typeof ElectronGlobalShortcut): void {
  try {
    if (literalReadRegistered) {
      globalShortcut.unregister(MAIA_LITERAL_READ_ACCELERATOR)
    }
    if (commandBarRegistered) {
      globalShortcut.unregister(MAIA_COMMAND_BAR_ACCELERATOR)
    }
  } catch {
    // App shutdown should not be blocked by shortcut cleanup.
  } finally {
    literalReadRegistered = false
    commandBarRegistered = false
  }
}
