/**
 * Medidas: `vital_signs@1` e `functional_capacity@1`.
 *
 * A regra mais importante aqui é o que o widget se recusa a fazer. Uma medida
 * que ninguém aferiu não vira zero — vira “não aferido”, com um botão próprio.
 * E o MET da atividade é metadado do catálogo, nunca um valor atribuído ao
 * paciente: a tela mostra de onde o número veio.
 */

import { useState } from 'react'
import { Activity, Gauge, HeartPulse, Ruler, Scale, Wind } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { buscarAtividade, TAMANHO_CATALOGOS } from '../catalogos'
import { BuscaCatalogo } from '../busca'
import {
  CartaoDado,
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
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-2.5">
          <Activity className="size-3.5 text-muted-foreground" />
          <span className="text-[13px] text-muted-foreground">
            Índice de massa corporal calculado a partir do peso e da altura:
          </span>
          <span className="font-mono text-[13px] font-medium tabular-nums">
            {imc.toFixed(1)} kg/m²
          </span>
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
        'flex flex-col rounded-lg border bg-card px-4 py-3',
        naoAferida && 'border-dashed bg-muted/20',
      )}
    >
      <div className="flex items-center gap-2">
        <def.icone className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">{def.titulo}</span>
      </div>

      {naoAferida ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[13px] text-muted-foreground">Não aferido</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => onChange({ estado: 'NAO_PERGUNTADO' })}
          >
            Aferir
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-1.5 flex items-baseline gap-1.5">
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
              className="h-9 w-24 font-mono text-lg tabular-nums"
            />
            <span className="text-xs text-muted-foreground">{def.unidade}</span>
          </div>

          {!aferida && (
            <button
              type="button"
              onClick={() => onChange({ estado: 'NAO_REALIZADO' })}
              className="mt-2 self-start text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            >
              não foi aferido
            </button>
          )}
        </>
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

  return (
    <CorpoWidget>
      <div className="space-y-2">
        <p className="text-sm font-medium leading-snug">
          Qual a atividade mais pesada que o paciente consegue fazer hoje?
        </p>
        <p className="text-xs text-muted-foreground">
          Pergunte pelo que ele faz de verdade na rotina, não pelo que gostaria de fazer.
        </p>

        {atividade && !trocando ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
            <div className="min-w-0">
              <span className="block text-sm font-medium">{atividade}</span>
              {met && (
                <span className="text-[11px] text-muted-foreground">
                  Catálogo de atividades: {met} MET · {faixa!.rotulo}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {faixa && <ChipStatus status={faixa.status}>{met} MET</ChipStatus>}
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setTrocando(true)}>
                Trocar
              </Button>
            </div>
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

      {met && (
        <CartaoDado
          titulo="De onde vem esse número"
          rodape="O MET pertence à atividade no catálogo, não ao paciente. Ele descreve o esforço típico do que foi relatado — não mede a capacidade de quem relatou."
        />
      )}

      <div className="border-t pt-3">
        <PerguntaChave
          compacta
          pergunta="Ele para por sintoma — cansaço, dor no peito, falta de ar?"
          resposta={dados.limitadoPorSintoma}
          onChange={(r) => onChange({ ...dados, limitadoPorSintoma: r })}
        />

        {dados.limitadoPorSintoma.estado === 'RESPONDIDO' &&
          dados.limitadoPorSintoma.valor === true && (
            <div className="mt-3 space-y-1.5">
              <label className="text-[11px] text-muted-foreground">O que faz ele parar?</label>
              <Textarea
                rows={2}
                value={dados.descricaoLimitacao ?? ''}
                placeholder="“Subo um lance de escada e preciso parar para respirar.”"
                onChange={(e) => onChange({ ...dados, descricaoLimitacao: e.target.value })}
                className="text-[13px]"
              />
            </div>
          )}
      </div>
    </CorpoWidget>
  )
}
