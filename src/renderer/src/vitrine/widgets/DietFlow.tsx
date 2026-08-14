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

import type { ReactNode } from 'react'
import {
  Annoyed,
  Armchair,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  BatteryWarning,
  Bike,
  Brain,
  CircleDot,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CupSoda,
  Droplet,
  Flame,
  Frown,
  Laugh,
  Meh,
  Moon,
  PlugZap,
  Scale,
  Smile,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Utensils,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  BarraScore,
  ChipStatus,
  CorpoWidget,
  Escolha,
  EtiquetaSecao,
  Metrica,
  Intensidade as BarrasIntensidade,
  Regua,
  SliderStatus,
  STATUS,
  ValorHero,
  type Opcao,
  type Status,
} from '../primitivos'

/* ══════════════════════════════════════════════════════════
   COMPOSIÇÃO — três formas que se repetem nos oito widgets

   Uma seção rotulada, um painel de duas células com rodapé comum e um
   fechamento de score. Repetir só essas três é o que dá ritmo vertical
   constante ao conjunto: quem aprende a ler um widget já leu os oito.
   ══════════════════════════════════════════════════════════ */

/** Seção rotulada: etiqueta à esquerda, um aparte à direita, conteúdo abaixo. */
function Secao({
  icone: Icone,
  titulo,
  aparte,
  children,
  className,
}: {
  icone?: LucideIcon
  titulo: string
  aparte?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={className}>
      <div className="flex min-h-5 items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5">
          {Icone && <Icone className="size-3.5 shrink-0 text-muted-foreground" />}
          <EtiquetaSecao>{titulo}</EtiquetaSecao>
        </span>
        {aparte}
      </div>
      <div className="mt-2.5">{children}</div>
    </section>
  )
}

/**
 * Duas células de naturezas diferentes sob um rodapé que vale para as duas.
 *
 * É a resposta ao degrau: dois cartões lado a lado com conteúdos de alturas
 * diferentes nunca fecham na mesma linha. Um cartão só, dividido por dentro,
 * fecha sempre — e o rodapé ganha a largura inteira em vez de espremer um
 * chip que quebra linha.
 *
 * `classeGrade` chega como literal porque o Tailwind lê o código-fonte: uma
 * classe montada em tempo de execução não existiria na folha de estilo.
 */
function PainelDuplo({
  classeGrade,
  principal,
  lateral,
  rodape,
}: {
  classeGrade: string
  principal: ReactNode
  lateral: ReactNode
  rodape?: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className={cn('grid divide-y sm:divide-x sm:divide-y-0', classeGrade)}>
        <div className="px-4 py-3.5">{principal}</div>
        <div className="px-4 py-3.5">{lateral}</div>
      </div>
      {rodape && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t bg-muted/25 px-4 py-2.5">
          {rodape}
        </div>
      )}
    </div>
  )
}

/** O número do score ao lado da escala inteira, para se ver onde ele caiu. */
function LinhaScore({
  score,
  max,
  faixas,
  className,
}: {
  score: number
  max: number
  faixas: { ate: number; nome: string; status: Status }[]
  className?: string
}) {
  const faixa = faixas.find((f) => score <= f.ate) ?? faixas[faixas.length - 1]
  return (
    <div className={cn('flex items-center gap-5', className)}>
      <span
        className={cn(
          'font-mono text-[34px] font-light leading-none tabular-nums',
          STATUS[faixa.status].texto,
        )}
      >
        {score}
      </span>
      <BarraScore valor={score} max={max} faixas={faixas} className="min-w-0 flex-1" />
    </div>
  )
}

/** Fechamento de score quando ele não está grudado no bloco que o gerou. */
function PainelScore({
  titulo,
  aparte,
  score,
  max,
  faixas,
  nota,
}: {
  titulo: string
  aparte?: ReactNode
  score: number
  max: number
  faixas: { ate: number; nome: string; status: Status }[]
  nota: string
}) {
  const faixa = faixas.find((f) => score <= f.ate) ?? faixas[faixas.length - 1]
  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card', STATUS[faixa.status].borda)}>
      <div className="px-4 pb-3.5 pt-3">
        <div className="flex items-center justify-between gap-3">
          <EtiquetaSecao>{titulo}</EtiquetaSecao>
          {aparte}
        </div>
        <LinhaScore score={score} max={max} faixas={faixas} className="mt-3" />
      </div>
      <p className="border-t bg-muted/25 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
        {nota}
      </p>
    </div>
  )
}

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

