import { Link } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { ChevronsUpDown, Info, Monitor, Moon, Palette, Settings, Sun } from 'lucide-react'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { APP_DESCRIPTION, APP_ICON } from '@/lib/app-info'
import { useAppVersion } from '@/hooks/useAppVersion'
import { DEMO_ACCOUNT } from '@shared/app-identity'

/**
 * Menu da conta, no rodapé da casca.
 *
 * A navegação lateral é para o fluxo do caso — encaminhamento, triagem, agenda,
 * repertório. Configuração e tema não são etapas de fluxo: são ajuste de quem
 * está operando, e ficar com eles na lista faz a lista mentir sobre o que é
 * caminho. Por isso os dois moram aqui dentro.
 *
 * A conta é uma só e é sintética. O rótulo declara isso em vez de simular login,
 * troca de papel ou perfil — o produto não tem cinco contas, tem uma conta que
 * enxerga todas as ferramentas.
 */
const OPCOES_DE_TEMA = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
] as const

export function UserMenu() {
  const { isMobile } = useSidebar()
  const { theme, setTheme } = useTheme()
  const appVersion = useAppVersion()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label="Menu da conta"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <APP_ICON className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{DEMO_ACCOUNT.nome}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {DEMO_ACCOUNT.badge}
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
                  <span className="truncate font-semibold">{DEMO_ACCOUNT.nome}</span>
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
              <DropdownMenuSubContent className="min-w-[150px]">
                {/* Radio de verdade, não três itens soltos: escolher tema é uma
                    escolha entre três, e o leitor de tela precisa ouvir isso. */}
                <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={setTheme}>
                  {OPCOES_DE_TEMA.map((opcao) => (
                    <DropdownMenuRadioItem key={opcao.value} value={opcao.value}>
                      <opcao.icon className="mr-2 size-4 shrink-0" aria-hidden="true" />
                      <span>{opcao.label}</span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuItem asChild>
              <Link to="/configuracoes">
                <Settings />
                <span>Configurações</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem disabled className="flex flex-col items-start gap-0.5 opacity-70">
              <div className="flex items-center gap-2">
                <Info />
                <span>Sobre</span>
              </div>
              <span className="pl-6 text-xs text-muted-foreground">
                {appVersion ? `Antessala v${appVersion} — Desktop` : 'Antessala — Desktop'}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
