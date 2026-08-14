import { Outlet, createHashRouter } from 'react-router-dom'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from './componentes/AppSidebar'
import { ErrorBoundary } from './componentes/ErrorBoundary'
import { AgendaPagina } from './paginas/AgendaPagina'
import { CadastroPagina } from './paginas/CadastroPagina'
import { Dashboard } from './paginas/Dashboard'
import { ConfiguracoesPagina } from './paginas/ConfiguracoesPagina'
import { IaPagina } from './paginas/IaPagina'
import { MemoriaPagina } from './paginas/MemoriaPagina'
import { DocumentoMemoriaPagina } from './paginas/DocumentoMemoriaPagina'
import { NaoEncontrado } from './paginas/NaoEncontrado'
import { RepertorioPagina } from './paginas/RepertorioPagina'
import { CasoPagina } from './paginas/casos/CasoPagina'
import { CasoAnamnesePagina } from './paginas/casos/CasoAnamnesePagina'

export const ACTIVE_ROUTE_PATHS = [
  '/',
  '/casos/novo',
  '/casos/:caseId',
  '/casos/:caseId/anamnese',
  '/agenda',
  '/repertorio',
  '/repertorio/widgets',
  '/assistente',
  '/memoria',
  '/memoria/documentos/:id',
  '/configuracoes',
] as const

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

export const router = createHashRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/casos/novo', element: <CadastroPagina /> },
      { path: '/casos/:caseId', element: <CasoPagina /> },
      { path: '/casos/:caseId/anamnese', element: <CasoAnamnesePagina /> },
      { path: '/agenda', element: <AgendaPagina /> },
      { path: '/repertorio', element: <RepertorioPagina /> },
      { path: '/repertorio/widgets', element: <RepertorioPagina /> },
      { path: '/assistente', element: <IaPagina /> },
      { path: '/memoria', element: <MemoriaPagina /> },
      { path: '/memoria/documentos/:id', element: <DocumentoMemoriaPagina /> },
      { path: '/configuracoes', element: <ConfiguracoesPagina /> },
      { path: '*', element: <NaoEncontrado /> },
    ],
  },
])
