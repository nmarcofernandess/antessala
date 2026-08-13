import { systemPreferences } from 'electron'
import type { MaiaPermissionState } from '../../shared/maia-mvp-contract'

export type { MaiaPermissionState }

export interface MaiaPermissionStatus {
  screen: MaiaPermissionState
  accessibility: MaiaPermissionState
}

function normalizeMediaStatus(status: string): MaiaPermissionState {
  if (status === 'granted') return 'granted'
  if (status === 'denied' || status === 'restricted') return 'denied'
  if (status === 'not-determined') return 'not-determined'
  return 'unknown'
}

export async function getMaiaPermissionStatus(): Promise<MaiaPermissionStatus> {
  const screen = normalizeMediaStatus(systemPreferences.getMediaAccessStatus('screen' as any))
  const accessibility = systemPreferences.isTrustedAccessibilityClient(false) ? 'granted' : 'denied'
  return { screen, accessibility }
}

export async function promptForAccessibilityPermission(): Promise<MaiaPermissionStatus> {
  systemPreferences.isTrustedAccessibilityClient(true)
  return getMaiaPermissionStatus()
}
