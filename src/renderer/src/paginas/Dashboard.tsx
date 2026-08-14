import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PageHeader } from '@/componentes/PageHeader'
import { useAppVersion } from '@/hooks/useAppVersion'
import { APP_DESCRIPTION, APP_NAME } from '@/lib/app-info'

/**
 * Superfície neutra enquanto o contrato operacional está em descoberta.
 *
 * Não antecipa papéis, widgets, decisão clínica nem arquitetura de agenda.
 */
export function Dashboard() {
  const appVersion = useAppVersion()

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader breadcrumbs={[{ label: APP_NAME }]} />

      <div className="flex w-full max-w-3xl flex-col gap-6 p-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{APP_NAME}</h1>
            {appVersion && (
              <Badge variant="outline" className="font-mono text-xs">
                v{appVersion}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{APP_DESCRIPTION}</p>
        </div>

        <Card data-testid="dashboard-skeleton">
          <CardHeader>
            <CardTitle>Estrutura inicial</CardTitle>
            <CardDescription>
              A fundação técnica está pronta; o produto clínico aguarda validação do Analyst.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Nenhum papel, widget, protocolo ou modelo de agenda é definido nesta tela.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
