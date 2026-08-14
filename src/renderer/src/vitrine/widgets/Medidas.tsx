/**
 * Medidas: `vital_signs@1` e `functional_capacity@1`.
 *
 * A regra mais importante aqui é o que o widget se recusa a fazer. Uma medida
 * que ninguém aferiu não vira zero — vira “não aferido”, com um botão próprio.
 * E o MET da atividade é metadado do catálogo, nunca um valor atribuído ao
 * paciente: a tela mostra de onde o número veio.
 *
 * Na composição isso vira duas decisões: todo cartão de medida tem a mesma
 * altura, aferido ou não, para a grade nunca pular; e a procedência do MET é o
 * rodapé do próprio cartão da atividade, não um aviso solto no meio do widget.
 */

import { useState, type ReactNode } from 'react'
import { Activity, Gauge, HeartPulse, Ruler, Scale, Wind } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { buscarAtividade, TAMANHO_CATALOGOS } from '../catalogos'
import { BuscaCatalogo } from '../busca'
import {
  ChipStatus,
  CorpoWidget,
  EtiquetaSecao,
  GradeDados,
  type Status,
} from '../primitivos'
import { PerguntaChave } from './PerguntaChave'
import type {
  DadosCapacidadeFuncional,
  DadosSinaisVitais,
  MedidaVital,
} from './tipos'

/* ══════════════ sinais vitais ══════════════ */

type DefMedida = {
  chave: keyof DadosSinaisVitais
  titulo: string
  unidade: string
  icone: typeof Gauge
  /** Faixa aceita como entrada da demonstração — validação, não leitura clínica. */
  min: number
  max: number
  decimais?: number
}

const MEDIDAS: DefMedida[] = [
  { chave: 'sistolica', titulo: 'Pressão sistólica', unidade: 'mmHg', icone: Gauge, min: 20, max: 350 },
  { chave: 'diastolica', titulo: 'Pressão diastólica', unidade: 'mmHg', icone: Gauge, min: 10, max: 250 },
  { chave: 'frequenciaCardiaca', titulo: 'Frequência cardíaca', unidade: 'bpm', icone: HeartPulse, min: 10, max: 300 },
  { chave: 'saturacao', titulo: 'Saturação', unidade: '%', icone: Wind, min: 0, max: 100 },
  { chave: 'peso', titulo: 'Peso', unidade: 'kg', icone: Scale, min: 0.5, max: 600, decimais: 1 },
  { chave: 'altura', titulo: 'Altura', unidade: 'cm', icone: Ruler, min: 20, max: 300 },
]

export function WidgetSinaisVitais({
  dados,
  onChange,
}: {
  dados: DadosSinaisVitais
  onChange: (d: DadosSinaisVitais) => void
}) {
  const aferidas = MEDIDAS.filter((m) => dados[m.chave].estado === 'RESPONDIDO')
  const naoAferidas = MEDIDAS.filter((m) => dados[m.chave].estado === 'NAO_REALIZADO')

  const peso = dados.peso.valor
  const altura = dados.altura.valor
  const imc = peso && altura ? peso / (altura / 100) ** 2 : null

  return (
    <CorpoWidget>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <EtiquetaSecao>
          {aferidas.length} de {MEDIDAS.length} medidas aferidas
        </EtiquetaSecao>
        {naoAferidas.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {naoAferidas.length} registrada{naoAferidas.length > 1 ? 's' : ''} como não aferida
            {naoAferidas.length > 1 ? 's' : ''} — nunca como zero
          </span>
        )}
      </div>

      <GradeDados colunas={3}>
        {MEDIDAS.map((m) => (
          <CampoMedida
            key={String(m.chave)}
            def={m}
            medida={dados[m.chave]}
            onChange={(r) => onChange({ ...dados, [m.chave]: r })}
          />
        ))}
      </GradeDados>

      {imc && (
        <div className="rounded-lg border border-dashed px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="flex items-center gap-2">
              <Activity className="size-3.5 text-muted-foreground" />
              <EtiquetaSecao>Índice de massa corporal</EtiquetaSecao>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="font-mono text-lg font-medium tabular-nums">{imc.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">kg/m²</span>
            </span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            Calculado a partir do peso e da altura aferidos — não é uma medida em si.
          </p>
        </div>
      )}
    </CorpoWidget>
  )
}

