import { Outlet, createHashRouter } from 'react-router-dom'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from './componentes/AppSidebar'
import { ErrorBoundary } from './componentes/ErrorBoundary'
import { ConfiguracoesPagina } from './paginas/ConfiguracoesPagina'
import { NaoEncontrado } from './paginas/NaoEncontrado'
import { AuthProvider, useAuth } from './mvp/AuthProvider'
import { LoginPagina } from './mvp/LoginPagina'
import { OperacaoPagina } from './mvp/OperacaoPagina'

export const ACTIVE_ROUTE_PATHS = ['/', '/configuracoes'] as const

function AppLayout() {
  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar />
      <SidebarInset className="h-full min-h-0 overflow-hidden">
        <div className="flex min-h-0 flex-1">
          <main className="min-h-0 min-w-0 flex-1 overflow-auto">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function MvpGate() {
  const { session, loading, login } = useAuth()
  if (loading) return <div className="grid min-h-svh place-items-center text-sm text-muted-foreground">Abrindo banco local…</div>
  if (!session) return <LoginPagina onLogin={login} />
  return <AppLayout />
}

export const router = createHashRouter([
  {
    element: <AuthProvider><MvpGate /></AuthProvider>,
    children: [
      { path: '/', element: <OperacaoPagina /> },
      { path: '/configuracoes', element: <ConfiguracoesPagina /> },
      { path: '*', element: <NaoEncontrado /> },
    ],
  },
])
