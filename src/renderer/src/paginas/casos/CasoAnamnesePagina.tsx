import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, ChevronDown, Loader2, Lock, Save } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/componentes/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { CATEGORIAS, widgetPorTipo } from '@/vitrine/widgets/registro'
import { anamnese as apiAnamnese, casos, requisitos as apiRequisitos } from '@/servicos/casos'
import { calcularRequisito } from '@shared/clinical/carga'
import {
  ROTULO_CLASSE,
  ROTULO_STATUS,
  type AnamnesisBlock,
  type AnamnesisDTO,
  type CaseDetailDTO,
  type RequirementDTO,
  type SlotClass,
} from '@shared/clinical/caso'

/**
 * A entrevista deste caso.
 *
 * Os blocos vêm do protocolo do procedimento e as respostas vivem no banco: o
 * rascunho é salvo enquanto a enfermagem digita e sobrevive a fechar o
 * aplicativo. Publicar congela uma revisão e a tela vira leitura — o que foi
 * publicado explicou o requisito, e reescrevê-lo apagaria a explicação.
 *
 * A prévia do requisito na coluna da direita é reexibição da mesma regra que o
 * processo principal vai executar. Ela mostra o número enquanto se digita; quem
 * publica é o main.
 */
const ATRASO_AUTOSAVE = 600

