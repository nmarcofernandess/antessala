import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Loader2, Lock, PlusCircle, Save } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/componentes/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Rotulo } from '@/vitrine/pecas'
import {
  casos,
  encontros as apiEncontros,
  novaChave,
  pendencias as apiPendencias,
  resultados as apiResultados,
} from '@/servicos/casos'
import {
  ROTULO_IMPACTO,
  ROTULO_KIND,
  ROTULO_NARRATIVA,
  ROTULO_PENDENCIA,
  rascunhoVazio,
  type AvaliacaoRascunhoV1,
  type EncounterDTO,
  type NarrativaRascunho,
  type PendencyDTO,
  type PendencyImpact,
  type PendencyKind,
  type ResultadoConteudoV1,
} from '@shared/clinical/avaliacao'
import type { CaseDetailDTO } from '@shared/clinical/caso'

/**
 * A consulta pré-anestésica, do lado de quem a conduz.
 *
 * O que esta tela recusa fazer: transformar a anamnese de enfermagem em
 * avaliação médica. O que a enfermagem coletou aparece no caso; o que se
 * escreve aqui é outra autoria, com outro dono, e por isso nasce em branco.
 *
 * Campo não preenchido não vira negativa: cada narrativa escolhe entre
 * registrado, desconhecido, não se aplica e não realizado. E pendência aberta
 * não trava nada por si — o que trava é o impacto que alguém declarou.
 */
const ATRASO_AUTOSAVE = 600

const ESTADOS_NARRATIVA: NarrativaRascunho['estado'][] = [
  'ANSWERED',
  'UNKNOWN',
  'NOT_APPLICABLE',
  'NOT_PERFORMED',
]

