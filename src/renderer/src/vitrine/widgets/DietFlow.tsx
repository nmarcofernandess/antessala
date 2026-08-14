/**
 * Os widgets do composer do DietFlow, portados na íntegra.
 *
 * Eles não são pré-anestésicos — são nutricionais. Estão aqui porque o padrão
 * de widget do DietFlow já resolveu o problema difícil: transformar uma
 * pergunta em algo que a pessoa responde sem esforço e que devolve leitura
 * imediata. Sono, hábito intestinal e hidratação viram score, régua e meta;
 * a anamnese pré-anestésica herda essa gramática.
 *
 * As escalas e faixas vêm do DietFlow tal como estão lá: ISI-3 de 0 a 12,
 * escala de Bristol de 1 a 7 com GI Score de 0 a 12, e a faixa de hidratação
 * em ml por quilo conforme o perfil.
 */

import {
  Apple,
  Bed,
  CircleDot,
  CupSoda,
  Droplet,
  Flame,
  Moon,
  Pill,
  Scale,
  Utensils,
  Wind,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  BarraScore,
  CartaoDado,
  ChipStatus,
  CorpoWidget,
  Escolha,
  EtiquetaSecao,
  GradeDados,
  Metrica,
  Regua,
  SliderStatus,
  ValorHero,
  type Opcao,
  type Status,
} from '../primitivos'

/* ══════════════════════════════════════════════════════════
   SONO — Índice de Gravidade de Insônia, versão curta
   ══════════════════════════════════════════════════════════ */

export type Likert = 0 | 1 | 2 | 3 | 4

export type DadosSono = {
  horasDormidas: number
  satisfacao: Likert
  interferenciaDiurna: Likert
  preocupacao: Likert
  acordouNoite?: 'nao' | 'uma_vez' | 'varias'
}

const SATISFACAO: Opcao<Likert>[] = [
  { valor: 0, rotulo: 'Muito satisfeito', detalhe: 'Durmo muito bem', status: 'ideal' },
  { valor: 1, rotulo: 'Satisfeito', detalhe: 'Durmo bem', status: 'ideal' },
  { valor: 2, rotulo: 'Neutro', detalhe: 'Nem bom nem ruim', status: 'adequado' },
  { valor: 3, rotulo: 'Insatisfeito', detalhe: 'Durmo mal', status: 'atencao' },
  { valor: 4, rotulo: 'Muito insatisfeito', detalhe: 'Durmo muito mal', status: 'critico' },
]

const INTERFERENCIA: Opcao<Likert>[] = [
  { valor: 0, rotulo: 'Nenhuma', detalhe: 'Não interfere', status: 'ideal' },
  { valor: 1, rotulo: 'Pouca', detalhe: 'Quase não interfere', status: 'ideal' },
  { valor: 2, rotulo: 'Alguma', detalhe: 'Interfere um pouco', status: 'adequado' },
  { valor: 3, rotulo: 'Muita', detalhe: 'Interfere bastante', status: 'atencao' },
  { valor: 4, rotulo: 'Demais', detalhe: 'Interfere demais', status: 'critico' },
]

const PREOCUPACAO: Opcao<Likert>[] = [
  { valor: 0, rotulo: 'Nenhuma', detalhe: 'Não me preocupo', status: 'ideal' },
  { valor: 1, rotulo: 'Pouca', detalhe: 'Quase não me preocupo', status: 'ideal' },
  { valor: 2, rotulo: 'Alguma', detalhe: 'Me preocupo um pouco', status: 'adequado' },
  { valor: 3, rotulo: 'Muita', detalhe: 'Me preocupo bastante', status: 'atencao' },
  { valor: 4, rotulo: 'Demais', detalhe: 'Me preocupo demais', status: 'critico' },
]

/** Faixas do ISI-3 tal como o DietFlow as define. */
const FAIXAS_ISI: { ate: number; nome: string; status: Status }[] = [
  { ate: 3, nome: 'Sono adequado', status: 'ideal' },
  { ate: 6, nome: 'Atenção', status: 'adequado' },
  { ate: 9, nome: 'Insônia provável', status: 'atencao' },
  { ate: 12, nome: 'Insônia clínica provável', status: 'critico' },
]

export function calcularIsi(d: DadosSono): number {
  return d.satisfacao + d.interferenciaDiurna + d.preocupacao
}

function statusHoras(h: number): Status {
  if (h < 5) return 'critico'
  if (h < 6.5) return 'atencao'
  if (h <= 9) return 'ideal'
  return 'adequado'
}

