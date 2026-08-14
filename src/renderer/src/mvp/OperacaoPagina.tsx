import { useEffect, useState, type FormEvent } from 'react'
import { CalendarCheck, ClipboardPlus, LogOut, Play, RefreshCw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { PageHeader } from '@/componentes/PageHeader'
import { client } from '@/servicos/client'
import { useAuth } from './AuthProvider'

type CaseItem = Awaited<ReturnType<typeof client['mvp.cases.list']>>[number]
type SlotItem = Awaited<ReturnType<typeof client['mvp.slots.listCompatible']>>[number]

const STATUS_LABELS: Record<string, string> = {
  WAITING_NURSING: 'Aguardando enfermagem',
  NURSING_IN_PROGRESS: 'Entrevista em andamento',
  TRIAGE_PENDING: 'Triagem incompleta',
  READY_FOR_SCHEDULING: 'Pronto para agendar',
  SCHEDULED: 'Agendado',
  WAITING_ANESTHESIA: 'Aguardando anestesiologista',
  IN_ASSESSMENT: 'Em avaliação',
  PENDING: 'Com pendência',
  WAITING_RETURN: 'Aguardando retorno',
  READY_FOR_HANDOFF: 'Resultado disponível',
  DELIVERED_TO_REQUESTER: 'Recebido pelo solicitante',
}

export function OperacaoPagina() {
  const { session, logout } = useAuth()
  const [cases, setCases] = useState<CaseItem[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    try {
      setCases(await client['mvp.cases.list']())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao carregar casos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [session?.role])
  if (!session) return null

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader breadcrumbs={[{ label: 'Antessala' }, { label: session.name }]} />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{session.name}</h1>
              <Badge>{session.role}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Você vê apenas a etapa que precisa executar agora.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className="size-4" /> Atualizar
            </Button>
            <Button variant="ghost" onClick={() => void logout()}>
              <LogOut className="size-4" /> Sair
            </Button>
          </div>
        </header>

        {session.role === 'RECEPCAO' && <ReceptionPanel cases={cases} refresh={refresh} />}
        {session.role === 'ENFERMAGEM' && <NursingPanel cases={cases} refresh={refresh} />}
        {session.role === 'ADMIN' && <AdminPanel />}
        {session.role === 'ANESTESIOLOGISTA' && <PlaceholderPanel title="Avaliações" cases={cases} />}
        {session.role === 'SOLICITANTE' && <PlaceholderPanel title="Resultados do serviço" cases={cases} />}
      </div>
    </div>
  )
}

function CaseCard({ item, children }: { item: CaseItem; children?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{item.personName}</CardTitle>
            <CardDescription>{item.displayCode} · {item.procedure}</CardDescription>
          </div>
          <Badge variant="outline">{STATUS_LABELS[item.status] ?? item.status}</Badge>
        </div>
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
    </Card>
  )
}

function ReceptionPanel({ cases, refresh }: { cases: CaseItem[]; refresh: () => Promise<void> }) {
  const [form, setForm] = useState({
    personName: 'Marina Lopes', sex: 'F', age: '71', procedure: 'Endoscopia digestiva',
    requesterService: 'Gastroenterologia', externalReference: 'GASTRO-42',
  })
  const [slots, setSlots] = useState<Record<string, SlotItem[]>>({})

  async function create(event: FormEvent) {
    event.preventDefault()
    await client['mvp.cases.create']({ ...form, age: Number(form.age), externalReference: form.externalReference || null })
    toast.success('Encaminhamento registrado. A enfermagem já pode chamar a pessoa.')
    await refresh()
  }

  async function loadSlots(caseId: string) {
    setSlots((current) => ({ ...current, [caseId]: [] }))
    const result = await client['mvp.slots.listCompatible']({ caseId })
    setSlots((current) => ({ ...current, [caseId]: result }))
  }

  async function book(caseId: string, slotId: string) {
    await client['mvp.bookings.confirm']({ caseId, slotId })
    toast.success('Vaga compatível reservada.')
    await refresh()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <CardHeader><CardTitle>Novo encaminhamento</CardTitle><CardDescription>Cada papel abre um caso autônomo — nunca um paciente longitudinal.</CardDescription></CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={(event) => void create(event)}>
            {[
              ['personName', 'Nome'], ['age', 'Idade'], ['procedure', 'Procedimento'],
              ['requesterService', 'Serviço solicitante'], ['externalReference', 'Referência externa'],
            ].map(([key, label]) => <div key={key} className="grid gap-1.5"><Label htmlFor={key}>{label}</Label><Input id={key} value={form[key as keyof typeof form]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></div>)}
            <div className="grid gap-1.5"><Label htmlFor="sex">Sexo</Label><Input id="sex" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })} /></div>
            <Button type="submit"><ClipboardPlus className="size-4" /> Registrar e encaminhar</Button>
          </form>
        </CardContent>
      </Card>
      <section className="grid content-start gap-3">
        <h2 className="font-semibold">Minha fila operacional</h2>
        {cases.length === 0 && <p className="text-sm text-muted-foreground">Nenhum caso exige ação da recepção.</p>}
        {cases.map((item) => <CaseCard key={item.id} item={item}>
          {item.status === 'READY_FOR_SCHEDULING' && <div className="grid gap-2">
            <Button variant="outline" onClick={() => void loadSlots(item.id)}><CalendarCheck className="size-4" /> Encontrar vagas compatíveis</Button>
            {(slots[item.id] ?? []).map((slot) => <Button key={slot.id} variant="secondary" onClick={() => void book(item.id, slot.id)}>{new Date(slot.startsAt).toLocaleString('pt-BR')} · {slot.slotClass}</Button>)}
          </div>}
        </CaseCard>)}
      </section>
    </div>
  )
}

