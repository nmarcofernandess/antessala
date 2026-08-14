import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Send,
  Stethoscope,
  UserCheck,
  UserX,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/componentes/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Rotulo } from '@/vitrine/pecas'
import {
  agenda as apiAgenda,
  casos,
  encontros as apiEncontros,
  entregas as apiEntregas,
  novaChave,
  requisitos as apiRequisitos,
  resultados as apiResultados,
} from '@/servicos/casos'
import {
  ROTULO_EMISSAO,
  ROTULO_PENDENCIA,
  type ResultadoDoCasoDTO,
} from '@shared/clinical/avaliacao'
import {
  ROTULO_CLASSE,
  ROTULO_EVENTO,
  ROTULO_PAPEL,
  ROTULO_STATUS,
  type CaseDetailDTO,
  type RequirementDTO,
} from '@shared/clinical/caso'

/**
 * O caso, por inteiro.
 *
 * Snapshots à esquerda, história à direita. A timeline não é decoração: é a
 * única resposta honesta para "por que este caso está assim" — cada linha diz
 * quem agiu, sob qual responsabilidade, quando e o que mudou.
 *
 * As ações disponíveis vêm do estado do caso, não de checagem de papel
 * duplicada na tela. Uma conta enxerga tudo; o que ela pode *fazer* depende de
 * onde o caso está.
 */