/** Os ícones são os do DietFlow: a escala se lê pela cara antes do texto. */
const SATISFACAO: Opcao<Likert>[] = [
  { valor: 0, rotulo: 'Muito bem', detalhe: 'Durmo muito bem', status: 'ideal', icone: Laugh },
  { valor: 1, rotulo: 'Bem', detalhe: 'Durmo bem', status: 'ideal', icone: Smile },
  { valor: 2, rotulo: 'Mais ou menos', detalhe: 'Nem bom nem ruim', status: 'adequado', icone: Meh },
  { valor: 3, rotulo: 'Mal', detalhe: 'Durmo mal', status: 'atencao', icone: Frown },
  { valor: 4, rotulo: 'Muito mal', detalhe: 'Durmo muito mal', status: 'critico', icone: Annoyed },
]

const INTERFERENCIA: Opcao<Likert>[] = [
  { valor: 0, rotulo: 'Nada', detalhe: 'Não interfere', status: 'ideal', icone: BatteryFull },
  { valor: 1, rotulo: 'Quase nada', detalhe: 'Quase não interfere', status: 'ideal', icone: BatteryMedium },
  { valor: 2, rotulo: 'Um pouco', detalhe: 'Interfere um pouco', status: 'adequado', icone: BatteryLow },
  { valor: 3, rotulo: 'Bastante', detalhe: 'Interfere bastante', status: 'atencao', icone: BatteryWarning },
  { valor: 4, rotulo: 'Demais', detalhe: 'Interfere demais', status: 'critico', icone: PlugZap },
]

const PREOCUPACAO: Opcao<Likert>[] = [
  { valor: 0, rotulo: 'Nenhuma', detalhe: 'Não me preocupo', status: 'ideal', icone: Brain },
  { valor: 1, rotulo: 'Pouca', detalhe: 'Quase não me preocupo', status: 'ideal', icone: Cloud },
  { valor: 2, rotulo: 'Alguma', detalhe: 'Me preocupo um pouco', status: 'adequado', icone: CloudFog },
  { valor: 3, rotulo: 'Muita', detalhe: 'Me preocupo bastante', status: 'atencao', icone: CloudLightning },
  { valor: 4, rotulo: 'Demais', detalhe: 'Me preocupo demais', status: 'critico', icone: CloudRain },
]

/** Faixas do ISI-3 tal como o DietFlow as define. */
const FAIXAS_ISI: { ate: number; nome: string; status: Status }[] = [
  { ate: 3, nome: 'Sono adequado', status: 'ideal' },
  { ate: 6, nome: 'Atenção', status: 'adequado' },
  { ate: 9, nome: 'Insônia provável', status: 'atencao' },
  { ate: 12, nome: 'Insônia clínica provável', status: 'critico' },
]

