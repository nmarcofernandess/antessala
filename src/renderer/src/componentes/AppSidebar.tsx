import { Link, useLocation } from 'react-router-dom'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard,
  Settings,
  BrainCircuit,
  Database,
  ChevronsUpDown,
  Sun,
  Moon,
  Monitor,
  Check,
  Info,
  Palette,
  Image as ImageIcon,
  SquareTerminal,
  Mic,
  Compass,
  Sparkles,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { APP_NAME, APP_DESCRIPTION, APP_ICON, APP_INITIALS } from '@/lib/app-info'
import { useAppVersion } from '@/hooks/useAppVersion'
import { useOnboardingTour } from '@/componentes/onboarding/OnboardingTour'
import { TOUR_STEP_IDS } from '@/componentes/onboarding/tour-steps'

/** Mapeia rota → id de passo do tour (só rotas que o tour destaca). */
const TOUR_ID_BY_ROUTE: Record<string, string> = {
  '/memoria': TOUR_STEP_IDS.NAV_MEMORIA,
  '/ia': TOUR_STEP_IDS.NAV_IA,
  '/galeria': TOUR_STEP_IDS.NAV_GALERIA,
}

const mainNav = [
  { label: 'Painel', to: '/', icon: LayoutDashboard },
  { label: 'Memoria', to: '/memoria', icon: Database },
  { label: 'Assistente IA', to: '/ia', icon: BrainCircuit },
  { label: 'Maia', to: '/maia', icon: Mic },
  { label: 'Galeria', to: '/galeria', icon: ImageIcon },
  { label: 'Terminal', to: '/terminal', icon: SquareTerminal },
]

const configNav = [
  { label: 'Configuracoes', to: '/configuracoes', icon: Settings },
]

const temaOpcoes = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
] as const

interface AppSidebarProps {
  /** Reabre o modal de Setup (item "Setup" do menu da conta). */
  onReopenSetup?: () => void
}

export function AppSidebar({ onReopenSetup }: AppSidebarProps = {}) {
  const { pathname } = useLocation()
  const { isMobile } = useSidebar()
  const { theme, setTheme } = useTheme()
  const appVersion = useAppVersion()
  const { startTour } = useOnboardingTour()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader id={TOUR_STEP_IDS.SIDEBAR_HEADER} className="p-4 group-data-[collapsible=icon]:p-2">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <APP_ICON className="size-4" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
              {APP_NAME}
            </span>
            <span className="text-xs text-sidebar-foreground/50">
              {appVersion ? `v${appVersion}` : ''}
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.label} id={TOUR_ID_BY_ROUTE[item.to]}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.to === '/'
                        ? pathname === '/'
                        : pathname.startsWith(item.to)
                    }
                    tooltip={item.label}
                  >
                    <Link to={item.to}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Configuracao</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {configNav.map((item) => (
                <SidebarMenuItem key={item.label} id={TOUR_STEP_IDS.NAV_CONFIGURACOES}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(item.to)}
                    tooltip={item.label}
                  >
                    <Link to={item.to}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem id={TOUR_STEP_IDS.FOOTER_MENU}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <APP_ICON className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {APP_NAME}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {appVersion ? `v${appVersion}` : APP_DESCRIPTION}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 rounded-lg"
                side={isMobile ? 'bottom' : 'right'}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                      <APP_ICON className="size-4" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {APP_NAME}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {APP_DESCRIPTION}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Palette />
                    <span>Tema</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-[140px]">
                    {temaOpcoes.map((opcao) => (
                      <DropdownMenuItem
                        key={opcao.value}
                        onClick={() => setTheme(opcao.value)}
                        className={cn(
                          'flex items-center gap-2',
                          theme === opcao.value && 'bg-accent',
                        )}
                      >
                        <opcao.icon />
                        <span>{opcao.label}</span>
                        {theme === opcao.value && (
                          <Check className="ml-auto text-muted-foreground" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem asChild>
                  <Link to="/configuracoes">
                    <Settings />
                    <span>Configuracoes</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {onReopenSetup && (
                  <DropdownMenuItem onSelect={() => onReopenSetup()}>
                    <Sparkles />
                    <span>Setup</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => startTour()}>
                  <Compass />
                  <span>Como funciona</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="flex flex-col items-start gap-0.5 opacity-70">
                  <div className="flex items-center gap-2">
                    <Info />
                    <span>Sobre</span>
                  </div>
                  <span className="pl-6 text-xs text-muted-foreground">
                    {appVersion ? `${APP_NAME} v${appVersion} — Desktop` : `${APP_NAME} — Desktop`}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
