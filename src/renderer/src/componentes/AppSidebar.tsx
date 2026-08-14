import { Link, useLocation } from 'react-router-dom'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard,
  Monitor,
  Moon,
  Settings,
  Sun,
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
import { cn } from '@/lib/utils'
import { APP_ICON, APP_NAME } from '@/lib/app-info'
import { useAppVersion } from '@/hooks/useAppVersion'
import { useAuth } from '@/mvp/AuthProvider'

export const ACTIVE_NAV_ITEMS = [
  { label: 'Operação', to: '/', icon: LayoutDashboard, roles: ['ADMIN','RECEPCAO','ENFERMAGEM','ANESTESIOLOGISTA','SOLICITANTE'] },
  { label: 'Configurações', to: '/configuracoes', icon: Settings, roles: ['ADMIN'] },
] as const

const THEME_OPTIONS = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
] as const

/** Seletor sempre visível no canto inferior da casca. */
export function ThemeSelector() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex flex-col gap-1.5">
      <span className="px-1 text-xs font-medium text-sidebar-foreground/70 group-data-[collapsible=icon]:sr-only">
        Tema
      </span>
      <div
        role="radiogroup"
        aria-label="Tema da interface"
        className="grid grid-cols-3 gap-1 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-1 group-data-[collapsible=icon]:grid-cols-1"
      >
        {THEME_OPTIONS.map((option) => {
          const selected = theme === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`Tema ${option.label.toLowerCase()}`}
              title={option.label}
              onClick={() => setTheme(option.value)}
              className={cn(
                'flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-xs transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                'group-data-[collapsible=icon]:px-0',
                selected
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <option.icon className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate group-data-[collapsible=icon]:sr-only">
                {option.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function AppSidebar() {
  const { pathname } = useLocation()
  const appVersion = useAppVersion()
  const { session } = useAuth()

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
              {ACTIVE_NAV_ITEMS.filter((item) => session && (item.roles as readonly string[]).includes(session.role)).map((item) => (
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
        {session && <div className="px-1 text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden"><p className="font-medium text-sidebar-foreground">{session.name}</p><p>{session.role}</p></div>}
        <ThemeSelector />
      </SidebarFooter>
    </Sidebar>
  )
}
