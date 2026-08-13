import { create } from 'zustand'

export interface AppDataState {
  initialized: boolean
  init: () => Promise<void>
  invalidate: (entidades: string[]) => void
  snapshot: () => null
}

// Legacy alias — useAppData hook imports this type name
export type AppDataStore = AppDataState

export const useAppDataStore = create<AppDataState>((set) => ({
  initialized: false,
  init: async () => {
    set({ initialized: true })
  },
  invalidate: (_entidades: string[]) => {
    // Will be expanded when knowledge/IA modules are functional
  },
  snapshot: () => null,
}))
