import { useMemo, useState, type ReactNode } from 'react'
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
 *
 * Composição: o formulário anda em três blocos numerados, cada um aberto por
 * uma régua que atravessa a coluna. O ritmo é o mesmo nos três, então a leitura
 * desce sem tropeço. A direita é um só cartão dividido por hairlines de ponta a
 * ponta — identidade, caso, próximo passo, ação — sem caixa dentro de caixa.
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

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
          {/* ── formulário ── */}
          <div className="space-y-8">
            <Bloco numero="01" titulo="Identificação">
              <CampoForm largura="cheia">
                <Label htmlFor="nome">Nome completo</Label>
                <Input
                  id="nome"
                  value={form.nome}
                  placeholder="Como consta no documento"
                  onChange={(e) => set('nome')(e.target.value)}
                />
              </CampoForm>
              <CampoForm>
                {/* A idade mora na linha do rótulo: aparece sem empurrar o campo. */}
                <div className="flex items-baseline justify-between gap-2">
                  <Label htmlFor="nascimento">Data de nascimento</Label>
                  {idade !== null && (
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {idade} anos
                    </span>
                  )}
                </div>
                <Input
                  id="nascimento"
                  type="date"
                  /* o seletor nativo segue o tema: sem isto o ícone some no escuro */
                  className="[color-scheme:light] dark:[color-scheme:dark]"
                  value={form.nascimento}
                  onChange={(e) => set('nascimento')(e.target.value)}
                />
              </CampoForm>
              <CampoForm>
                <Label htmlFor="sexo">Sexo</Label>
                <Select value={form.sexo} onValueChange={set('sexo')}>
                  <SelectTrigger id="sexo" className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="F">Feminino</SelectItem>
                    <SelectItem value="M">Masculino</SelectItem>
                  </SelectContent>
                </Select>
              </CampoForm>
            </Bloco>

            <Bloco numero="02" titulo="Procedimento indicado">
              <CampoForm>
                <Label htmlFor="procedimento">Procedimento</Label>
                <Select value={form.procedimento} onValueChange={set('procedimento')}>
                  <SelectTrigger id="procedimento" className="w-full">
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
              </CampoForm>
              <CampoForm>
                <Label htmlFor="lateralidade">Lateralidade</Label>
                <Select value={form.lateralidade} onValueChange={set('lateralidade')}>
                  <SelectTrigger id="lateralidade" className="w-full">
                    <SelectValue placeholder="Não se aplica" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Direita">Direita</SelectItem>
                    <SelectItem value="Esquerda">Esquerda</SelectItem>
                    <SelectItem value="Bilateral">Bilateral</SelectItem>
                    <SelectItem value="Não se aplica">Não se aplica</SelectItem>
                  </SelectContent>
                </Select>
              </CampoForm>
            </Bloco>

            <Bloco numero="03" titulo="Origem do encaminhamento">
              <CampoForm>
                <Label htmlFor="servico">Serviço solicitante</Label>
                <Select value={form.servico} onValueChange={set('servico')}>
                  <SelectTrigger id="servico" className="w-full">
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
              </CampoForm>
              <CampoForm>
                <Label htmlFor="medico">Profissional solicitante</Label>
                <Input
                  id="medico"
                  value={form.medico}
                  placeholder="Nome e registro no conselho"
                  onChange={(e) => set('medico')(e.target.value)}
                />
              </CampoForm>
              <CampoForm largura="cheia">
                <div className="flex items-baseline justify-between gap-2">
                  <Label htmlFor="observacao">Observação do encaminhamento</Label>
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
                    opcional
                  </span>
                </div>
                <Textarea
                  id="observacao"
                  rows={3}
                  value={form.observacao}
                  placeholder="Somente o que veio escrito no encaminhamento. Não registre avaliação clínica aqui."
                  onChange={(e) => set('observacao')(e.target.value)}
                />
              </CampoForm>
            </Bloco>
          </div>

          {/* ── resumo vivo ── */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
                <Rotulo>O caso que será aberto</Rotulo>
                <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                  {preenchidos.length} / {OBRIGATORIOS.length}
                </span>
              </div>
              {/* Régua de preenchimento: o contador acima, medido. */}
              <div className="h-px bg-border">
                <div
                  className="h-full bg-foreground transition-[width] duration-300"
                  style={{ width: `${(preenchidos.length / OBRIGATORIOS.length) * 100}%` }}
                />
              </div>

              <div className="flex items-center gap-3 px-5 py-4">
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

              <div className="border-t px-5 py-3">
                <Resumo rotulo="Procedimento" valor={form.procedimento} />
                <Resumo rotulo="Lateralidade" valor={form.lateralidade} />
                <Resumo rotulo="Serviço" valor={form.servico} />
                <Resumo rotulo="Solicitante" valor={form.medico} />
              </div>

              <div className="border-t bg-muted/30 px-5 py-4">
                <Rotulo>Próximo passo</Rotulo>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  O caso entra na fila da enfermagem como{' '}
                  <span className="font-mono text-[11px] text-foreground">AGUARDA_ENFERMAGEM</span>.
                  A duração da consulta só existe depois da entrevista.
                </p>
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

/** Bloco do formulário: número, rótulo e régua até a margem. */
function Bloco({
  numero,
  titulo,
  children,
}: {
  numero: string
  titulo: string
  children: ReactNode
}) {
  return (
    <section>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground/60">
          {numero}
        </span>
        <Rotulo>{titulo}</Rotulo>
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>
      <div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

/** Campo do formulário. `flex` em vez de `grid` para o controle não esticar. */
function CampoForm({
  largura,
  children,
}: {
  largura?: 'cheia'
  children: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-2', largura === 'cheia' && 'sm:col-span-2')}>
      {children}
    </div>
  )
}

/**
 * Linha do resumo em três colunas fixas: marca, rótulo e valor. Colunas reais
 * em vez de linha pontilhada — o nome longo de um procedimento quebra em duas
 * linhas em vez de virar reticências.
 */
function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  const vazio = !valor.trim()
  return (
    <div className="grid grid-cols-[14px_82px_minmax(0,1fr)] items-baseline gap-x-2 py-[5px]">
      <span aria-hidden>
        {!vazio && <Check className="size-3 translate-y-[1px] text-success" />}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        {rotulo}
      </span>
      <span
        className={cn(
          'text-[13px] leading-snug',
          vazio ? 'text-muted-foreground/50' : 'font-medium',
        )}
      >
        {vazio ? '—' : valor}
      </span>
    </div>
  )
}
