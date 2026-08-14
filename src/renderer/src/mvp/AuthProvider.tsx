import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { client } from '@/servicos/client'

export type RendererSession = {
  userId: string
  email: string
  name: string
  role: 'ADMIN' | 'RECEPCAO' | 'ENFERMAGEM' | 'ANESTESIOLOGISTA' | 'SOLICITANTE'
  requesterService: string | null
}

type AuthContextValue = {
  session: RendererSession | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<RendererSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void client['auth.current']()
      .then((value) => setSession(value as RendererSession | null))
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    session,
    loading,
    login: async (email, password) => {
      const next = await client['auth.login']({ email, password })
      setSession(next as RendererSession)
    },
    logout: async () => {
      await client['auth.logout']()
      setSession(null)
    },
  }), [loading, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth precisa de AuthProvider.')
  return context
}