/** As três perguntas que somam o índice, na ordem em que são feitas. */
const PERGUNTAS_ISI: {
  chave: string
  titulo: string
  opcoes: Opcao<Likert>[]
  ler: (d: DadosSono) => Likert
  gravar: (d: DadosSono, v: Likert) => DadosSono
}[] = [
  {
    chave: 'satisfacao',
    titulo: 'Satisfação com o sono',
    opcoes: SATISFACAO,
    ler: (d) => d.satisfacao,
    gravar: (d, v) => ({ ...d, satisfacao: v }),
  },
  {
    chave: 'interferencia',
    titulo: 'Quanto atrapalha o dia',
    opcoes: INTERFERENCIA,
    ler: (d) => d.interferenciaDiurna,
    gravar: (d, v) => ({ ...d, interferenciaDiurna: v }),
  },
  {
    chave: 'preocupacao',
    titulo: 'Preocupação com o sono',
    opcoes: PREOCUPACAO,
    ler: (d) => d.preocupacao,
    gravar: (d, v) => ({ ...d, preocupacao: v }),
  },
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

      {/*
        As três perguntas e o índice que elas somam moram no mesmo cartão. O
        score é o rodapé da conversa, não um cartão à parte — e cada pergunta
        mostra quantos pontos entregou, então a soma se lê na vertical.
      */}
      <div className={cn('overflow-hidden rounded-xl border bg-card', STATUS[faixa.status].borda)}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b px-4 py-3">
          <span className="text-[13px] font-medium">Como ele avalia o próprio sono</span>
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            ISI-3 · três perguntas
          </span>
        </div>

        <div className="divide-y">
          {PERGUNTAS_ISI.map((p) => {
            const valor = p.ler(dados)
            const opcao = p.opcoes.find((o) => o.valor === valor)
            return (
              <div key={p.chave} className="px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <EtiquetaSecao>{p.titulo}</EtiquetaSecao>
                  <span
                    className={cn(
                      'shrink-0 font-mono text-[11px] tabular-nums',
                      STATUS[opcao?.status ?? 'neutro'].texto,
                    )}
                  >
                    {valor} {valor === 1 ? 'ponto' : 'pontos'}
                  </span>
                </div>
                <Escolha
                  className="mt-2.5"
                  opcoes={p.opcoes}
                  valor={valor}
                  onChange={(v) => onChange(p.gravar(dados, v))}
                  colunas={5}
                />
              </div>
            )
          })}
        </div>

        <div className="border-t bg-muted/25 px-4 py-3.5">
          <LinhaScore score={score} max={12} faixas={FAIXAS_ISI} />
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            {score >= 7
              ? 'A partir de sete pontos o DietFlow sugere aplicar o questionário completo, de sete itens.'
              : 'Soma das três respostas acima. A versão completa, de sete itens, entra quando o score passa de seis.'}
          </p>
        </div>
      </div>
    </CorpoWidget>
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
  { valor: 'diaria', rotulo: 'Todo dia', detalhe: 'Frequência diária', status: 'ideal' },
  { valor: 'dias_alternados', rotulo: 'Dia sim, dia não', detalhe: 'Alternada', status: 'adequado' },
  { valor: 'irregular', rotulo: 'Sem padrão', detalhe: 'Irregular', status: 'atencao' },
]

const SINTOMAS_GI = [
  { chave: 'inchaco' as const, rotulo: 'Inchaço', icone: CircleDot, detalhe: 'Sensação de estufamento' },
  { chave: 'gases' as const, rotulo: 'Gases', icone: Wind, detalhe: 'Flatulência excessiva' },
  { chave: 'dorAbdominal' as const, rotulo: 'Dor abdominal', icone: Flame, detalhe: 'Dor ou cólica' },
]