export function WidgetSono({
  dados,
  onChange,
}: {
  dados: DadosSono
  onChange: (d: DadosSono) => void
}) {
  const score = calcularIsi(dados)
  const faixa = FAIXAS_ISI.find((f) => score <= f.ate)!
  const tomHoras = statusHoras(dados.horasDormidas)

  return (
    <CorpoWidget>
      <ValorHero
        valor={dados.horasDormidas.toFixed(1).replace('.0', '')}
        unidade="h por noite"
        status={tomHoras}
        metricas={
          <Metrica
            icone={Moon}
            valor={`${Math.round(dados.horasDormidas * 60)}`}
            rotulo="minutos"
          />
        }
      >
        <SliderStatus
          rotuloA11y="Horas dormidas por noite"
          valor={dados.horasDormidas}
          min={3}
          max={12}
          passo={0.5}
          status={tomHoras}
          marcas={[3, 6, 9, 12]}
          onChange={(v) => onChange({ ...dados, horasDormidas: v })}
        />
      </ValorHero>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <EtiquetaSecao>Como ele avalia o próprio sono</EtiquetaSecao>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            ISI-3 · três perguntas
          </span>
        </div>

        <div className="mt-3 space-y-4">
          <PerguntaLikert
            titulo="Satisfação com o sono"
            opcoes={SATISFACAO}
            valor={dados.satisfacao}
            onChange={(v) => onChange({ ...dados, satisfacao: v })}
          />
          <PerguntaLikert
            titulo="Quanto atrapalha o dia"
            opcoes={INTERFERENCIA}
            valor={dados.interferenciaDiurna}
            onChange={(v) => onChange({ ...dados, interferenciaDiurna: v })}
          />
          <PerguntaLikert
            titulo="Preocupação com o sono"
            opcoes={PREOCUPACAO}
            valor={dados.preocupacao}
            onChange={(v) => onChange({ ...dados, preocupacao: v })}
          />
        </div>
      </div>

      <CartaoDado
        icone={Bed}
        titulo="Índice de gravidade da insônia"
        valor={score}
        unidade={`de 12 · ${faixa.nome.toLowerCase()}`}
        status={faixa.status}
        rodape={
          score >= 7
            ? 'A partir de sete pontos o DietFlow sugere aplicar o questionário completo, de sete itens.'
            : 'Soma das três respostas acima. A versão completa, de sete itens, entra quando o score passa de seis.'
        }
      >
        <BarraScore valor={score} max={12} faixas={FAIXAS_ISI} className="mt-1" />
      </CartaoDado>
    </CorpoWidget>
  )
}

