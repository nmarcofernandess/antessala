import { useMemo, useState } from 'react'
import { ArrowRight, Check, ClipboardPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/componentes/PageHeader'
import { cn } from '@/lib/utils'
import { PROCEDIMENTOS, SERVICOS, iniciais } from '@/vitrine/dados'
import { CarimboSintetico, Rotulo, TituloTela } from '@/vitrine/pecas'

type Campo = 'nome' | 'nascimento' | 'sexo' | 'procedimento' | 'servico' | 'medico'

const OBRIGATORIOS: Campo[] = ['nome', 'nascimento', 'sexo', 'procedimento', 'servico', 'medico']

/**
 * S02 — Entrada do encaminhamento.
 *
 * Cada encaminhamento abre um caso autônomo: não existe paciente longitudinal,
 * e é por isso que a coluna da direita mostra o caso, não um prontuário.
 */
export function CadastroPagina() {
  const [form, setForm] = useState<Record<Campo | 'observacao' | 'lateralidade', string>>({
    nome: '',
    nascimento: '',
    sexo: '',
    procedimento: '',
    servico: '',
    medico: '',
    lateralidade: '',
    observacao: '',
  })

  const set = (c: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [c]: v }))

  const preenchidos = OBRIGATORIOS.filter((c) => form[c].trim().length > 0)
  const completo = preenchidos.length === OBRIGATORIOS.length

  const idade = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.nascimento)) return null
    const n = new Date(form.nascimento)
    if (Number.isNaN(n.getTime())) return null
    const hoje = new Date('2026-08-14T12:00:00')
    let a = hoje.getFullYear() - n.getFullYear()
    const m = hoje.getMonth() - n.getMonth()
    if (m < 0 || (m === 0 && hoje.getDate() < n.getDate())) a--
    return a >= 0 && a < 130 ? a : null
  }, [form.nascimento])

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader breadcrumbs={[{ label: 'Antessala' }, { label: 'Novo encaminhamento' }]} />

      <div className="mx-auto w-full max-w-6xl p-6 lg:p-8">
        <TituloTela
          rotulo="Recepção · S02"
          titulo="Novo encaminhamento"
          apoio="Cada encaminhamento abre um caso autônomo. O sistema não mantém paciente longitudinal, não deduplica por pessoa e não consulta atendimento anterior."
          acao={<CarimboSintetico />}
        />

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* ── formulário ── */}
          <div className="space-y-9">
            <section>
              <Rotulo>Identificação</Rotulo>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input
                    id="nome"
                    value={form.nome}
                    placeholder="Como consta no documento"
                    onChange={(e) => set('nome')(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nascimento">Data de nascimento</Label>
                  <Input
                    id="nascimento"
                    type="date"
                    value={form.nascimento}
                    onChange={(e) => set('nascimento')(e.target.value)}
                  />
                  <span className="h-4 font-mono text-[11px] text-muted-foreground">
                    {idade !== null ? `${idade} anos` : ''}
                  </span>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sexo">Sexo</Label>
                  <Select value={form.sexo} onValueChange={set('sexo')}>
                    <SelectTrigger id="sexo">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="F">Feminino</SelectItem>
                      <SelectItem value="M">Masculino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section>
              <Rotulo>Procedimento indicado</Rotulo>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="procedimento">Procedimento</Label>
                  <Select value={form.procedimento} onValueChange={set('procedimento')}>
                    <SelectTrigger id="procedimento">
                      <SelectValue placeholder="Buscar no catálogo" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROCEDIMENTOS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lateralidade">Lateralidade</Label>
                  <Select value={form.lateralidade} onValueChange={set('lateralidade')}>
                    <SelectTrigger id="lateralidade">
                      <SelectValue placeholder="Não se aplica" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Direita">Direita</SelectItem>
                      <SelectItem value="Esquerda">Esquerda</SelectItem>
                      <SelectItem value="Bilateral">Bilateral</SelectItem>
                      <SelectItem value="Não se aplica">Não se aplica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="servico">Serviço solicitante</Label>
                  <Select value={form.servico} onValueChange={set('servico')}>
                    <SelectTrigger id="servico">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICOS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="medico">Profissional solicitante</Label>
                  <Input
                    id="medico"
                    value={form.medico}
                    placeholder="Nome e registro no conselho"
                    onChange={(e) => set('medico')(e.target.value)}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="observacao">
                    Observação do encaminhamento{' '}
                    <span className="font-normal text-muted-foreground">· opcional</span>
                  </Label>
                  <Textarea
                    id="observacao"
                    rows={3}
                    value={form.observacao}
                    placeholder="Somente o que veio escrito no encaminhamento. Não registre avaliação clínica aqui."
                    onChange={(e) => set('observacao')(e.target.value)}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* ── resumo vivo ── */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-xl border bg-card">
              <div className="flex items-center justify-between border-b px-5 py-3.5">
                <Rotulo>O caso que será aberto</Rotulo>
                <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                  {preenchidos.length} / {OBRIGATORIOS.length}
                </span>
              </div>

              <div className="space-y-5 px-5 py-5">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'grid size-11 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors',
                      form.nome ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
                    )}
                    aria-hidden
                  >
                    {form.nome ? iniciais(form.nome) : '—'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {form.nome || <span className="text-muted-foreground">Sem identificação</span>}
                    </p>
                    <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {idade !== null ? `${idade} anos` : '— anos'}
                      {form.sexo ? ` · ${form.sexo}` : ''}
                    </p>
                  </div>
                </div>

                <div className="space-y-0.5 text-sm">
                  <Resumo rotulo="Procedimento" valor={form.procedimento} />
                  <Resumo rotulo="Lateralidade" valor={form.lateralidade} />
                  <Resumo rotulo="Serviço" valor={form.servico} />
                  <Resumo rotulo="Solicitante" valor={form.medico} />
                </div>

                <div className="rounded-lg border border-dashed px-4 py-3">
                  <Rotulo>Próximo passo</Rotulo>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    O caso entra na fila da enfermagem como{' '}
                    <span className="font-mono text-[11px] text-foreground">AGUARDA_ENFERMAGEM</span>.
                    A duração da consulta só existe depois da entrevista.
                  </p>
                </div>
              </div>

              <div className="border-t px-5 py-4">
                <Button className="w-full" disabled={!completo}>
                  {completo ? (
                    <>
                      Abrir caso <ArrowRight className="size-4" />
                    </>
                  ) : (
                    <>
                      <ClipboardPlus className="size-4" /> Complete os campos obrigatórios
                    </>
                  )}
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  const vazio = !valor.trim()
  return (
    <div className="flex items-baseline gap-3 border-t py-2 first:border-t-0">
      <span className="shrink-0 text-xs text-muted-foreground">{rotulo}</span>
      <span className="mt-[-3px] min-w-4 flex-1 border-b border-dotted border-border" aria-hidden />
      <span
        className={cn(
          'flex min-w-0 items-center gap-1.5 text-right text-[13px]',
          vazio ? 'text-muted-foreground/60' : 'font-medium',
        )}
      >
        {!vazio && <Check className="size-3 shrink-0 text-success" />}
        <span className="truncate">{vazio ? '—' : valor}</span>
      </span>
    </div>
  )
}
