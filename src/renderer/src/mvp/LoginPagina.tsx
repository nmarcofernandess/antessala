import { useState } from 'react'
import { ShieldCheck, Stethoscope } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const ACCOUNTS = [
  { label: 'Administração', email: 'admin@antessala.demo', description: 'Contas, capacidade e auditoria' },
  { label: 'Recepção', email: 'recepcao@antessala.demo', description: 'Encaminhamento, agenda e check-in' },
  { label: 'Enfermagem', email: 'enfermagem@antessala.demo', description: 'Entrevista e necessidade de agenda' },
  { label: 'Anestesiologista', email: 'anestesia@antessala.demo', description: 'Avaliação, pendências e resultado' },
  { label: 'Serviço solicitante', email: 'solicitante@antessala.demo', description: 'Pendências atribuídas e recebimento' },
] as const

export function LoginPagina({
  onLogin,
}: {
  onLogin: (email: string, password: string) => Promise<void>
}) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function enter(email: string) {
    setLoading(email)
    setError(null)
    try {
      await onLogin(email, 'demo123')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <main className="min-h-svh bg-muted/30 p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 py-8">
        <header className="flex flex-col gap-3 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Stethoscope className="size-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Antessala</h1>
            <p className="mt-2 text-muted-foreground">
              Da entrevista de enfermagem à vaga compatível — sem transformar clínica em tarefa da recepção.
            </p>
          </div>
          <div className="flex justify-center gap-2">
            <Badge variant="outline">Demonstração local</Badge>
            <Badge variant="secondary">Dados sintéticos</Badge>
            <Badge variant="secondary">Offline no fluxo-base</Badge>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {ACCOUNTS.map((account) => (
            <Card key={account.email} className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{account.label}</CardTitle>
                <CardDescription>{account.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button
                  className="w-full"
                  variant={account.label === 'Recepção' ? 'default' : 'outline'}
                  disabled={loading !== null}
                  onClick={() => void enter(account.email)}
                  aria-label={`Entrar como ${account.label}`}
                >
                  <ShieldCheck className="size-4" />
                  {loading === account.email ? 'Entrando…' : `Entrar como ${account.label}`}
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>

        {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}
        <p className="text-center text-xs text-muted-foreground">
          Cada botão usa uma conta fixture real no banco local. Não há troca livre de papel dentro da sessão.
        </p>
      </div>
    </main>
  )
}