function PerguntaLikert({
  titulo,
  opcoes,
  valor,
  onChange,
}: {
  titulo: string
  opcoes: Opcao<Likert>[]
  valor: Likert
  onChange: (v: Likert) => void
}) {
  return (
    <div>
      <p className="text-[13px] font-medium">{titulo}</p>
      <div className="mt-2">
        <Escolha opcoes={opcoes} valor={valor} onChange={onChange} colunas={5} />
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   HÁBITO INTESTINAL — escala de Bristol e GI Score
   ══════════════════════════════════════════════════════════ */

export type Intensidade = 0 | 1 | 2 | 3

export type DadosBristol = {
  tipo: 1 | 2 | 3 | 4 | 5 | 6 | 7
  frequencia?: 'diaria' | 'dias_alternados' | 'irregular'
  sintomas: {
    inchaco: Intensidade
    gases: Intensidade
    dorAbdominal: Intensidade
  }
  observacao?: string
}

const BRISTOL: { valor: 1 | 2 | 3 | 4 | 5 | 6 | 7; rotulo: string; detalhe: string; status: Status }[] =
  [
    { valor: 1, rotulo: 'Tipo 1', detalhe: 'Caroços duros separados, como nozes', status: 'critico' },
    { valor: 2, rotulo: 'Tipo 2', detalhe: 'Em forma de salsicha, mas grumosa', status: 'atencao' },
    { valor: 3, rotulo: 'Tipo 3', detalhe: 'Salsicha com rachaduras na superfície', status: 'ideal' },
    { valor: 4, rotulo: 'Tipo 4', detalhe: 'Salsicha ou cobra, lisa e macia', status: 'ideal' },
    { valor: 5, rotulo: 'Tipo 5', detalhe: 'Pedaços moles com bordas definidas', status: 'ideal' },
    { valor: 6, rotulo: 'Tipo 6', detalhe: 'Pedaços fofos, bordas irregulares', status: 'atencao' },
    { valor: 7, rotulo: 'Tipo 7', detalhe: 'Líquido, sem pedaços sólidos', status: 'critico' },
  ]

const FREQUENCIA: Opcao<'diaria' | 'dias_alternados' | 'irregular'>[] = [
  { valor: 'diaria', rotulo: 'Diária', detalhe: 'Todo dia', status: 'ideal' },
  { valor: 'dias_alternados', rotulo: 'Dias alternados', detalhe: 'Dia sim, dia não', status: 'adequado' },
  { valor: 'irregular', rotulo: 'Irregular', detalhe: 'Sem padrão', status: 'atencao' },
]

const SINTOMAS_GI = [
  { chave: 'inchaco' as const, rotulo: 'Inchaço', icone: CircleDot, detalhe: 'Sensação de estufamento' },
  { chave: 'gases' as const, rotulo: 'Gases', icone: Wind, detalhe: 'Flatulência excessiva' },
  { chave: 'dorAbdominal' as const, rotulo: 'Dor abdominal', icone: Flame, detalhe: 'Dor ou cólica' },
]

const INTENSIDADES: Opcao<Intensidade>[] = [
  { valor: 0, rotulo: 'Ausente', status: 'ideal' },
  { valor: 1, rotulo: 'Leve', status: 'adequado' },
  { valor: 2, rotulo: 'Moderado', status: 'atencao' },
  { valor: 3, rotulo: 'Intenso', status: 'critico' },
]

const FAIXAS_GI: { ate: number; nome: string; status: Status }[] = [
  { ate: 3, nome: 'Normal', status: 'ideal' },
  { ate: 6, nome: 'Atenção', status: 'adequado' },
  { ate: 9, nome: 'Moderado', status: 'atencao' },
  { ate: 12, nome: 'Severo', status: 'critico' },
]

/** Bristol alterado — tipos 1, 2, 6 e 7 — pesa três pontos. */
export function calcularGi(d: DadosBristol): number {
  const alterado = [1, 2, 6, 7].includes(d.tipo) ? 3 : 0
  const sintomas = d.sintomas.inchaco + d.sintomas.gases + d.sintomas.dorAbdominal
  return Math.min(alterado + sintomas, 12)
}

export function WidgetBristol({
  dados,
  onChange,
}: {
  dados: DadosBristol
  onChange: (d: DadosBristol) => void
}) {
  const score = calcularGi(dados)
  const faixa = FAIXAS_GI.find((f) => score <= f.ate)!
  const tipoAtual = BRISTOL.find((b) => b.valor === dados.tipo)!

  return (
    <CorpoWidget>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <EtiquetaSecao>Escala de Bristol</EtiquetaSecao>
          <ChipStatus status={tipoAtual.status}>{tipoAtual.rotulo}</ChipStatus>
        </div>
        <div className="mt-3">
          <Regua
            passos={BRISTOL}
            valor={dados.tipo}
            onChange={(v) => onChange({ ...dados, tipo: v })}
          />
        </div>
      </div>

      <div>
        <EtiquetaSecao>Frequência</EtiquetaSecao>
        <div className="mt-2">
          <Escolha
            opcoes={FREQUENCIA}
            valor={dados.frequencia}
            onChange={(v) => onChange({ ...dados, frequencia: v })}
            colunas={3}
          />
        </div>
      </div>

      <div>
        <EtiquetaSecao>Sintomas associados</EtiquetaSecao>
        <div className="mt-2 space-y-2">
          {SINTOMAS_GI.map((s) => {
            const nivel = dados.sintomas[s.chave]
            return (
              <div
                key={s.chave}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card px-4 py-2.5"
              >
                <span className="flex min-w-[150px] items-center gap-2">
                  <s.icone
                    className={cn(
                      'size-3.5',
                      nivel === 0 ? 'text-muted-foreground' : 'text-warning',
                    )}
                  />
                  <span className="text-[13px]">{s.rotulo}</span>
                </span>
                <div className="flex-1">
                  <Escolha
                    opcoes={INTENSIDADES}
                    valor={nivel}
                    onChange={(v) =>
                      onChange({ ...dados, sintomas: { ...dados.sintomas, [s.chave]: v } })
                    }
                    colunas={4}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <CartaoDado
        titulo="GI Score"
        valor={score}
        unidade={`de 12 · ${faixa.nome.toLowerCase()}`}
        status={faixa.status}
        rodape="Tipo alterado da escala soma três pontos. Cada sintoma soma a própria intensidade, de zero a três."
      >
        <BarraScore valor={score} max={12} faixas={FAIXAS_GI} className="mt-1" />
      </CartaoDado>

      <Textarea
        rows={2}
        value={dados.observacao ?? ''}
        placeholder="Observação livre"
        onChange={(e) => onChange({ ...dados, observacao: e.target.value })}
        className="text-[13px]"
      />
    </CorpoWidget>
  )
}

/* ══════════════════════════════════════════════════════════
   HIDRATAÇÃO — litros por dia contra a meta do perfil
   ══════════════════════════════════════════════════════════ */

export type Perfil = 'sedentario' | 'ativo' | 'atleta'

export type DadosHidratacao = {
  litrosDia: number
  perfil: Perfil
  peso: number
  maxSlider: number
}

/** Faixas em ml por quilo, exatamente como no DietFlow. */
const FAIXA_PERFIL: Record<Perfil, { min: number; max: number; nome: string }> = {
  sedentario: { min: 30, max: 35, nome: 'Sedentário' },
  ativo: { min: 35, max: 40, nome: 'Ativo' },
  atleta: { min: 40, max: 50, nome: 'Atleta' },
}

const ML_POR_COPO = 250

export function WidgetHidratacao({
  dados,
  onChange,
}: {
  dados: DadosHidratacao
  onChange: (d: DadosHidratacao) => void
}) {
  const faixa = FAIXA_PERFIL[dados.perfil]
  const metaMin = (dados.peso * faixa.min) / 1000
  const metaMax = (dados.peso * faixa.max) / 1000
  const mlPorKg = Math.round((dados.litrosDia * 1000) / dados.peso)
  const copos = Math.round((dados.litrosDia * 1000) / ML_POR_COPO)

  const status: Status =
    dados.litrosDia >= metaMin && dados.litrosDia <= metaMax
      ? 'ideal'
      : dados.litrosDia < metaMin * 0.85
        ? 'critico'
        : dados.litrosDia < metaMin
          ? 'atencao'
          : 'adequado'

  const distancia =
    dados.litrosDia < metaMin
      ? `${(metaMin - dados.litrosDia).toFixed(1)} L abaixo do mínimo`
      : dados.litrosDia > metaMax
        ? `${(dados.litrosDia - metaMax).toFixed(1)} L acima da faixa`
        : 'Dentro da faixa'

  return (
    <CorpoWidget>
      <ValorHero
        valor={dados.litrosDia.toFixed(1)}
        unidade="L por dia"
        status={status}
        metricas={<Metrica valor={mlPorKg} rotulo="ml/kg" />}
        acao={<Metrica icone={CupSoda} valor={copos} rotulo="copos de 250 ml" />}
      >
        <SliderStatus
          rotuloA11y="Litros por dia"
          valor={dados.litrosDia}
          min={0}
          max={dados.maxSlider}
          passo={0.25}
          status={status}
          marcas={Array.from({ length: dados.maxSlider + 1 }, (_, i) => i)}
          onChange={(v) => onChange({ ...dados, litrosDia: v })}
        />
      </ValorHero>

      <GradeDados>
        <CartaoDado
          icone={Droplet}
          titulo="Perfil de atividade"
          rodape={`${faixa.min} a ${faixa.max} ml por quilo`}
        >
          <Escolha
            opcoes={(Object.keys(FAIXA_PERFIL) as Perfil[]).map((p) => ({
              valor: p,
              rotulo: FAIXA_PERFIL[p].nome,
            }))}
            valor={dados.perfil}
            onChange={(v) => onChange({ ...dados, perfil: v })}
          />
        </CartaoDado>

        <CartaoDado
          icone={Scale}
          titulo="Peso"
          status={status}
          rodape={
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Meta: {metaMin.toFixed(1)} a {metaMax.toFixed(1)} L
              </span>
              <ChipStatus status={status}>{distancia}</ChipStatus>
            </span>
          }
        >
          <div className="flex items-baseline gap-1.5">
            <Input
              type="number"
              value={dados.peso}
              onChange={(e) => onChange({ ...dados, peso: Number(e.target.value) })}
              className="h-9 w-24 font-mono text-lg tabular-nums"
            />
            <span className="text-xs text-muted-foreground">kg</span>
          </div>
        </CartaoDado>
      </GradeDados>
    </CorpoWidget>
  )
}

/* ══════════════════════════════════════════════════════════
   ADESÃO — o desvio vira impacto estimado em peso
   ══════════════════════════════════════════════════════════ */

export type DadosAdesao = {
  seguiu: 'sim' | 'parcial' | 'nao'
  diferencaCalorica: number
  diasPeriodo: 7 | 14 | 30
  observacao?: string
}

/** Quilocalorias equivalentes a um quilo de gordura, como no DietFlow. */
const KCAL_POR_KG = 7700

const SEGUIU: Opcao<'sim' | 'parcial' | 'nao'>[] = [
  { valor: 'sim', rotulo: 'Sim', status: 'ideal' },
  { valor: 'parcial', rotulo: 'Parcialmente', status: 'atencao' },
  { valor: 'nao', rotulo: 'Não', status: 'critico' },
]

export function WidgetAdesao({
  dados,
  onChange,
}: {
  dados: DadosAdesao
  onChange: (d: DadosAdesao) => void
}) {
  const kcalTotal = dados.diferencaCalorica * dados.diasPeriodo
  const impactoKg = kcalTotal / KCAL_POR_KG
  const gramas = Math.round(impactoKg * 1000)

  const status: Status =
    dados.seguiu === 'sim' ? 'ideal' : dados.seguiu === 'parcial' ? 'atencao' : 'critico'

  const impacto =
    gramas === 0
      ? 'Sem impacto'
      : `${gramas > 0 ? '+' : '−'}${Math.abs(gramas) >= 1000 ? `${(Math.abs(gramas) / 1000).toFixed(1)} kg` : `${Math.abs(gramas)} g`}`

  return (
    <CorpoWidget>
      <div>
        <p className="text-sm font-medium">O paciente seguiu o plano?</p>
        <div className="mt-2.5">
          <Escolha
            opcoes={SEGUIU}
            valor={dados.seguiu}
            onChange={(v) => onChange({ ...dados, seguiu: v })}
            colunas={3}
          />
        </div>
      </div>

      <ValorHero
        valor={`${dados.diferencaCalorica > 0 ? '+' : ''}${dados.diferencaCalorica}`}
        unidade="kcal por dia"
        status={status}
        metricas={<Metrica valor={dados.diasPeriodo} rotulo="dias" />}
      >
        <SliderStatus
          rotuloA11y="Diferença calórica diária"
          valor={dados.diferencaCalorica}
          min={-1000}
          max={1000}
          passo={50}
          status={status}
          marcas={[
            { valor: -1000, rotulo: '−1000' },
            { valor: 0, rotulo: '0' },
            { valor: 1000, rotulo: '+1000' },
          ]}
          onChange={(v) => onChange({ ...dados, diferencaCalorica: v })}
        />
      </ValorHero>

      <GradeDados>
        <CartaoDado icone={Utensils} titulo="Período considerado" rodape="Janela do cálculo">
          <Escolha
            opcoes={[7, 14, 30].map((d) => ({ valor: d as 7 | 14 | 30, rotulo: `${d} dias` }))}
            valor={dados.diasPeriodo}
            onChange={(v) => onChange({ ...dados, diasPeriodo: v })}
            colunas={3}
          />
        </CartaoDado>

        <CartaoDado
          icone={Scale}
          titulo="Impacto estimado no peso"
          valor={impacto}
          status={status}
          rodape={`${kcalTotal.toLocaleString('pt-BR')} kcal no período, a ${KCAL_POR_KG.toLocaleString('pt-BR')} kcal por quilo.`}
        />
      </GradeDados>
    </CorpoWidget>
  )
}

/* ══════════════════════════════════════════════════════════
   ROTINA ALIMENTAR — o dia como ele acontece
   ══════════════════════════════════════════════════════════ */

export type RegistroDia = {
  id: string
  titulo: string
  horario?: string
  descricao: string
}

export type DadosRotina = {
  registros: RegistroDia[]
}

export function WidgetRotina({
  dados,
  onChange,
}: {
  dados: DadosRotina
  onChange: (d: DadosRotina) => void
}) {
  return (
    <CorpoWidget>
      <EtiquetaSecao>{dados.registros.length} momentos do dia</EtiquetaSecao>

      <div className="relative space-y-2 pl-5">
        <span className="absolute bottom-2 left-1.5 top-2 w-px bg-border" aria-hidden />
        {dados.registros.map((r) => (
          <div key={r.id} className="relative rounded-lg border bg-card px-4 py-3">
            <span
              className="absolute -left-[14px] top-5 size-2 rounded-full border-2 border-background bg-muted-foreground"
              aria-hidden
            />
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-[13px] font-medium">{r.titulo}</span>
              {r.horario && (
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {r.horario}
                </span>
              )}
            </div>
            <Input
              value={r.descricao}
              placeholder="O que ele come nesse momento"
              onChange={(e) =>
                onChange({
                  ...dados,
                  registros: dados.registros.map((x) =>
                    x.id === r.id ? { ...x, descricao: e.target.value } : x,
                  ),
                })
              }
              className="mt-2 h-8 text-[13px]"
            />
          </div>
        ))}
      </div>
    </CorpoWidget>
  )
}

/* ══════════════════════════════════════════════════════════
   PROBLEMAS DE SAÚDE e MEDICAÇÕES do DietFlow
   ══════════════════════════════════════════════════════════ */

export type ProblemaSaude = {
  id: string
  nome: string
  codigo?: string
  desde?: string
  controlado?: boolean
}

export type DadosProblemas = {
  problemas: ProblemaSaude[]
  observacao?: string
}

export function WidgetProblemas({
  dados,
  onChange,
}: {
  dados: DadosProblemas
  onChange: (d: DadosProblemas) => void
}) {
  const controlados = dados.problemas.filter((p) => p.controlado).length

  return (
    <CorpoWidget>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <EtiquetaSecao>{dados.problemas.length} condições relatadas</EtiquetaSecao>
        <ChipStatus status={controlados === dados.problemas.length ? 'ideal' : 'atencao'}>
          {controlados} de {dados.problemas.length} controladas
        </ChipStatus>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card divide-y">
        {dados.problemas.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
            <Apple className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 text-[13px]">{p.nome}</span>
            {p.codigo && (
              <span className="rounded border px-1.5 font-mono text-[10.5px] text-muted-foreground">
                {p.codigo}
              </span>
            )}
            {p.desde && (
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                desde {p.desde}
              </span>
            )}
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...dados,
                  problemas: dados.problemas.map((x) =>
                    x.id === p.id ? { ...x, controlado: !x.controlado } : x,
                  ),
                })
              }
            >
              <ChipStatus status={p.controlado ? 'ideal' : 'atencao'}>
                {p.controlado ? 'Controlada' : 'Não controlada'}
              </ChipStatus>
            </button>
          </div>
        ))}
      </div>

      <Textarea
        rows={2}
        value={dados.observacao ?? ''}
        placeholder="Observação"
        onChange={(e) => onChange({ ...dados, observacao: e.target.value })}
        className="text-[13px]"
      />
    </CorpoWidget>
  )
}

export type MedicacaoDietFlow = {
  id: string
  nome: string
  dose?: string
  frequencia?: string
  motivo?: string
}

export type DadosMedicacoesDietFlow = {
  medicacoes: MedicacaoDietFlow[]
  naoUsa?: boolean
}

export function WidgetMedicacoesDietFlow({
  dados,
  onChange,
}: {
  dados: DadosMedicacoesDietFlow
  onChange: (d: DadosMedicacoesDietFlow) => void
}) {
  return (
    <CorpoWidget>
      <EtiquetaSecao>{dados.medicacoes.length} em uso</EtiquetaSecao>

      <div className="overflow-hidden rounded-lg border bg-card divide-y">
        {dados.medicacoes.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
            <Pill className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-[140px] flex-1 text-[13px] font-medium">{m.nome}</span>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {m.dose}
            </span>
            <span className="text-[11px] text-muted-foreground">{m.frequencia}</span>
            {m.motivo && (
              <span className="w-full text-[11px] text-muted-foreground sm:w-auto">
                para {m.motivo}
              </span>
            )}
          </div>
        ))}
      </div>
    </CorpoWidget>
  )
}

/* ══════════════════════════════════════════════════════════
   OBSERVAÇÕES GERAIS
   ══════════════════════════════════════════════════════════ */

export type DadosObservacoesGerais = { texto: string }

export function WidgetObservacoesGerais({
  dados,
  onChange,
}: {
  dados: DadosObservacoesGerais
  onChange: (d: DadosObservacoesGerais) => void
}) {
  return (
    <CorpoWidget>
      <Textarea
        rows={4}
        value={dados.texto}
        placeholder="Texto livre"
        onChange={(e) => onChange({ texto: e.target.value })}
        className="text-[13px] leading-relaxed"
      />
    </CorpoWidget>
  )
}