function NursingPanel({ cases, refresh }: { cases: CaseItem[]; refresh: () => Promise<void> }) {
  const [draft, setDraft] = useState({ cardiovascular: false, respiratory: false, allergy: false, accommodation: false, medications: 0 })
  async function start(caseId: string) { await client['mvp.cases.startNursing']({ caseId }); await refresh() }
  async function submit(caseId: string) {
    const source = 'PATIENT_REPORT' as const
    const result = await client['mvp.triage.submit']({ caseId, answers: {
      allergy: { state: 'ANSWERED', value: draft.allergy, source },
      cardiovascular: { state: 'ANSWERED', value: draft.cardiovascular, source },
      respiratory: { state: 'ANSWERED', value: draft.respiratory, source },
      medicationsCount: { state: 'ANSWERED', value: draft.medications, source },
      accommodations: { state: 'ANSWERED', value: draft.accommodation, source: 'PROFESSIONAL_OBSERVATION' },
    } })
    toast.info(`${result.slotClass} · ${result.minutes} min — ${result.explanation}`)
    await client['mvp.requirements.confirm']({ caseId, decision: 'CONFIRM', reason: null })
    toast.success('Necessidade confirmada e publicada para a recepção.')
    await refresh()
  }
  return <section className="grid gap-3">
    <div><h2 className="font-semibold">Entrevistas de enfermagem</h2><p className="text-sm text-muted-foreground">A regra sugere tempo; você confirma antes da recepção enxergar.</p></div>
    {cases.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pessoa aguardando entrevista.</p>}
    {cases.map((item) => <CaseCard key={item.id} item={item}>
      {item.status === 'WAITING_NURSING' ? <Button onClick={() => void start(item.id)}><Play className="size-4" /> Iniciar entrevista</Button> : <div className="grid gap-3">
        {[['allergy','Alergia relatada'],['cardiovascular','Sinal cardiovascular'],['respiratory','Sinal respiratório'],['accommodation','Precisa de acomodação']].map(([key,label]) => <label key={key} className="flex items-center gap-2 text-sm"><Checkbox checked={draft[key as keyof typeof draft] as boolean} onCheckedChange={(value) => setDraft({ ...draft, [key]: value === true })} />{label}</label>)}
        <div className="grid gap-1.5"><Label>Quantidade de medicamentos</Label><Input type="number" min={0} value={draft.medications} onChange={(e) => setDraft({ ...draft, medications: Number(e.target.value) })} /></div>
        <Button onClick={() => void submit(item.id)}><ShieldCheck className="size-4" /> Submeter e confirmar necessidade</Button>
      </div>}
    </CaseCard>)}
  </section>
}

function AdminPanel() {
  const [users, setUsers] = useState<Awaited<ReturnType<typeof client['mvp.users.list']>>>([])
  useEffect(() => { void client['mvp.users.list']().then(setUsers) }, [])
  return <section className="grid gap-3"><h2 className="font-semibold">Contas da demonstração</h2>{users.map((user) => <Card key={user.userId}><CardContent className="flex items-center justify-between p-4"><div><p className="font-medium">{user.name}</p><p className="text-sm text-muted-foreground">{user.email}</p></div><Badge variant="outline">{user.role}</Badge></CardContent></Card>)}</section>
}

function PlaceholderPanel({ title, cases }: { title: string; cases: CaseItem[] }) {
  return <section className="grid gap-3"><h2 className="font-semibold">{title}</h2>{cases.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum caso exige sua ação agora.</p> : cases.map((item) => <CaseCard key={item.id} item={item} />)}</section>
}