function CampoMedida({
  def,
  medida,
  onChange,
}: {
  def: DefMedida
  medida: MedidaVital
  onChange: (r: MedidaVital) => void
}) {
  const aferida = medida.estado === 'RESPONDIDO' && medida.valor !== undefined
  const naoAferida = medida.estado === 'NAO_REALIZADO'

  return (
    <div
      className={cn(
        // A altura é a mesma nos três estados: aferido, vazio e não aferido.
        // É o que impede a grade de pular quando o link de recusa aparece.
        'flex h-full min-h-[6.5rem] flex-col justify-between rounded-lg border bg-card px-4 py-3',
        naoAferida && 'border-dashed bg-muted/20',
      )}
    >
      <div className="flex items-center gap-2">
        <def.icone
          className={cn(
            'size-3.5 shrink-0',
            naoAferida ? 'text-muted-foreground/50' : 'text-muted-foreground',
          )}
        />
        <EtiquetaSecao>{def.titulo}</EtiquetaSecao>
      </div>

      {naoAferida ? (
        <div className="flex items-end justify-between gap-2">
          <span className="text-sm text-muted-foreground">Não aferido</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 -mr-1.5 text-[11px]"
            onClick={() => onChange({ estado: 'NAO_PERGUNTADO' })}
          >
            Aferir
          </Button>
        </div>
      ) : (
        <div>
          <div className="flex items-baseline gap-1.5">
            <Input
              type="number"
              inputMode="decimal"
              value={medida.valor ?? ''}
              min={def.min}
              max={def.max}
              placeholder="—"
              onChange={(e) => {
                const v = e.target.value
                onChange(
                  v === ''
                    ? { estado: 'NAO_PERGUNTADO' }
                    : { estado: 'RESPONDIDO', valor: Number(v) },
                )
              }}
              className="h-10 w-[5.75rem] font-mono text-xl tabular-nums"
            />
            <span className="text-xs text-muted-foreground">{def.unidade}</span>
          </div>

          {/* Slot reservado: o link some quando o valor entra, o cartão não encolhe. */}
          <div className="mt-1.5 h-5">
            {!aferida && (
              <button
                type="button"
                onClick={() => onChange({ estado: 'NAO_REALIZADO' })}
                className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
              >
                não foi aferido
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ══════════════ capacidade funcional ══════════════ */

/** Tradução do MET do catálogo em legibilidade — não é score clínico. */
function faixaMet(met: number): { rotulo: string; status: Status } {
  if (met < 3) return { rotulo: 'esforço leve', status: 'atencao' }
  if (met < 6) return { rotulo: 'esforço moderado', status: 'adequado' }
  return { rotulo: 'esforço vigoroso', status: 'ideal' }
}

/** Enunciado do widget: a pergunta que a enfermagem faz em voz alta. */
function Enunciado({ pergunta, apoio }: { pergunta: string; apoio: string }) {
  return (
    <div>
      <p className="text-sm font-medium leading-snug">{pergunta}</p>
      <p className="mt-1 max-w-[70ch] text-xs text-muted-foreground">{apoio}</p>
    </div>
  )
}

/** Trilho de uma pergunta satélite — mesma gramática da revisão por sistemas. */
function LinhaPergunta({ destaque, children }: { destaque?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border bg-card py-3 pl-4 pr-3.5',
        '[&>div]:py-0',
        destaque && 'bg-warning/[0.07]',
      )}
    >
      {destaque && <span className="absolute inset-y-0 left-0 w-[3px] bg-warning" aria-hidden />}
      {children}
    </div>
  )
}

export function WidgetCapacidadeFuncional({
  dados,
  onChange,
}: {
  dados: DadosCapacidadeFuncional
  onChange: (d: DadosCapacidadeFuncional) => void
}) {
  const [trocando, setTrocando] = useState(false)
  const atividade = dados.atividade.valor
  const met = dados.metCatalogo
  const faixa = met ? faixaMet(met) : null
  const limitado =
    dados.limitadoPorSintoma.estado === 'RESPONDIDO' && dados.limitadoPorSintoma.valor === true

  return (
    <CorpoWidget>
      <div className="space-y-2.5">
        <Enunciado
          pergunta="Qual a atividade mais pesada que o paciente consegue fazer hoje?"
          apoio="Pergunte pelo que ele faz de verdade na rotina, não pelo que gostaria de fazer."
        />

        {atividade && !trocando ? (
          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3">
              <div className="min-w-0">
                <EtiquetaSecao>Atividade relatada</EtiquetaSecao>
                <p className="mt-1 text-[15px] font-medium leading-snug">{atividade}</p>
              </div>
              <div className="flex items-center gap-2">
                {faixa && (
                  <ChipStatus status={faixa.status}>
                    <span className="font-mono tabular-nums">{met}</span> MET · {faixa.rotulo}
                  </ChipStatus>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setTrocando(true)}
                >
                  Trocar
                </Button>
              </div>
            </div>

            {met && (
              // A procedência do número mora junto do número, não em bloco à parte.
              <p className="border-t bg-muted/30 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">De onde vem esse número:</span> o MET
                pertence à atividade no catálogo, não ao paciente. Ele descreve o esforço típico do
                que foi relatado — não mede a capacidade de quem relatou.
              </p>
            )}
          </div>
        ) : (
          <BuscaCatalogo
            autoFocus={trocando}
            placeholder="Caminhar, subir escada, cuidar da casa, nadar…"
            rodape={`${TAMANHO_CATALOGOS.met} atividades com MET de referência`}
            buscar={(t) =>
              buscarAtividade(t).map((a) => ({
                id: a.id,
                titulo: a.nome,
                apoio: a.categoria,
                codigo: `${a.met} MET`,
              }))
            }
            onEscolher={(r) => {
              onChange({
                ...dados,
                atividade: { estado: 'RESPONDIDO', valor: r.titulo },
                metCatalogo: Number(r.codigo!.replace(' MET', '')),
              })
              setTrocando(false)
            }}
          />
        )}
      </div>

      <div className="space-y-2.5">
        <LinhaPergunta destaque={limitado}>
          <PerguntaChave
            compacta
            pergunta="Ele para por sintoma — cansaço, dor no peito, falta de ar?"
            resposta={dados.limitadoPorSintoma}
            onChange={(r) => onChange({ ...dados, limitadoPorSintoma: r })}
          />
        </LinhaPergunta>

        {limitado && (
          <div className="rounded-lg border border-warning/30 bg-warning/[0.06] px-4 py-3">
            <EtiquetaSecao>O que faz ele parar?</EtiquetaSecao>
            <Textarea
              rows={2}
              value={dados.descricaoLimitacao ?? ''}
              placeholder="“Subo um lance de escada e preciso parar para respirar.”"
              onChange={(e) => onChange({ ...dados, descricaoLimitacao: e.target.value })}
              className="mt-2 bg-card text-[13px]"
            />
          </div>
        )}
      </div>
    </CorpoWidget>
  )
}
