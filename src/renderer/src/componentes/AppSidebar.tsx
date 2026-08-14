import { Link, useLocation } from 'react-router-dom'
import {
  Blocks,
  BrainCircuit,
  CalendarDays,
  ClipboardPlus,
  LayoutDashboard,
  Network,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { APP_ICON, APP_NAME } from '@/lib/app-info'
import { useAppVersion } from '@/hooks/useAppVersion'
import { UserMenu } from '@/componentes/UserMenu'

/**
 * A lateral carrega o **fluxo do caso**, e só ele.
 *
 * Configuração e tema saíram daqui para o menu da conta, no rodapé: eles não são
 * etapa do caminho que a demonstração percorre, e ocupar uma linha da navegação
 * com ajuste de operador faz a lista prometer o que não cumpre.
 */
export const ACTIVE_NAV_ITEMS = [
  { label: 'Início', to: '/', icon: LayoutDashboard },
  { label: 'Novo encaminhamento', to: '/casos/novo', icon: ClipboardPlus },
  { label: 'Agenda', to: '/agenda', icon: CalendarDays },
  { label: 'Repertório', to: '/repertorio', icon: Blocks },
  { label: 'Assistente', to: '/assistente', icon: BrainCircuit },
  { label: 'Memória', to: '/memoria', icon: Network },
] as const

export function AppSidebar() {
  const { pathname } = useLocation()
  const appVersion = useAppVersion()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2">
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
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ACTIVE_NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.to}>
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
      </SidebarContent>

      <SidebarSeparator />
      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  )
}