/** Os mesmos quatro tons do primitivo de intensidade, para o ícone acompanhar. */
const TONS_INTENSIDADE: Status[] = ['neutro', 'adequado', 'atencao', 'critico']

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
  const tipoAtual = BRISTOL.find((b) => b.valor === dados.tipo)!

  return (
    <CorpoWidget className="gap-5">
      {/* O chip diz o julgamento; a régua, logo abaixo, diz o tipo e a descrição.
          Repetir "Tipo 2" nos dois lugares seria gastar a linha à toa. */}
      <Secao titulo="Escala de Bristol" aparte={<ChipStatus status={tipoAtual.status} />}>
        <Regua
          passos={BRISTOL}
          valor={dados.tipo}
          onChange={(v) => onChange({ ...dados, tipo: v })}
        />
      </Secao>

      <Secao titulo="Frequência">
        <Escolha
          opcoes={FREQUENCIA}
          valor={dados.frequencia}
          onChange={(v) => onChange({ ...dados, frequencia: v })}
          colunas={3}
        />
      </Secao>

      {/* Uma linha por sintoma, com as barras todas na mesma coluna: três
          medidas da mesma coisa se comparam de relance quando se alinham. */}
      <Secao titulo="Sintomas associados">
        <div className="divide-y overflow-hidden rounded-xl border bg-card">
          {SINTOMAS_GI.map((s) => {
            const nivel = dados.sintomas[s.chave]
            const Icone = s.icone
            return (
              <div
                key={s.chave}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-2.5"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Icone
                    className={cn('size-4 shrink-0', STATUS[TONS_INTENSIDADE[nivel]].texto)}
                  />
                  <span className="min-w-0 truncate text-[13px] leading-tight">
                    <span className="font-medium">{s.rotulo}</span>
                    <span className="text-muted-foreground"> · {s.detalhe}</span>
                  </span>
                </span>
                <BarrasIntensidade
                  valor={nivel}
                  onChange={(v) =>
                    onChange({ ...dados, sintomas: { ...dados.sintomas, [s.chave]: v } })
                  }
                />
              </div>
            )
          })}
        </div>
      </Secao>

      <PainelScore
        titulo="GI Score"
        score={score}
        max={12}
        faixas={FAIXAS_GI}
        nota="Tipo alterado da escala soma três pontos. Cada sintoma soma a própria intensidade, de zero a três."
      />

      <Secao titulo="Observação">
        <Textarea
          rows={2}
          value={dados.observacao ?? ''}
          placeholder="Observação livre"
          onChange={(e) => onChange({ ...dados, observacao: e.target.value })}
          className="text-[13px]"
        />
      </Secao>
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

const ICONE_PERFIL: Record<Perfil, typeof Armchair> = {
  sedentario: Armchair,
  ativo: Bike,
  atleta: Trophy,
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

      {/* Perfil e peso são as duas entradas que produzem a meta — e a meta que
          elas produzem é o rodapé das duas, não o rodapé de uma delas. */}
      <PainelDuplo
        classeGrade="sm:grid-cols-[minmax(0,1fr)_11rem]"
        principal={
          <Secao icone={Droplet} titulo="Perfil de atividade">
            <Escolha
              opcoes={(Object.keys(FAIXA_PERFIL) as Perfil[]).map((p) => ({
                valor: p,
                rotulo: FAIXA_PERFIL[p].nome,
                icone: ICONE_PERFIL[p],
              }))}
              valor={dados.perfil}
              onChange={(v) => onChange({ ...dados, perfil: v })}
              colunas={3}
            />
          </Secao>
        }
        lateral={
          <Secao icone={Scale} titulo="Peso">
            <div className="flex items-baseline gap-1.5">
              <Input
                type="number"
                value={dados.peso}
                onChange={(e) => onChange({ ...dados, peso: Number(e.target.value) })}
                className="h-9 w-20 font-mono text-lg tabular-nums"
              />
              <span className="text-xs text-muted-foreground">kg</span>
            </div>
          </Secao>
        }
        rodape={
          <>
            <span className="text-[11.5px] text-muted-foreground">
              Meta de{' '}
              <span className="font-mono tabular-nums text-foreground">
                {metaMin.toFixed(1)} a {metaMax.toFixed(1)} L
              </span>{' '}
              por dia · {faixa.min} a {faixa.max} ml por quilo
            </span>
            <ChipStatus status={status}>{distancia}</ChipStatus>
          </>
        }
      />
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
  { valor: 'sim', rotulo: 'Seguiu', status: 'ideal', icone: ThumbsUp },
  { valor: 'parcial', rotulo: 'Em parte', status: 'atencao', icone: Meh },
  { valor: 'nao', rotulo: 'Não seguiu', status: 'critico', icone: ThumbsDown },
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

  // Mesmo número de sempre, só separado da unidade: o valor fica em mono
  // grande e o "g" recua, como em todo valor hero do repertório.
  const absoluto = Math.abs(gramas)
  const impactoValor =
    gramas === 0
      ? null
      : `${gramas > 0 ? '+' : '−'}${absoluto >= 1000 ? (absoluto / 1000).toFixed(1) : absoluto}`
  const impactoUnidade = absoluto >= 1000 ? 'kg' : 'g'

  return (
    <CorpoWidget className="gap-5">
      <Secao titulo="O paciente seguiu o plano?">
        <Escolha
          opcoes={SEGUIU}
          valor={dados.seguiu}
          onChange={(v) => onChange({ ...dados, seguiu: v })}
          colunas={3}
        />
      </Secao>

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

      {/* A janela escolhida e o resultado que ela produz, com a conta inteira
          no rodapé — entrada e saída no mesmo cartão, sem degrau entre elas. */}
      <PainelDuplo
        classeGrade="sm:grid-cols-[minmax(0,1fr)_15rem]"
        principal={
          <Secao icone={Utensils} titulo="Período considerado">
            <Escolha
              opcoes={[7, 14, 30].map((d) => ({ valor: d as 7 | 14 | 30, rotulo: `${d} dias` }))}
              valor={dados.diasPeriodo}
              onChange={(v) => onChange({ ...dados, diasPeriodo: v })}
              colunas={3}
            />
          </Secao>
        }
        lateral={
          <Secao icone={Scale} titulo="Impacto estimado no peso">
            {impactoValor ? (
              <span className="flex items-baseline gap-1.5">
                <span
                  className={cn(
                    'font-mono text-[26px] font-light leading-none tabular-nums',
                    STATUS[status].texto,
                  )}
                >
                  {impactoValor}
                </span>
                <span className="text-xs text-muted-foreground">{impactoUnidade}</span>
              </span>
            ) : (
              <span className="text-[13px] text-muted-foreground">Sem impacto</span>
            )}
          </Secao>
        }
        rodape={
          <span className="text-[11.5px] text-muted-foreground">
            <span className="font-mono tabular-nums text-foreground">
              {kcalTotal.toLocaleString('pt-BR')} kcal
            </span>{' '}
            no período, a {KCAL_POR_KG.toLocaleString('pt-BR')} kcal por quilo.
          </span>
        }
      />

      <Secao titulo="Observação">
        <Textarea
          rows={2}
          value={dados.observacao ?? ''}
          placeholder="Observação livre"
          onChange={(e) => onChange({ ...dados, observacao: e.target.value })}
          className="text-[13px]"
        />
      </Secao>
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
  const horarios = dados.registros.map((r) => r.horario).filter((h): h is string => Boolean(h))
  const janela =
    horarios.length > 1 ? `${horarios[0]} às ${horarios[horarios.length - 1]}` : undefined

  return (
    <CorpoWidget>
      <Secao
        titulo={`${dados.registros.length} momentos do dia`}
        aparte={
          janela && (
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {janela}
            </span>
          )
        }
      >
        {/*
          Uma linha por momento: horário, nome e o que se come, tudo na mesma
          altura. O campo perde a moldura e ganha a coluna — o dia se lê como
          uma agenda, não como seis formulários empilhados.
        */}
        {/* A régua fica fora do cartão: `overflow-hidden` cortaria as bolinhas. */}
        <div className="relative pl-5">
          <span className="absolute bottom-5 left-[3px] top-5 w-px bg-border" aria-hidden />
          <ul className="divide-y rounded-xl border bg-card">
            {dados.registros.map((r) => (
              <li
                key={r.id}
                className="relative grid items-center gap-x-3 gap-y-0.5 px-3 py-2 sm:grid-cols-[2.75rem_7.5rem_minmax(0,1fr)]"
              >
                <span
                  className="absolute -left-[20px] top-1/2 size-2 -translate-y-1/2 rounded-full border-2 border-background bg-muted-foreground"
                  aria-hidden
                />
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {r.horario}
                </span>
                <span className="truncate text-[13px] font-medium">{r.titulo}</span>
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
                  className="h-8 rounded-md border-transparent bg-transparent px-2 text-[13px] shadow-none hover:border-input focus-visible:border-input"
                />
              </li>
            ))}
          </ul>
        </div>
      </Secao>
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

/**
 * Cabeçalho de colunas da tabela. Existe para que o dado não precise carregar
 * o próprio rótulo em cada linha: com a coluna nomeada, "desde 2018" vira
 * "2018" e as três linhas passam a se comparar em vez de se repetir.
 */
function CabecalhoColunas({
  classeGrade,
  colunas,
  alinharFim,
}: {
  classeGrade: string
  colunas: string[]
  /** A última coluna termina na direita — vale quando ela guarda um chip. */
  alinharFim?: boolean
}) {
  return (
    <div className={cn('hidden gap-x-4 border-b bg-muted/30 px-4 py-2 sm:grid', classeGrade)}>
      {colunas.map((c, i) => (
        <span
          key={c}
          className={alinharFim && i === colunas.length - 1 ? 'justify-self-end' : undefined}
        >
          <EtiquetaSecao>{c}</EtiquetaSecao>
        </span>
      ))}
    </div>
  )
}

const GRADE_PROBLEMAS = 'sm:grid-cols-[minmax(0,1fr)_5rem_5rem_9.5rem]'

export function WidgetProblemas({
  dados,
  onChange,
}: {
  dados: DadosProblemas
  onChange: (d: DadosProblemas) => void
}) {
  const controlados = dados.problemas.filter((p) => p.controlado).length

  return (
    <CorpoWidget className="gap-5">
      <Secao
        titulo="Condições relatadas"
        aparte={
          <ChipStatus status={controlados === dados.problemas.length ? 'ideal' : 'atencao'}>
            {controlados} de {dados.problemas.length} controladas
          </ChipStatus>
        }
      >
        <div className="overflow-hidden rounded-xl border bg-card">
          <CabecalhoColunas
            classeGrade={GRADE_PROBLEMAS}
            colunas={['Condição', 'Código', 'Desde', 'Controle']}
            alinharFim
          />
          <div className="divide-y">
            {dados.problemas.map((p) => (
              <div
                key={p.id}
                className={cn(
                  'grid gap-x-4 gap-y-1.5 px-4 py-2.5 sm:items-center',
                  GRADE_PROBLEMAS,
                )}
              >
                <span className="min-w-0 truncate text-[13px]">{p.nome}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {p.codigo ?? '—'}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {p.desde ?? '—'}
                </span>
                <button
                  type="button"
                  className="justify-self-start sm:justify-self-end"
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
        </div>
      </Secao>

      <Secao titulo="Observação">
        <Textarea
          rows={2}
          value={dados.observacao ?? ''}
          placeholder="Observação"
          onChange={(e) => onChange({ ...dados, observacao: e.target.value })}
          className="text-[13px]"
        />
      </Secao>
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

const GRADE_MEDICACOES = 'sm:grid-cols-[minmax(0,1.5fr)_5rem_6.5rem_minmax(0,1fr)]'

/** A lista é somente leitura, como no DietFlow — `onChange` existe para o
 *  registro de widgets tipar todos os oito da mesma forma. */
export function WidgetMedicacoesDietFlow({
  dados,
}: {
  dados: DadosMedicacoesDietFlow
  onChange: (d: DadosMedicacoesDietFlow) => void
}) {
  return (
    <CorpoWidget>
      {/* Sem etiqueta de seção: o cabeçalho do cartão já nomeia a lista e as
          colunas se explicam sozinhas. Uma etiqueta aqui só repetiria. */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <CabecalhoColunas
          classeGrade={GRADE_MEDICACOES}
          colunas={['Medicação', 'Dose', 'Frequência', 'Motivo']}
        />
        <div className="divide-y">
          {dados.medicacoes.map((m) => (
            <div
              key={m.id}
              className={cn('grid gap-x-4 gap-y-1.5 px-4 py-2.5 sm:items-center', GRADE_MEDICACOES)}
            >
              <span className="min-w-0 truncate text-[13px] font-medium">{m.nome}</span>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {m.dose ?? '—'}
              </span>
              <span className="text-[11px] text-muted-foreground">{m.frequencia ?? '—'}</span>
              <span className="truncate text-[11px] text-muted-foreground">{m.motivo ?? '—'}</span>
            </div>
          ))}
        </div>
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