export function CasoAnamnesePagina() {
  const { caseId } = useParams<{ caseId: string }>()
  const navegar = useNavigate()

  const [caso, setCaso] = useState<CaseDetailDTO | null>(null)
  const [anam, setAnam] = useState<AnamnesisDTO | null>(null)
  const [blocos, setBlocos] = useState<AnamnesisBlock[]>([])
  const [abertos, setAbertos] = useState<string[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [salvoEm, setSalvoEm] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [publicando, setPublicando] = useState(false)
  const [requisito, setRequisito] = useState<RequirementDTO | null>(null)
  const [classeEscolhida, setClasseEscolhida] = useState<SlotClass | ''>('')
  const [motivo, setMotivo] = useState('')

  const versaoRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let vivo = true
    async function carregar() {
      if (!caseId) return
      try {
        const detalhe = await casos.obter(caseId)
        if (!vivo) return
        setCaso(detalhe)

        const aberta =
          detalhe.status === 'NURSING_IN_PROGRESS' || detalhe.status === 'TRIAGE_PENDING'
            ? await apiAnamnese.abrir(caseId)
            : await apiAnamnese.obter(caseId)
        if (!vivo || !aberta) {
          if (vivo) setErro('Este caso ainda não está em entrevista.')
          return
        }
        setAnam(aberta)
        setBlocos(aberta.blocks)
        versaoRef.current = aberta.version
        setAbertos(aberta.blocks.slice(0, 1).map((b) => b.id))

        const req = await apiRequisitos.doCaso(caseId).catch(() => null)
        if (vivo && req) {
          setRequisito(req)
          setClasseEscolhida(req.slotClass)
        }
      } catch (e) {
        if (vivo) setErro(e instanceof Error ? e.message : String(e))
      } finally {
        if (vivo) setCarregando(false)
      }
    }
    void carregar()
    return () => {
      vivo = false
    }
  }, [caseId])

  const somenteLeitura = anam?.status === 'FINAL'

  /** Autosave: o rascunho é salvo sozinho, com a versão que o main devolveu. */
  const agendarSalvamento = useCallback(
    (proximos: AnamnesisBlock[]) => {
      if (!anam || somenteLeitura) return
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(async () => {
        setSalvando(true)
        try {
          const salvo = await apiAnamnese.salvar({
            anamnesisId: anam.id,
            expectedVersion: versaoRef.current,
            blocks: proximos,
          })
          versaoRef.current = salvo.version
          setSalvoEm(salvo.updatedAt)
        } catch (e) {
          toast.error(e instanceof Error ? e.message : String(e))
        } finally {
          setSalvando(false)
        }
      }, ATRASO_AUTOSAVE)
    },
    [anam, somenteLeitura],
  )

  function alterar(id: string, dados: unknown) {
    setBlocos((atuais) => {
      const proximos = atuais.map((b) => (b.id === id ? { ...b, dados } : b))
      agendarSalvamento(proximos)
      return proximos
    })
  }

  const previa = useMemo(
    () => calcularRequisito(blocos, anam?.protocolBlocks ?? []),
    [blocos, anam?.protocolBlocks],
  )

  async function publicar() {
    if (!anam) return
    setPublicando(true)
    try {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        const salvo = await apiAnamnese.salvar({
          anamnesisId: anam.id,
          expectedVersion: versaoRef.current,
          blocks: blocos,
        })
        versaoRef.current = salvo.version
      }
      const { anamnesis } = await apiAnamnese.finalizar({
        anamnesisId: anam.id,
        expectedVersion: versaoRef.current,
      })
      setAnam(anamnesis)
      versaoRef.current = anamnesis.version

      const calculado = await apiRequisitos.calcular(anamnesis.caseId)
      setRequisito(calculado)
      setClasseEscolhida(calculado.slotClass)
      toast.success('Entrevista finalizada. Confirme o requisito para liberar o agendamento.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setPublicando(false)
    }
  }

  async function confirmarRequisito() {
    if (!requisito) return
    setPublicando(true)
    try {
      const trocou = classeEscolhida && classeEscolhida !== requisito.slotClass
      const confirmado = await apiRequisitos.confirmar({
        requirementId: requisito.id,
        expectedVersion: requisito.version,
        slotClassEscolhida: (classeEscolhida || requisito.slotClass) as SlotClass,
        motivo: trocou ? motivo : undefined,
      })
      setRequisito(confirmado)
      toast.success('Requisito publicado. O caso entrou na fila de agendamento.')
      navegar(`/casos/${confirmado.caseId}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setPublicando(false)
    }
  }

  if (carregando) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Abrindo a entrevista…
      </div>
    )
  }

  if (erro || !caso || !anam) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="max-w-md text-sm text-muted-foreground">{erro ?? 'Entrevista indisponível.'}</p>
        <Button variant="outline" size="sm" onClick={() => navegar(`/casos/${caseId}`)}>
          Voltar ao caso
        </Button>
      </div>
    )
  }

  const tratados = anam.protocolBlocks.length - previa.pendentes.length

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        breadcrumbs={[
          { label: 'Antessala' },
          { label: caso.displayCode, href: `/casos/${caso.id}` },
          { label: 'Entrevista' },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">{caso.displayCode}</span>
              <Badge variant="secondary">{ROTULO_STATUS[caso.status]}</Badge>
              {somenteLeitura && (
                <Badge variant="outline" className="gap-1">
                  <Lock className="size-3" /> revisão {anam.revision}
                </Badge>
              )}
            </div>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">{caso.person.fullName}</h1>
            <p className="text-sm text-muted-foreground">
              {caso.procedure.description} · protocolo {anam.protocolId} v{anam.protocolVersion}
            </p>
          </div>

          <div className="flex items-center gap-2" data-testid="estado-do-rascunho">
            {salvando ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Salvando…
              </span>
            ) : somenteLeitura ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3.5" /> Entrevista finalizada
              </span>
            ) : salvoEm ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Save className="size-3.5" /> Rascunho salvo
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* ── composer ── */}
          <div>
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Composição da entrevista</h2>
                <p className="text-xs text-muted-foreground">
                  Campo em branco nunca vira “não”: a negativa é uma resposta que alguém ouviu.
                </p>
              </div>
              <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                {tratados} / {anam.protocolBlocks.length} tratados
              </span>
            </div>

            <div className="space-y-2">
              {blocos.map((bloco) => {
                const def = widgetPorTipo(bloco.tipo)
                if (!def) return null
                const aberto = abertos.includes(bloco.id)
                const Icone = def.icone
                const Componente = def.Componente as unknown as ComponentType<{
                  dados: unknown
                  onChange: (d: unknown) => void
                }>
                return (
                  <div
                    key={bloco.id}
                    data-testid="bloco-anamnese"
                    data-tipo={bloco.tipo}
                    className={cn(
                      'overflow-hidden rounded-xl border bg-card transition-colors',
                      aberto && 'border-foreground/15',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setAbertos((a) =>
                          a.includes(bloco.id) ? a.filter((x) => x !== bloco.id) : [...a, bloco.id],
                        )
                      }
                      className={cn(
                        'grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3 text-left',
                        'transition-colors hover:bg-muted/40',
                        aberto && 'bg-muted/30',
                      )}
                    >
                      <Icone className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium leading-tight">{def.nome}</span>
                        <span className="mt-1 block truncate text-[11.5px] text-muted-foreground">
                          {CATEGORIAS[def.categoria]} · {def.descricao}
                        </span>
                      </span>
                      <ChevronDown
                        className={cn(
                          'size-4 shrink-0 text-muted-foreground transition-transform',
                          aberto && 'rotate-180',
                        )}
                      />
                    </button>

                    {aberto && (
                      <div
                        className={cn(
                          'border-t bg-muted/15 px-5 py-4',
                          somenteLeitura && 'pointer-events-none opacity-70',
                        )}
                      >
                        <Componente
                          dados={bloco.dados}
                          onChange={(d) => alterar(bloco.id, d)}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── requisito ── */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="px-5 pb-3 pt-4">
                <Rotulo>Requisito de agenda</Rotulo>
                <p className="mt-2 text-3xl font-semibold tabular-nums">
                  {previa.minutos}
                  <span className="ml-1 text-base font-normal text-muted-foreground">min</span>
                </p>
                <p className="text-[11.5px] text-muted-foreground">{previa.explicacao}</p>
              </div>

              {previa.pendentes.length > 0 && !somenteLeitura && (
                <div className="border-t bg-amber-500/5 px-5 py-3">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    {previa.pendentes.length} bloco(s) sem resposta
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {previa.pendentes.join(' · ')}
                  </p>
                </div>
              )}

              {!somenteLeitura && (
                <div className="border-t px-5 py-4">
                  <Button
                    className="w-full"
                    disabled={publicando || previa.pendentes.length > 0}
                    onClick={publicar}
                    data-testid="finalizar-entrevista"
                  >
                    {publicando ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                    Finalizar entrevista
                  </Button>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    Finalizar congela uma revisão e calcula o requisito. A duração só vira vaga
                    depois que uma pessoa confirmar.
                  </p>
                </div>
              )}

              {requisito && (
                <div className="border-t px-5 py-4" data-testid="painel-requisito">
                  <Rotulo>Confirmação humana</Rotulo>
                  <p className="mt-1.5 text-sm">
                    Calculado: <strong>{ROTULO_CLASSE[requisito.slotClass]}</strong> ·{' '}
                    {requisito.durationMinutes} min
                  </p>
                  <ul className="mt-2 space-y-1">
                    {requisito.operationalExplanation.map((frase) => (
                      <li key={frase} className="text-[11px] text-muted-foreground">
                        · {frase}
                      </li>
                    ))}
                  </ul>

                  {requisito.status === 'CALCULATED' ? (
                    <div className="mt-3 space-y-2">
                      <Select
                        value={classeEscolhida || requisito.slotClass}
                        onValueChange={(v) => setClasseEscolhida(v as SlotClass)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="QUICK">Vaga rápida · 20 min</SelectItem>
                          <SelectItem value="STANDARD">Vaga normal · 35 min</SelectItem>
                          <SelectItem value="EXTENDED">Vaga estendida · 50 min</SelectItem>
                        </SelectContent>
                      </Select>

                      {classeEscolhida && classeEscolhida !== requisito.slotClass && (
                        <Textarea
                          rows={3}
                          value={motivo}
                          placeholder="Por que a classe calculada não serve? (mínimo 10 caracteres)"
                          onChange={(e) => setMotivo(e.target.value)}
                        />
                      )}

                      <Button
                        className="w-full"
                        disabled={publicando}
                        onClick={confirmarRequisito}
                        data-testid="confirmar-requisito"
                      >
                        {publicando ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}
                        Confirmar e liberar agendamento
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Publicado como <strong>{ROTULO_CLASSE[requisito.slotClass]}</strong>.{' '}
                      <Link to="/agenda" className="underline underline-offset-2">
                        Ir para a agenda
                      </Link>
                    </p>
                  )}
                </div>
              )}

              <div className="border-t bg-muted/30 px-5 py-4">
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  O requisito responde quanto tempo a conversa leva. Ele não atribui ASA, não
                  declara aptidão anestésica e não sugere conduta.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
