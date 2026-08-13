import { useEffect, useState } from 'react'
import { Outlet, useLocation, createHashRouter } from 'react-router-dom'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { useIaStore } from '@/store/iaStore'
import { useAppDataStore } from '@/store/appDataStore'
import { AppSidebar } from './componentes/AppSidebar'
import { ErrorBoundary } from './componentes/ErrorBoundary'
import { IaChatPanel } from './componentes/IaChatPanel'
import {
  OnboardingTourProvider,
  useOnboardingTour,
} from './componentes/onboarding/OnboardingTour'
import { flowkitTourSteps } from './componentes/onboarding/tour-steps'
import { Dashboard } from './paginas/Dashboard'
import { ConfiguracoesPagina } from './paginas/ConfiguracoesPagina'
import { MemoriaPagina } from './paginas/MemoriaPagina'
import { IaPagina } from './paginas/IaPagina'
import { GaleriaPagina } from './paginas/GaleriaPagina'
import { TerminalPagina } from './paginas/TerminalPagina'
import { MaiaPagina } from './paginas/MaiaPagina'
import { MaiaBarPagina } from './paginas/MaiaBarPagina'
import { NaoEncontrado } from './paginas/NaoEncontrado'
import SetupWizard from './componentes/onboarding/SetupWizard'

function AppLayout() {
  const location = useLocation()
  const { toggleAberto } = useIaStore()
  const initAppData = useAppDataStore((s) => s.init)
  const invalidate = useAppDataStore((s) => s.invalidate)
  const [showWizard, setShowWizard] = useState(false)

  // Carrega entidades globais ao abrir o app
  useEffect(() => {
    initAppData()
  }, [initAppData])

  // Verifica onboarding no primeiro boot
  useEffect(() => {
    window.electron.ipcRenderer
      .invoke('config.get', { key: 'onboarding_complete' })
      .then((result: { key: string; value: string } | null) => {
        if (!result || result.value === '"false"' || result.value === 'false') {
          setShowWizard(true)
        }
      })
      .catch(() => setShowWizard(true))
  }, [])

  // Listener de invalidacao — main process notifica quando dados mudam
  useEffect(() => {
    const cleanup = window.electron.ipcRenderer.on(
      'data:invalidated',
      (payload: { entidades: string[] }) => {
        invalidate(payload.entidades)
      },
    )
    return cleanup
  }, [invalidate])

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
      {/* Tour é uma engine ISOLADA do Setup: on-demand, sem auto-abrir no boot
          e sem flag de conclusão. O gate de 1º boot continua sendo só o
          onboarding_complete do Setup. */}
      <OnboardingTourProvider steps={flowkitTourSteps}>
        <AppSidebar onReopenSetup={() => setShowWizard(true)} />
        <SidebarInset className="h-full min-h-0 overflow-hidden">
          <div className="flex min-h-0 flex-1">
            <main className="min-h-0 flex-1 min-w-0 overflow-auto">
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </main>
            {location.pathname !== '/ia' && <IaChatPanel />}
          </div>
        </SidebarInset>
        {/* WizardComTour vive DENTRO do provider para poder chamar startTour
            na emenda "Ver como funciona". showWizard segue no AppLayout. */}
        {showWizard && (
          <WizardComTour onClose={() => setShowWizard(false)} />
        )}
      </OnboardingTourProvider>
    </SidebarProvider>
  )
}

/**
 * Consumidor fino do provider: liga o Setup ao Tour. O botão "Ver como
 * funciona" só dispara o tour DEPOIS de fechar o wizard (senão o tour abriria
 * atrás do modal Radix, com a sidebar inerte).
 */
function WizardComTour({ onClose }: { onClose: () => void }) {
  const { startTour } = useOnboardingTour()
  return (
    <SetupWizard
      onComplete={onClose}
      // SetupWizard já chama handleFinish (grava onboarding_complete + onClose)
      // antes de disparar onStartTour — aqui só falta iniciar o tour.
      onStartTour={startTour}
    />
  )
}

export const router = createHashRouter([
  { path: '/maia-bar', element: <MaiaBarPagina /> },
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/ia', element: <IaPagina /> },
      { path: '/maia', element: <MaiaPagina /> },
      { path: '/memoria', element: <MemoriaPagina /> },
      { path: '/galeria', element: <GaleriaPagina /> },
      { path: '/terminal', element: <TerminalPagina /> },
      { path: '/configuracoes', element: <ConfiguracoesPagina /> },
      { path: '*', element: <NaoEncontrado /> },
    ],
  },
])