export function CasoAvaliacaoPagina() {
  const { caseId } = useParams<{ caseId: string }>()
  const navegar = useNavigate()

  const [caso, setCaso] = useState<CaseDetailDTO | null>(null)
  const [encontro, setEncontro] = useState<EncounterDTO | null>(null)
  const [lista, setLista] = useState<PendencyDTO[]>([])
  const [bloqueios, setBloqueios] = useState(0)
  const [rascunho, setRascunho] = useState<AvaliacaoRascunhoV1>(rascunhoVazio())
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [agindo, setAgindo] = useState(false)
  const [emitindo, setEmitindo] = useState(false)

  const versao = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const recarregar = useCallback(async () => {
    if (!caseId) return
    try {
      const [detalhe, estado] = await Promise.all([
        casos.obter(caseId),
        apiResultados.doCaso(caseId),
      ])
      setCaso(detalhe)
      setLista(estado.pendencies)
      setBloqueios(estado.blockers)
      if (estado.encounter) {
        setEncontro(estado.encounter)
        versao.current = estado.encounter.version
        if (estado.encounter.assessment.state === 'DRAFT') {
          setRascunho(estado.encounter.assessment)
        }
      }
      setErro(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setCarregando(false)
    }
  }, [caseId])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  const somenteLeitura = encontro?.status === 'COMPLETED'

  const agendarSalvamento = useCallback(
    (proximo: AvaliacaoRascunhoV1) => {
      if (!encontro || somenteLeitura) return
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(async () => {
        setSalvando(true)
        try {
          const atualizado = await apiEncontros.salvar({
            encounterId: encontro.id,
            expectedVersion: versao.current,
            assessment: proximo,
          })
          versao.current = atualizado.version
          setEncontro(atualizado)
          setSalvo(true)
        } catch (e) {
          toast.error(e instanceof Error ? e.message : String(e))
        } finally {
          setSalvando(false)
        }
      }, ATRASO_AUTOSAVE)
    },
    [encontro, somenteLeitura],
  )

  function alterar(mudanca: (atual: AvaliacaoRascunhoV1) => AvaliacaoRascunhoV1) {
    setRascunho((atual) => {
      const proximo = mudanca(atual)
      agendarSalvamento(proximo)
      return proximo
    })
  }

  /** Publica a versão 1 do resultado a partir do que está escrito. */
  async function emitir(content: ResultadoConteudoV1) {
    if (!encontro) return
    setEmitindo(true)
    try {
      if (timer.current) {
        clearTimeout(timer.current)
        const salvoAgora = await apiEncontros.salvar({
          encounterId: encontro.id,
          expectedVersion: versao.current,
          assessment: rascunho,
        })
        versao.current = salvoAgora.version
      }
      await apiResultados.finalizar({
        encounterId: encontro.id,
        expectedEncounterVersion: versao.current,
        content,
        idempotencyKey: novaChave(),
      })
      toast.success('Resultado emitido. O caso está pronto para entrega ao solicitante.')
      navegar(`/casos/${caseId}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
      await recarregar()
    } finally {
      setEmitindo(false)
    }
  }

  async function retomar() {
    if (!encontro) return
    setAgindo(true)
    try {
      const atualizado = await apiEncontros.retomar({
        encounterId: encontro.id,
        expectedVersion: encontro.version,
      })
      setEncontro(atualizado)
      versao.current = atualizado.version
      toast.success('Avaliação retomada.')
      await recarregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setAgindo(false)
    }
  }

  if (carregando) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Abrindo a avaliação…
      </div>
    )
  }

  if (erro || !caso || !encontro) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="max-w-md text-sm text-muted-foreground">
          {erro ?? 'Este caso ainda não tem avaliação aberta.'}
        </p>
        <Button variant="outline" size="sm" onClick={() => navegar(`/casos/${caseId}`)}>
          Voltar ao caso
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        breadcrumbs={[
          { label: 'Antessala' },
          { label: 'Casos' },
          { label: caso.displayCode },
          { label: 'Avaliação' },
        ]}
      />

      <div className="mx-auto w-full max-w-6xl p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">{caso.person.fullName}</h1>
            <p className="text-sm text-muted-foreground">
              {caso.procedure.description} · ciclo de revisão {encontro.reviewCycle}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Autoria desta avaliação: {encontro.responsibleActor.displayName} · a coleta da
              enfermagem tem autoria própria e não é reaproveitada como ato médico.
            </p>
          </div>

          <div className="flex items-center gap-2" data-testid="estado-da-avaliacao">
            {salvando ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Salvando…
              </span>
            ) : somenteLeitura ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3.5" /> Avaliação concluída
              </span>
            ) : salvo ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Save className="size-3.5" /> Rascunho salvo
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* ── avaliação ── */}
          <div className="space-y-5" data-testid="avaliacao-editor">
            {encontro.status === 'WAITING_PENDING' && (
              <div className="rounded-xl border border-dashed px-5 py-4">
                <p className="text-sm font-medium">Avaliação em espera</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {bloqueios > 0
                    ? `${bloqueios} pendência(s) declarada(s) como impeditiva(s) do resultado. Enquanto elas estiverem vivas, a avaliação não segue.`
                    : 'Nenhuma pendência impeditiva em aberto. Dá para retomar a avaliação.'}
                </p>
                <Button
                  className="mt-3"
                  size="sm"
                  disabled={!encontro.canResumeReview || agindo}
                  onClick={retomar}
                  data-testid="retomar-avaliacao"
                >
                  Retomar avaliação
                </Button>
              </div>
            )}

            <Secao titulo="Confirmação" apoio="Quem está na sala é quem o papel diz que é?">
              <div className="grid gap-3 sm:grid-cols-2">
                <Confirmacao
                  rotulo="A pessoa confere"
                  valor={rascunho.confirmacao.pessoaConfere}
                  desabilitado={somenteLeitura}
                  testid="confirma-pessoa"
                  onChange={(v) =>
                    alterar((a) => ({ ...a, confirmacao: { ...a.confirmacao, pessoaConfere: v } }))
                  }
                />
                <Confirmacao
                  rotulo="O procedimento confere"
                  valor={rascunho.confirmacao.procedimentoConfere}
                  desabilitado={somenteLeitura}
                  testid="confirma-procedimento"
                  onChange={(v) =>
                    alterar((a) => ({
                      ...a,
                      confirmacao: { ...a.confirmacao, procedimentoConfere: v },
                    }))
                  }
                />
              </div>
            </Secao>

            <Secao titulo="Entrevista" apoio="O que mudou desde a coleta da enfermagem.">
              <CampoNarrativa
                rotulo="História do intervalo"
                valor={rascunho.entrevista.historiaIntervalo}
                desabilitado={somenteLeitura}
                onChange={(n) =>
                  alterar((a) => ({ ...a, entrevista: { ...a.entrevista, historiaIntervalo: n } }))
                }
              />
              <CampoNarrativa
                rotulo="Sintomas atuais"
                valor={rascunho.entrevista.sintomasAtuais}
                desabilitado={somenteLeitura}
                onChange={(n) =>
                  alterar((a) => ({ ...a, entrevista: { ...a.entrevista, sintomasAtuais: n } }))
                }
              />
            </Secao>

            <Secao titulo="Exame" apoio="O que foi examinado — e o que não foi.">
              <CampoNarrativa
                rotulo="Exame geral"
                valor={rascunho.exame.geral}
                desabilitado={somenteLeitura}
                onChange={(n) => alterar((a) => ({ ...a, exame: { ...a.exame, geral: n } }))}
              />
              <CampoNarrativa
                rotulo="Via aérea"
                valor={rascunho.exame.viaAerea}
                desabilitado={somenteLeitura}
                onChange={(n) => alterar((a) => ({ ...a, exame: { ...a.exame, viaAerea: n } }))}
              />
              <CampoNarrativa
                rotulo="Revisão dos sinais vitais"
                valor={rascunho.exame.revisaoSinaisVitais}
                desabilitado={somenteLeitura}
                onChange={(n) =>
                  alterar((a) => ({ ...a, exame: { ...a.exame, revisaoSinaisVitais: n } }))
                }
              />
              <CampoNarrativa
                rotulo="Achados adicionais"
                valor={rascunho.exame.achadosAdicionais}
                desabilitado={somenteLeitura}
                onChange={(n) =>
                  alterar((a) => ({ ...a, exame: { ...a.exame, achadosAdicionais: n } }))
                }
              />
            </Secao>

            <Secao titulo="Síntese" apoio="O que esta consulta concluiu, com as palavras de quem avaliou.">
              <Textarea
                rows={4}
                aria-label="Síntese da avaliação"
                disabled={somenteLeitura}
                value={rascunho.sintese.resumo ?? ''}
                placeholder="O que ficou desta avaliação."
                onChange={(e) =>
                  alterar((a) => ({ ...a, sintese: { ...a.sintese, resumo: e.target.value } }))
                }
                className="text-[13px] leading-relaxed"
              />
            </Secao>
          </div>

          {/* ── pendências e emissão ── */}
          <aside className="space-y-4">
            <PainelPendencias
              encontro={encontro}
              pendencias={lista}
              somenteLeitura={somenteLeitura}
              onMudou={recarregar}
            />

            <PainelEmissao
              bloqueios={bloqueios}
              podeEmitir={encontro.status === 'IN_PROGRESS' && !somenteLeitura}
              emitindo={emitindo}
              onEmitir={emitir}
            />

            <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
              O resultado comunica o que foi avaliado. Ele não atribui ASA, não declara aptidão
              anestésica e não marca cirurgia — essa decisão continua fora do Antessala.
            </p>
          </aside>
        </div>
      </div>
    </div>
  )
}

/* ══════════════ peças ══════════════ */

function Secao({
  titulo,
  apoio,
  children,
}: {
  titulo: string
  apoio: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border bg-card px-5 py-4">
      <Rotulo>{titulo}</Rotulo>
      <p className="mb-3 mt-1 text-[11px] text-muted-foreground">{apoio}</p>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Confirmacao({
  rotulo,
  valor,
  desabilitado,
  testid,
  onChange,
}: {
  rotulo: string
  valor: boolean | null
  desabilitado?: boolean
  testid: string
  onChange: (v: boolean) => void
}) {
  return (
    <div className="rounded-lg border px-3 py-2.5">
      <p className="text-[13px]">{rotulo}</p>
      <div className="mt-2 flex gap-1.5">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            disabled={desabilitado}
            aria-pressed={valor === v}
            data-testid={v ? testid : undefined}
            onClick={() => onChange(v)}
            className={cn(
              'rounded-md border px-3 py-1 text-[12px] transition-colors',
              valor === v
                ? 'border-foreground/20 bg-accent font-medium'
                : 'text-muted-foreground hover:bg-accent/60',
            )}
          >
            {v ? 'Confere' : 'Não confere'}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Uma narrativa da avaliação.
 *
 * O seletor vem antes do texto de propósito: a primeira decisão é se houve
 * resposta, e só depois vem o que foi dito. Assim "não realizado" tem lugar
 * próprio em vez de virar um campo vazio que alguém lerá como normal.
 */
function CampoNarrativa({
  rotulo,
  valor,
  desabilitado,
  onChange,
}: {
  rotulo: string
  valor: NarrativaRascunho
  desabilitado?: boolean
  onChange: (n: NarrativaRascunho) => void
}) {
  return (
    <div className="rounded-lg border px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-[13px]" htmlFor={`campo-${rotulo}`}>
          {rotulo}
        </label>
        <Select
          value={valor.estado}
          disabled={desabilitado}
          onValueChange={(estado) =>
            onChange(
              estado === 'ANSWERED'
                ? { estado: 'ANSWERED', texto: valor.estado === 'ANSWERED' ? valor.texto : '' }
                : { estado: estado as 'UNKNOWN', texto: null },
            )
          }
        >
          <SelectTrigger className="h-7 w-[11.5rem] text-[11px]" aria-label={`Estado de ${rotulo}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ESTADOS_NARRATIVA.map((e) => (
              <SelectItem key={e} value={e} className="text-[12px]">
                {ROTULO_NARRATIVA[e]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {valor.estado === 'ANSWERED' && (
        <Textarea
          id={`campo-${rotulo}`}
          rows={2}
          disabled={desabilitado}
          value={valor.texto}
          placeholder="O que foi observado."
          onChange={(e) => onChange({ estado: 'ANSWERED', texto: e.target.value })}
          className="mt-2 text-[13px]"
        />
      )}
    </div>
  )
}

const KINDS: PendencyKind[] = ['EXAM', 'INFORMATION', 'DOCUMENT', 'OTHER']
const IMPACTOS: PendencyImpact[] = [
  'BLOCKS_CURRENT_RESULT',
  'FOLLOW_UP_WITHOUT_BLOCKING',
  'MAY_PREVENT_PROCEDURE',
  'OPERATIONAL_ONLY',
  'INDETERMINATE_PENDING_REVIEW',
]
const DONOS: PendencyDTO['ownerRole'][] = ['SOLICITANTE', 'ENFERMAGEM', 'RECEPCAO', 'ANESTESIOLOGISTA']
const ROTULO_DONO: Record<PendencyDTO['ownerRole'], string> = {
  SOLICITANTE: 'Serviço solicitante',
  ENFERMAGEM: 'Enfermagem',
  RECEPCAO: 'Recepção',
  ANESTESIOLOGISTA: 'Anestesiologista',
}

function PainelPendencias({
  encontro,
  pendencias,
  somenteLeitura,
  onMudou,
}: {
  encontro: EncounterDTO
  pendencias: PendencyDTO[]
  somenteLeitura?: boolean
  onMudou: () => Promise<void>
}) {
  const [abrindo, setAbrindo] = useState(false)
  const [kind, setKind] = useState<PendencyKind>('EXAM')
  const [dono, setDono] = useState<PendencyDTO['ownerRole']>('SOLICITANTE')
  const [impacto, setImpacto] = useState<PendencyImpact>('BLOCKS_CURRENT_RESULT')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function abrir() {
    setOcupado(true)
    try {
      await apiPendencias.abrir({
        encounterId: encontro.id,
        expectedEncounterVersion: encontro.version,
        kind,
        ownerRole: dono,
        impact: impacto,
        description: descricao,
        requested: { _v: 1, titulo, perguntaClinica: null, instrucoes: null },
      })
      setAbrindo(false)
      setTitulo('')
      setDescricao('')
      toast.success('Pendência aberta.')
      await onMudou()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card px-5 py-4" data-testid="painel-pendencias">
      <div className="flex items-center justify-between gap-2">
        <Rotulo>Pendências</Rotulo>
        {!somenteLeitura && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11px]"
            onClick={() => setAbrindo((a) => !a)}
            data-testid="abrir-pendencia"
          >
            <PlusCircle className="size-3.5" /> Abrir
          </Button>
        )}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        Só impede emitir o resultado a pendência que alguém declarou impeditiva.
      </p>

      {abrindo && (
        <div className="mt-3 space-y-2 rounded-lg border bg-muted/20 p-3">
          <Input
            aria-label="Título do pedido"
            value={titulo}
            placeholder="O que está sendo pedido"
            onChange={(e) => setTitulo(e.target.value)}
            className="h-8 text-[12px]"
          />
          <Textarea
            aria-label="Descrição da pendência"
            rows={2}
            value={descricao}
            placeholder="Por que isso é necessário (10 a 500 caracteres)."
            onChange={(e) => setDescricao(e.target.value)}
            className="text-[12px]"
          />
          <div className="grid gap-2">
            <Escolher rotulo="Tipo" valor={kind} onChange={(v) => setKind(v as PendencyKind)}>
              {KINDS.map((k) => (
                <SelectItem key={k} value={k} className="text-[12px]">
                  {ROTULO_KIND[k]}
                </SelectItem>
              ))}
            </Escolher>
            <Escolher
              rotulo="Quem responde"
              valor={dono}
              onChange={(v) => setDono(v as PendencyDTO['ownerRole'])}
            >
              {DONOS.map((d) => (
                <SelectItem key={d} value={d} className="text-[12px]">
                  {ROTULO_DONO[d]}
                </SelectItem>
              ))}
            </Escolher>
            <Escolher
              rotulo="Impacto"
              valor={impacto}
              onChange={(v) => setImpacto(v as PendencyImpact)}
            >
              {IMPACTOS.map((i) => (
                <SelectItem key={i} value={i} className="text-[12px]">
                  {ROTULO_IMPACTO[i]}
                </SelectItem>
              ))}
            </Escolher>
          </div>
          <Button
            size="sm"
            className="w-full"
            disabled={ocupado || titulo.trim().length < 2 || descricao.trim().length < 10}
            onClick={abrir}
            data-testid="salvar-pendencia"
          >
            Abrir pendência
          </Button>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {pendencias.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">Nenhuma pendência neste caso.</p>
        ) : (
          pendencias.map((p) => (
            <ItemPendencia key={p.id} pendencia={p} somenteLeitura={somenteLeitura} onMudou={onMudou} />
          ))
        )}
      </div>
    </div>
  )
}

function Escolher({
  rotulo,
  valor,
  onChange,
  children,
}: {
  rotulo: string
  valor: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <Select value={valor} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-[12px]" aria-label={rotulo}>
        <SelectValue placeholder={rotulo} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  )
}

/**
 * Uma pendência e as duas decisões que ela guarda.
 *
 * Responder e aceitar são botões diferentes porque são atos diferentes: quem
 * entrega a resposta não decide se ela bastou.
 */
function ItemPendencia({
  pendencia,
  somenteLeitura,
  onMudou,
}: {
  pendencia: PendencyDTO
  somenteLeitura?: boolean
  onMudou: () => Promise<void>
}) {
  const [respondendo, setRespondendo] = useState(false)
  const [texto, setTexto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const bloqueia = pendencia.impact === 'BLOCKS_CURRENT_RESULT'
  const esperandoResposta = ['REQUESTED', 'INSUFFICIENT_REOPENED'].includes(pendencia.status)

  async function executar(acao: () => Promise<unknown>, mensagem: string) {
    setOcupado(true)
    try {
      await acao()
      toast.success(mensagem)
      setRespondendo(false)
      setTexto('')
      setMotivo('')
      await onMudou()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="rounded-lg border px-3 py-2.5" data-testid="pendencia-item">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={bloqueia ? 'destructive' : 'outline'} className="text-[10px]">
          {ROTULO_IMPACTO[pendencia.impact]}
        </Badge>
        <span className="text-[10.5px] text-muted-foreground">
          {ROTULO_KIND[pendencia.kind]} · {ROTULO_DONO[pendencia.ownerRole]}
        </span>
      </div>
      <p className="mt-1 text-[13px] font-medium">{pendencia.requested.titulo}</p>
      <p className="text-[11.5px] text-muted-foreground">{pendencia.description}</p>
      <p className="mt-1 text-[11px] font-medium">{ROTULO_PENDENCIA[pendencia.status]}</p>

      {pendencia.evidence && (
        <p className="mt-1 rounded border-l-2 pl-2 text-[11.5px] italic text-muted-foreground">
          {pendencia.evidence.desfecho === 'RECEIVED'
            ? pendencia.evidence.texto
            : `Não foi possível: ${pendencia.evidence.nota}`}
        </p>
      )}
      {pendencia.reviewReason && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Decisão: “{pendencia.reviewReason}”
        </p>
      )}

      {!somenteLeitura && esperandoResposta && (
        <div className="mt-2">
          {respondendo ? (
            <div className="space-y-2">
              <Textarea
                rows={2}
                aria-label="Resposta da pendência"
                value={texto}
                placeholder="O que foi entregue."
                onChange={(e) => setTexto(e.target.value)}
                className="text-[12px]"
              />
              <Button
                size="sm"
                className="w-full"
                disabled={ocupado || texto.trim().length < 1}
                data-testid="enviar-resposta"
                onClick={() =>
                  executar(
                    () =>
                      apiPendencias.responder({
                        pendencyId: pendencia.id,
                        expectedVersion: pendencia.version,
                        evidence: {
                          _v: 1,
                          desfecho: 'RECEIVED',
                          texto,
                          observadoEm: null,
                          nota: null,
                        },
                      }),
                    'Resposta entregue. Falta a decisão clínica sobre ela.',
                  )
                }
              >
                Entregar resposta
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              data-testid="responder-pendencia"
              onClick={() => setRespondendo(true)}
            >
              Registrar resposta
            </Button>
          )}
        </div>
      )}

      {!somenteLeitura && pendencia.status === 'EVIDENCE_SUBMITTED' && (
        <div className="mt-2 space-y-2">
          <Input
            aria-label="Motivo da decisão"
            value={motivo}
            placeholder="Por que aceita ou recusa (10+ caracteres)"
            onChange={(e) => setMotivo(e.target.value)}
            className="h-8 text-[12px]"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              disabled={ocupado || motivo.trim().length < 10}
              data-testid="aceitar-pendencia"
              onClick={() =>
                executar(
                  () =>
                    apiPendencias.revisar({
                      pendencyId: pendencia.id,
                      expectedVersion: pendencia.version,
                      decisao: 'ACCEPT',
                      motivo,
                    }),
                  'Resposta aceita como suficiente.',
                )
              }
            >
              Aceitar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              disabled={ocupado || motivo.trim().length < 10}
              onClick={() =>
                executar(
                  () =>
                    apiPendencias.revisar({
                      pendencyId: pendencia.id,
                      expectedVersion: pendencia.version,
                      decisao: 'REOPEN_AS_INSUFFICIENT',
                      motivo,
                    }),
                  'Resposta considerada insuficiente. A pendência voltou a esperar.',
                )
              }
            >
              Insuficiente
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** O que falta para emitir, e o formulário do que vai ser emitido. */
function PainelEmissao({
  bloqueios,
  podeEmitir,
  emitindo,
  onEmitir,
}: {
  bloqueios: number
  podeEmitir: boolean
  emitindo: boolean
  onEmitir: (c: ResultadoConteudoV1) => Promise<void>
}) {
  const [resumo, setResumo] = useState('')
  const [conclusao, setConclusao] = useState('')
  const [recomendacoes, setRecomendacoes] = useState('')

  const travado = bloqueios > 0 || !podeEmitir

  return (
    <div className="rounded-xl border bg-card px-5 py-4" data-testid="painel-emissao">
      <Rotulo>Emitir resultado</Rotulo>
      {bloqueios > 0 ? (
        <p className="mt-1.5 flex gap-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          {bloqueios} pendência(s) impeditiva(s) em aberto.
        </p>
      ) : (
        <p className="mt-1.5 flex gap-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
          <CheckCircle2 className="mt-px size-3.5 shrink-0" />
          Nenhuma pendência impede a emissão.
        </p>
      )}

      <div className="mt-3 space-y-2">
        <Textarea
          rows={3}
          aria-label="Resumo da avaliação"
          disabled={travado}
          value={resumo}
          placeholder="O que foi avaliado nesta consulta."
          onChange={(e) => setResumo(e.target.value)}
          className="text-[12px]"
        />
        <Textarea
          rows={3}
          aria-label="Conclusão"
          disabled={travado}
          value={conclusao}
          placeholder="A conclusão desta avaliação, escrita por quem avaliou."
          onChange={(e) => setConclusao(e.target.value)}
          className="text-[12px]"
        />
        <Textarea
          rows={2}
          aria-label="Recomendações"
          disabled={travado}
          value={recomendacoes}
          placeholder="Uma recomendação por linha (opcional)."
          onChange={(e) => setRecomendacoes(e.target.value)}
          className="text-[12px]"
        />
        <Button
          className="w-full"
          disabled={travado || emitindo || resumo.trim().length < 10 || conclusao.trim().length < 10}
          data-testid="emitir-resultado"
          onClick={() =>
            onEmitir({
              _v: 1,
              resumoDaAvaliacao: resumo,
              conclusao,
              recomendacoes: recomendacoes
                .split('\n')
                .map((r) => r.trim())
                .filter(Boolean),
              limitacoes: [],
              orientacoesDeRetorno: null,
            })
          }
        >
          {emitindo ? <Loader2 className="size-4 animate-spin" /> : null}
          Emitir versão final
        </Button>
      </div>

      <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
        A versão emitida não é reescrita. Se algo estiver errado, o caminho é emitir uma correção,
        e o texto antigo continua no histórico. <Link to="/arquivados" className="underline">Casos entregues</Link>.
      </p>
    </div>
  )
}