export function CasoPagina() {
  const { caseId } = useParams<{ caseId: string }>()
  const navegar = useNavigate()
  const [caso, setCaso] = useState<CaseDetailDTO | null>(null)
  const [requisito, setRequisito] = useState<RequirementDTO | null>(null)
  const [avaliacao, setAvaliacao] = useState<ResultadoDoCasoDTO | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [agindo, setAgindo] = useState(false)

  const recarregar = useCallback(async () => {
    if (!caseId) return
    try {
      const [detalhe, req, estado] = await Promise.all([
        casos.obter(caseId),
        apiRequisitos.doCaso(caseId).catch(() => null),
        apiResultados.doCaso(caseId).catch(() => null),
      ])
      setCaso(detalhe)
      setRequisito(req)
      setAvaliacao(estado)
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

  async function assumir() {
    if (!caso?.openHandoff) return
    setAgindo(true)
    try {
      const atualizado = await casos.aceitarHandoff({
        caseId: caso.id,
        handoffId: caso.openHandoff.id,
        expectedCaseVersion: caso.version,
        idempotencyKey: novaChave(),
      })
      setCaso(atualizado)
      toast.success('Caso assumido pela enfermagem.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
      await recarregar()
    } finally {
      setAgindo(false)
    }
  }

  /** Envolve um comando: erro vira aviso e a tela volta à verdade do banco. */
  async function comandar(acao: () => Promise<unknown>, mensagem: string) {
    setAgindo(true)
    try {
      await acao()
      toast.success(mensagem)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setAgindo(false)
      await recarregar()
    }
  }

  if (carregando) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Carregando o caso…
      </div>
    )
  }

  if (erro || !caso) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">{erro ?? 'Caso não encontrado.'}</p>
        <Button variant="outline" size="sm" onClick={() => navegar('/')}>
          Voltar ao painel
        </Button>
      </div>
    )
  }

  const podeEntrevistar = ['NURSING_IN_PROGRESS', 'TRIAGE_PENDING'].includes(caso.status)
  const podeAgendar = caso.status === 'READY_FOR_SCHEDULING'
  const esperaChegada = caso.status === 'SCHEDULED' && Boolean(caso.booking)
  const podeIniciarAvaliacao = caso.status === 'WAITING_ANESTHESIA' && Boolean(caso.booking)
  const emAvaliacao = ['IN_ASSESSMENT', 'PENDING'].includes(caso.status)
  const entrega = avaliacao?.delivery ?? null
  // Entregar de novo só faz sentido quando a versão corrente ainda não saiu:
  // depois de uma correção, a entrega antiga vira histórico.
  const entregaCobreCorrente = Boolean(
    entrega && avaliacao?.current && entrega.resultId === avaliacao.current.id,
  )
  const podeEntregar = caso.status === 'READY_FOR_HANDOFF' && !entregaCobreCorrente

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        breadcrumbs={[{ label: 'Antessala' }, { label: 'Casos' }, { label: caso.displayCode }]}
      />

      <div className="mx-auto w-full max-w-6xl p-6 lg:p-8">
        {/* ── cabeçalho do caso ── */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] tracking-wide text-muted-foreground">
                {caso.displayCode}
              </span>
              <Badge variant="secondary" data-testid="status-do-caso">
                {ROTULO_STATUS[caso.status]}
              </Badge>
            </div>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">{caso.person.fullName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {caso.person.ageYearsAtOpening} anos · {caso.procedure.description}
              {caso.procedure.lateralityOrSite ? ` · ${caso.procedure.lateralityOrSite}` : ''}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {caso.requester.serviceName} · {caso.requester.physicianName}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {caso.openHandoff && (
              <Button onClick={assumir} disabled={agindo} data-testid="assumir-caso">
                {agindo ? <Loader2 className="size-4 animate-spin" /> : <Stethoscope className="size-4" />}
                Assumir como enfermagem
              </Button>
            )}
            {podeEntrevistar && (
              <Button asChild>
                <Link to={`/casos/${caso.id}/anamnese`}>
                  <ClipboardList className="size-4" />
                  {caso.anamnesis ? 'Continuar entrevista' : 'Iniciar entrevista'}
                </Link>
              </Button>
            )}
            {podeAgendar && (
              <Button asChild>
                <Link to="/agenda">
                  <CalendarCheck className="size-4" />
                  Agendar consulta
                </Link>
              </Button>
            )}
            {esperaChegada && (
              <>
                <Button
                  disabled={agindo}
                  data-testid="registrar-chegada"
                  onClick={() =>
                    comandar(
                      () =>
                        apiAgenda.chegada({
                          bookingId: caso.booking!.id,
                          expectedVersion: caso.booking!.version,
                        }),
                      'Chegada registrada.',
                    )
                  }
                >
                  <UserCheck className="size-4" /> Registrar chegada
                </Button>
                <Button
                  variant="outline"
                  disabled={agindo}
                  data-testid="registrar-ausencia"
                  onClick={() =>
                    comandar(
                      () =>
                        apiAgenda.ausencia({
                          bookingId: caso.booking!.id,
                          expectedVersion: caso.booking!.version,
                        }),
                      'Ausência registrada. O caso voltou para a fila de agendamento.',
                    )
                  }
                >
                  <UserX className="size-4" /> Registrar ausência
                </Button>
              </>
            )}
            {podeIniciarAvaliacao && (
              <Button
                disabled={agindo}
                data-testid="iniciar-avaliacao"
                onClick={() =>
                  comandar(async () => {
                    await apiEncontros.iniciar({
                      caseId: caso.id,
                      bookingId: caso.booking!.id,
                      expectedCaseVersion: caso.version,
                      idempotencyKey: novaChave(),
                    })
                    navegar(`/casos/${caso.id}/avaliacao`)
                  }, 'Avaliação aberta.')
                }
              >
                <Stethoscope className="size-4" /> Iniciar avaliação
              </Button>
            )}
            {emAvaliacao && (
              <Button asChild>
                <Link to={`/casos/${caso.id}/avaliacao`}>
                  <Stethoscope className="size-4" /> Abrir avaliação
                </Link>
              </Button>
            )}
            {podeEntregar && (
              <Button
                disabled={agindo}
                data-testid="enviar-entrega"
                onClick={() =>
                  comandar(
                    () => apiEntregas.enviar({ caseId: caso.id, idempotencyKey: novaChave() }),
                    'Resultado disponibilizado ao serviço solicitante, dentro do aplicativo.',
                  )
                }
              >
                <Send className="size-4" /> Disponibilizar ao solicitante
              </Button>
            )}
          </div>
        </div>

        <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* ── história ── */}
          <section>
            <h2 className="text-sm font-semibold">Linha do tempo</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Registro append-only: nada aqui é editado ou apagado depois de gravado.
            </p>

            <ol className="relative border-l pl-6" data-testid="timeline">
              {caso.timeline.map((evento) => (
                <li key={evento.id} className="relative pb-6 last:pb-0">
                  <span className="absolute -left-[calc(1.5rem+3.5px)] top-1.5 size-[7px] rounded-full bg-foreground/60" />
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <p className="text-sm font-medium">{ROTULO_EVENTO[evento.eventType]}</p>
                    <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                      #{evento.sequence}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {ROTULO_PAPEL[evento.actor.role]} · {evento.actor.displayName} ·{' '}
                    {new Date(evento.occurredAt).toLocaleString('pt-BR')}
                  </p>
                  {evento.fromStatus && evento.fromStatus !== evento.toStatus && (
                    <p className="mt-1 font-mono text-[10.5px] text-muted-foreground">
                      {ROTULO_STATUS[evento.fromStatus]} → {ROTULO_STATUS[evento.toStatus]}
                    </p>
                  )}
                  {evento.reason && (
                    <p className="mt-1 text-xs italic text-muted-foreground">“{evento.reason}”</p>
                  )}
                </li>
              ))}
            </ol>
          </section>

          {/* ── snapshots ── */}
          <aside className="space-y-4">
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="px-5 pb-2 pt-4">
                <Rotulo>Snapshots do caso</Rotulo>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  Cópia do que veio no encaminhamento, congelada na abertura. Não há cadastro de
                  pessoa nem vínculo com outros casos.
                </p>
              </div>
              <Campo rotulo="Nome" valor={caso.person.fullName} />
              <Campo
                rotulo="Nascimento"
                valor={
                  caso.person.birthDate
                    ? new Date(caso.person.birthDate).toLocaleDateString('pt-BR')
                    : 'Não informado'
                }
              />
              <Campo rotulo="Procedimento" valor={caso.procedure.description} />
              <Campo rotulo="Serviço" valor={caso.requester.serviceName} />
              <Campo rotulo="Solicitante" valor={caso.requester.physicianName} />
              <Campo
                rotulo="Recebido em"
                valor={new Date(caso.referral.receivedAt).toLocaleString('pt-BR')}
              />
              {caso.referral.freeTextReference && (
                <Campo rotulo="Observação do papel" valor={caso.referral.freeTextReference} />
              )}
            </div>

            <div className="rounded-xl border bg-card px-5 py-4">
              <Rotulo>Responsabilidade agora</Rotulo>
              <p className="mt-1.5 text-sm font-medium">
                {caso.responsibility.currentRoles.map((p) => ROTULO_PAPEL[p]).join(', ') ||
                  'Caso encerrado'}
              </p>
              {caso.responsibility.nextRoles.length > 0 && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowRight className="size-3" />
                  Depois: {caso.responsibility.nextRoles.map((p) => ROTULO_PAPEL[p]).join(', ')}
                </p>
              )}
            </div>

            {requisito && (
              <div className="rounded-xl border bg-card px-5 py-4" data-testid="requisito-do-caso">
                <Rotulo>Requisito de agenda</Rotulo>
                <p className="mt-1.5 text-sm font-medium">
                  {ROTULO_CLASSE[requisito.slotClass]} · {requisito.durationMinutes} min
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {requisito.status === 'CALCULATED'
                    ? 'Calculado, aguardando confirmação humana'
                    : requisito.status === 'OVERRIDDEN'
                      ? 'Ajustado por decisão humana'
                      : 'Confirmado'}
                </p>
                <ul className="mt-2 space-y-1">
                  {requisito.operationalExplanation.map((frase) => (
                    <li key={frase} className="flex gap-1.5 text-[11px] text-muted-foreground">
                      <CheckCircle2 className="mt-px size-3 shrink-0" />
                      {frase}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {avaliacao?.current && (
              <div className="rounded-xl border bg-card px-5 py-4" data-testid="resultado-do-caso">
                <Rotulo>Resultado pré-anestésico</Rotulo>
                <p className="mt-1.5 text-sm font-medium">
                  {ROTULO_EMISSAO[avaliacao.current.emissionType]} · versão{' '}
                  {avaliacao.current.versionNumber}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {avaliacao.current.finalizedBy.displayName} ·{' '}
                  {new Date(avaliacao.current.finalizedAt).toLocaleString('pt-BR')}
                </p>
                <p className="mt-2 text-[12px] leading-relaxed">{avaliacao.current.content.conclusao}</p>
                {avaliacao.history.length > 1 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {avaliacao.history.length} versões — nenhuma anterior foi apagada.
                  </p>
                )}
                <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">
                  sha256 {avaliacao.current.contentHash.slice(0, 16)}…
                </p>

                {entrega ? (
                  <div className="mt-3 border-t pt-3">
                    <p className="text-[11.5px]">
                      {entrega.status === 'RECEIVED'
                        ? `Recebido por ${entrega.serviceName} em ${new Date(entrega.receivedAt!).toLocaleString('pt-BR')}.`
                        : `Disponível para ${entrega.serviceName} desde ${new Date(entrega.sentAt).toLocaleString('pt-BR')}.`}
                    </p>
                    <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
                      Entrega local da demonstração. O aplicativo não envia nada para fora deste
                      computador.
                    </p>
                    {entrega.status === 'SENT' && (
                      <Button
                        size="sm"
                        className="mt-2 w-full"
                        disabled={agindo}
                        data-testid="confirmar-recebimento"
                        onClick={() =>
                          comandar(
                            () =>
                              apiEntregas.confirmar({
                                deliveryId: entrega.id,
                                expectedVersion: entrega.version,
                              }),
                            'Recebimento confirmado pelo serviço solicitante.',
                          )
                        }
                      >
                        Confirmar recebimento como solicitante
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 border-t pt-3 text-[11.5px] text-muted-foreground">
                    Ainda não disponibilizado ao serviço solicitante.
                  </p>
                )}
              </div>
            )}

            {avaliacao?.pendencies.length ? (
              <div className="rounded-xl border bg-card px-5 py-4" data-testid="pendencias-do-caso">
                <Rotulo>Pendências</Rotulo>
                <ul className="mt-2 space-y-1.5">
                  {avaliacao.pendencies.map((p) => (
                    <li key={p.id} className="text-[11.5px]">
                      <span className="font-medium">{p.requested.titulo}</span>
                      <span className="text-muted-foreground"> — {ROTULO_PENDENCIA[p.status]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {caso.booking && (
              <div className="rounded-xl border bg-card px-5 py-4" data-testid="booking-do-caso">
                <Rotulo>Consulta pré-anestésica</Rotulo>
                <p className="mt-1.5 text-sm font-medium">
                  {new Date(caso.booking.startsAt).toLocaleString('pt-BR')}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {ROTULO_CLASSE[caso.booking.slotClass]} — a cirurgia continua fora deste sistema.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className={cn('border-t px-5 py-2.5')}>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {rotulo}
      </p>
      <p className="mt-0.5 text-sm">{valor}</p>
    </div>
  )
}
