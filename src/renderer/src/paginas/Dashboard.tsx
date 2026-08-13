import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Database,
  FileText,
  Network,
  Brain,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowRight,
  Settings,
  Upload,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/componentes/PageHeader'
import { useAppVersion } from '@/hooks/useAppVersion'
import { APP_NAME, APP_DESCRIPTION } from '@/lib/app-info'
import { cn } from '@/lib/utils'

/* ---------- types ---------- */

type SystemStatusItem = {
  label: string
  status: 'ok' | 'warn' | 'error'
  detail: string
}

/* ---------- helpers ---------- */

const STAT_CARDS = [
  { label: 'Fontes', icon: Database, value: 0 },
  { label: 'Fragmentos', icon: FileText, value: 0 },
  { label: 'Entidades', icon: Network, value: 0 },
  { label: 'Memorias', icon: Brain, value: 0 },
] as const

function StatusBadge({ status }: { status: 'ok' | 'warn' | 'error' }) {
  if (status === 'ok') {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
        <CheckCircle2 className="size-3.5" />
        Conectado
      </span>
    )
  }
  if (status === 'warn') {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
        <AlertCircle className="size-3.5" />
        Pendente
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs text-destructive">
      <XCircle className="size-3.5" />
      Indisponivel
    </span>
  )
}

/* ---------- component ---------- */

export function Dashboard() {
  const appVersion = useAppVersion()
  const [systemStatus, setSystemStatus] = useState<SystemStatusItem[]>([
    { label: 'Banco de dados', status: 'ok', detail: 'Conectado' },
    { label: 'Embedding', status: 'warn', detail: 'Verificando...' },
    { label: 'Provedor IA', status: 'warn', detail: 'Verificando...' },
    { label: 'Backup', status: 'warn', detail: 'Verificando...' },
  ])

  // Check system state on mount
  useEffect(() => {
    async function checkStatus() {
      const next: SystemStatusItem[] = [
        { label: 'Banco de dados', status: 'ok', detail: 'Conectado' },
        { label: 'Embedding', status: 'ok', detail: 'Pronto' },
        { label: 'Provedor IA', status: 'warn', detail: 'Nao configurado' },
        { label: 'Backup', status: 'warn', detail: 'Nenhum backup' },
      ]

      try {
        const iaConfig = await window.electron.ipcRenderer.invoke('ia.configuracao.obter') as any
        if (iaConfig?.provider && (iaConfig?.api_key || iaConfig?.provider === 'local')) {
          next[2] = { label: 'Provedor IA', status: 'ok', detail: iaConfig.provider }
        }
      } catch {
        next[2] = { label: 'Provedor IA', status: 'error', detail: 'Erro ao verificar' }
      }

      try {
        const backupConfig = await window.electron.ipcRenderer.invoke('backup.config.obter') as any
        if (backupConfig?.ultimo_backup) {
          const date = new Date(backupConfig.ultimo_backup).toLocaleDateString('pt-BR')
          next[3] = { label: 'Backup', status: 'ok', detail: date }
        }
      } catch {
        next[3] = { label: 'Backup', status: 'error', detail: 'Erro ao verificar' }
      }

      setSystemStatus(next)
    }

    checkStatus()
  }, [])

  const sourcesCount = 0 // Will be wired to IPC in Spec 2

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader breadcrumbs={[{ label: APP_NAME }]} />

      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {APP_DESCRIPTION}
            {appVersion && (
              <Badge variant="outline" className="ml-2 text-xs font-mono">
                v{appVersion}
              </Badge>
            )}
          </p>
        </div>

        {/* Stat cards — 2x2 grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STAT_CARDS.map(({ label, icon: Icon, value }) => (
            <Card key={label}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* System status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Status do sistema</CardTitle>
            <CardDescription>Estado atual dos servicos internos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {systemStatus.map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    'flex items-center justify-between rounded-lg border px-4 py-3',
                    item.status === 'ok' && 'border-green-500/20 bg-green-500/5',
                    item.status === 'warn' && 'border-amber-500/20 bg-amber-500/5',
                    item.status === 'error' && 'border-destructive/20 bg-destructive/5',
                  )}
                >
                  <span className="text-sm font-medium">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{item.detail}</span>
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Proximos passos — only when sources = 0 */}
        {sourcesCount === 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Proximos passos</CardTitle>
              <CardDescription>Comece configurando o sistema</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Link
                to="/configuracoes"
                className="group flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-accent"
              >
                <div className="flex items-center gap-3">
                  <Settings className="size-4 text-muted-foreground" />
                  <span className="text-sm">Configure sua IA em Configuracoes</span>
                </div>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/memoria"
                className="group flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-accent"
              >
                <div className="flex items-center gap-3">
                  <Upload className="size-4 text-muted-foreground" />
                  <span className="text-sm">Importe documentos em Memoria</span>
                </div>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
