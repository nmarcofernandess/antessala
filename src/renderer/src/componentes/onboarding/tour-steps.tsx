import { APP_NAME } from '@/lib/app-info'
import type { TourStep } from './OnboardingTour'

/**
 * IDs estáveis dos elementos reais que o tour destaca. Todos vivem sempre
 * montados na sidebar (não dentro de dropdown fechado, nem em conteúdo de rota)
 * — por isso o tour é determinístico, sem onEnter/navegação e sem flake.
 * AppSidebar consome essas mesmas constantes ao plantar os ids.
 */
export const TOUR_STEP_IDS = {
  SIDEBAR_HEADER: 'tour-sidebar-header',
  NAV_MEMORIA: 'tour-nav-memoria',
  NAV_IA: 'tour-nav-ia',
  NAV_GALERIA: 'tour-nav-galeria',
  NAV_CONFIGURACOES: 'tour-nav-configuracoes',
  FOOTER_MENU: 'tour-footer-menu',
} as const

/**
 * Passos de ensino do FlowKit. O conteúdo é específico do produto; a engine
 * (OnboardingTour) é genérica e recebe esta lista por prop.
 */
export const flowkitTourSteps: TourStep[] = [
  {
    targetId: TOUR_STEP_IDS.SIDEBAR_HEADER,
    position: 'right',
    content: (
      <>
        <h3 className="font-semibold">Bem-vindo ao {APP_NAME}!</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Um tour rápido pelas áreas principais. Em menos de um minuto você sabe
          onde fica cada coisa — pode pular quando quiser.
        </p>
      </>
    ),
  },
  {
    targetId: TOUR_STEP_IDS.NAV_MEMORIA,
    position: 'right',
    content: (
      <>
        <h3 className="font-semibold">Memória</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          O cérebro do app. Importe documentos (.md, .txt, .pdf, exportações de
          chat) para a base RAG, gerencie memórias e explore o grafo de
          conhecimento que conecta tudo.
        </p>
      </>
    ),
  },
  {
    targetId: TOUR_STEP_IDS.NAV_IA,
    position: 'right',
    content: (
      <>
        <h3 className="font-semibold">Assistente IA</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Converse com a IA. Ela consulta sua base de conhecimento, lembra do
          contexto e pode executar ações. Em qualquer página, use{' '}
          <strong>Cmd+J</strong> para abrir o chat lateral.
        </p>
      </>
    ),
  },
  {
    targetId: TOUR_STEP_IDS.NAV_GALERIA,
    position: 'right',
    content: (
      <>
        <h3 className="font-semibold">Galeria</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Guarde imagens com tags e favoritos. Faça upload, filtre e abra o
          detalhe de cada item.
        </p>
      </>
    ),
  },
  {
    targetId: TOUR_STEP_IDS.NAV_CONFIGURACOES,
    position: 'right',
    content: (
      <>
        <h3 className="font-semibold">Configurações</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          É aqui que você ajusta a <strong>IA</strong> (provedor, chave ou modelo
          local), tema, backup e o resto. Se algo de IA precisar de chave, é por
          aqui que se resolve.
        </p>
      </>
    ),
  },
  {
    targetId: TOUR_STEP_IDS.FOOTER_MENU,
    position: 'right',
    content: (
      <>
        <h3 className="font-semibold">Menu da conta</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Aqui ficam o <strong>tema</strong>, o atalho de Configurações e, para
          revisitar quando quiser, o <strong>Setup</strong> e este{' '}
          <strong>Como funciona</strong>. Pronto — bom trabalho!
        </p>
      </>
    ),
  },
]
