import { useEffect } from 'react'
import { Outlet, useLocation, createHashRouter } from 'react-router-dom'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { useIaStore } from '@/store/iaStore'
import { AppSidebar } from './componentes/AppSidebar'
import { ErrorBoundary } from './componentes/ErrorBoundary'
import { IaChatPanel } from './componentes/IaChatPanel'
import { AgendaPagina } from './paginas/AgendaPagina'
import { AnamnesePagina } from './paginas/AnamnesePagina'
import { CadastroPagina } from './paginas/CadastroPagina'
import { Dashboard } from './paginas/Dashboard'
import { ConfiguracoesPagina } from './paginas/ConfiguracoesPagina'
import { IaPagina } from './paginas/IaPagina'
import { NaoEncontrado } from './paginas/NaoEncontrado'

export const ACTIVE_ROUTE_PATHS = [
  '/',
  '/casos/novo',
  '/triagem',
  '/agenda',
  '/ia',
  '/configuracoes',
] as const

function AppLayout() {
  const location = useLocation()
  const { toggleAberto } = useIaStore()

  // Cmd+J abre/fecha painel IA
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'j' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (location.pathname === '/ia') return
        toggleAberto()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleAberto, location.pathname])

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
          {location.pathname !== '/ia' && <IaChatPanel />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export const router = createHashRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/casos/novo', element: <CadastroPagina /> },
      { path: '/triagem', element: <AnamnesePagina /> },
      { path: '/agenda', element: <AgendaPagina /> },
      { path: '/ia', element: <IaPagina /> },
      { path: '/configuracoes', element: <ConfiguracoesPagina /> },
      { path: '*', element: <NaoEncontrado /> },
    ],
  },
])
