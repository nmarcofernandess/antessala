/**
 * Apoio e contexto: `accommodations@1`, `habits_substances@1`,
 * `special_conditions@1`, `exams_pending@1`, `procedure_context@1` e
 * `clinical_notes@1`.
 *
 * A acomodação é o widget que mais muda a agenda: ela não descreve o paciente,
 * descreve o que a vaga precisa ter. Intérprete de Libras, sala acessível e
 * acompanhante legal viram requisito da sala, e por isso somam dez minutos
 * fora do teto que limita os demais domínios.
 *
 * Composição: as três necessidades moram numa moldura só, com a coluna de
 * ícones batendo entre linhas e um trilho colorido em quem foi positivo. Nos
 * exames, os três estados são um controle segmentado — escolha, não enfeite.
 */

import { useId, type ReactNode } from 'react'
import {
  Accessibility,
  CalendarClock,
  Cigarette,
  FileText,
  Languages,
  UserRoundCheck,
  Wine,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  ChipStatus,
  CorpoWidget,
  Escolha,
  EtiquetaSecao,
  GradeDados,
  STATUS,
  type Status,
} from '../primitivos'
import { PerguntaChave } from './PerguntaChave'
import { positiva } from './tipos'
import type {
  DadosAcomodacao,
  DadosCondicoesEspeciais,
  DadosContexto,
  DadosExames,
  DadosHabitos,
  DadosObservacoes,
  StatusExame,
  UsoSubstancia,
} from './tipos'

/* ══════════════ trilho de pergunta ══════════════ */

/** Moldura única para uma sequência de perguntas — uma borda, não três. */
export function ListaPerguntas({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-lg border bg-card', className)}>{children}</div>
  )
}

/**
 * Uma linha da lista. Envolver a `PerguntaChave compacta` neutraliza o `first:`
 * do primitivo, então é o trilho que manda no respiro e na cor — daí o
 * `[&>div]:py-0`. `tom` diz de qual natureza é o positivo: atenção quando é
 * achado clínico, primary quando é recurso que a vaga precisa ter.
 */
export function LinhaPergunta({
  destaque,
  tom = 'atencao',
  icone: Icone,
  className,
  children,
}: {
  destaque?: boolean
  tom?: 'atencao' | 'primary'
  icone?: typeof Languages
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'relative flex items-center gap-3 border-t py-3 pl-4 pr-3.5 transition-colors first:border-t-0',
        '[&>div]:min-w-0 [&>div]:flex-1 [&>div]:py-0',
        destaque && (tom === 'primary' ? 'bg-primary/[0.06]' : 'bg-warning/[0.07]'),
        className,
      )}
    >
      {destaque && (
        <span
          className={cn(
            'absolute inset-y-0 left-0 w-[3px]',
            tom === 'primary' ? 'bg-primary' : 'bg-warning',
          )}
          aria-hidden
        />
      )}
      {Icone && (
        <Icone
          className={cn(
            'size-4 shrink-0',
            destaque && tom === 'primary' ? 'text-primary' : 'text-muted-foreground',
          )}
        />
      )}
      {children}
    </div>
  )
}

/* ══════════════ acomodação ══════════════ */

export function WidgetAcomodacao({
  dados,
  onChange,
}: {
  dados: DadosAcomodacao
  onChange: (d: DadosAcomodacao) => void
}) {
  const necessidades = [
    positiva(dados.comunicacao),
    positiva(dados.mobilidade),
    positiva(dados.representanteLegal),
  ].filter(Boolean).length

  return (
    <CorpoWidget>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <EtiquetaSecao>O que a vaga precisa ter</EtiquetaSecao>
        {necessidades > 0 && (
          <ChipStatus status="adequado">Soma 10 min · fora do teto</ChipStatus>
        )}
      </div>

      <ListaPerguntas>
        <BlocoAcomodacao
          icone={Languages}
          pergunta="O paciente precisa de apoio para se comunicar?"
          apoio="Intérprete de Libras, tradução, comunicação por escrito."
          resposta={dados.comunicacao}
          onChange={(r) => onChange({ ...dados, comunicacao: r })}
          detalhe={dados.descricaoComunicacao}
          onDetalhe={(v) => onChange({ ...dados, descricaoComunicacao: v })}
          placeholder="Qual apoio? Ex.: intérprete de Libras durante toda a consulta."
        />

        <BlocoAcomodacao
          icone={Accessibility}
          pergunta="Precisa de apoio para se locomover ou se posicionar?"
          apoio="Cadeira de rodas, maca, sala térrea, ajuda para subir na mesa."
          resposta={dados.mobilidade}
          onChange={(r) => onChange({ ...dados, mobilidade: r })}
          detalhe={dados.descricaoMobilidade}
          onDetalhe={(v) => onChange({ ...dados, descricaoMobilidade: v })}
          placeholder="Qual apoio? Ex.: sala acessível e transferência com auxílio."
        />

        {/* A terceira não abre campo nenhum: é marcação, e o rodapé diz isso. */}
        <LinhaPergunta
          destaque={positiva(dados.representanteLegal)}
          tom="primary"
          icone={UserRoundCheck}
          className={cn(!positiva(dados.representanteLegal) && 'bg-muted/20')}
        >
          <PerguntaChave
            compacta
            pergunta="Precisa de representante legal para decidir?"
            resposta={dados.representanteLegal}
            onChange={(r) => onChange({ ...dados, representanteLegal: r })}
          />
        </LinhaPergunta>
      </ListaPerguntas>

      {necessidades > 0 && (
        <p className="rounded-lg border border-dashed px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
          A recepção não vê o motivo clínico — ela vê que esta vaga exige o recurso. É o que
          permite agendar sem expor a condição do paciente na tela do balcão.
        </p>
      )}
    </CorpoWidget>
  )
}

function BlocoAcomodacao({
  icone: Icone,
  pergunta,
  apoio,
  resposta,
  onChange,
  detalhe,
  onDetalhe,
  placeholder,
}: {
  icone: typeof Languages
  pergunta: string
  apoio: string
  resposta: DadosAcomodacao['comunicacao']
  onChange: (r: DadosAcomodacao['comunicacao']) => void
  detalhe?: string
  onDetalhe: (v: string) => void
  placeholder: string
}) {
  const sim = positiva(resposta)
  return (
    <div
      className={cn(
        'relative flex items-start gap-3 border-t py-3.5 pl-4 pr-4 transition-colors first:border-t-0',
        sim && 'bg-primary/[0.06]',
      )}
    >
      {sim && <span className="absolute inset-y-0 left-0 w-[3px] bg-primary" aria-hidden />}
      <Icone
        className={cn('mt-0.5 size-4 shrink-0', sim ? 'text-primary' : 'text-muted-foreground')}
      />
      <div className="min-w-0 flex-1">
        <PerguntaChave
          pergunta={pergunta}
          apoio={apoio}
          resposta={resposta}
          onChange={onChange}
          statusQuandoSim="adequado"
        />
        {sim && (
          <Input
            value={detalhe ?? ''}
            placeholder={placeholder}
            onChange={(e) => onDetalhe(e.target.value)}
            className="mt-3 h-9 bg-card text-[13px]"
          />
        )}
      </div>
    </div>
  )
}

/* ══════════════ hábitos ══════════════ */

const USO: { valor: UsoSubstancia; rotulo: string; status: Status }[] = [
  { valor: 'NUNCA', rotulo: 'Nunca usou', status: 'ideal' },
  { valor: 'EX_USUARIO', rotulo: 'Parou', status: 'adequado' },
  { valor: 'ATUAL', rotulo: 'Usa hoje', status: 'atencao' },
]

export function WidgetHabitos({
  dados,
  onChange,
}: {
  dados: DadosHabitos
  onChange: (d: DadosHabitos) => void
}) {
  return (
    <CorpoWidget>
      <p className="max-w-[80ch] text-xs leading-relaxed text-muted-foreground">
        “Parou” é diferente de “nunca usou”, e as duas são diferentes de não ter perguntado.
        Cada uma leva a uma conversa distinta na consulta.
      </p>

      <GradeDados>
        <CartaoHabito
          icone={Cigarette}
          titulo="Tabaco"
          resposta={dados.tabaco}
          onChange={(r) => onChange({ ...dados, tabaco: r })}
          detalhe={dados.detalheTabaco}
          onDetalhe={(v) => onChange({ ...dados, detalheTabaco: v })}
          placeholder="Quantidade e há quanto tempo"
        />
        <CartaoHabito
          icone={Wine}
          titulo="Álcool"
          resposta={dados.alcool}
          onChange={(r) => onChange({ ...dados, alcool: r })}
          detalhe={dados.detalheAlcool}
          onDetalhe={(v) => onChange({ ...dados, detalheAlcool: v })}
          placeholder="Frequência e quantidade"
        />
      </GradeDados>

      <ListaPerguntas>
        <LinhaPergunta destaque={positiva(dados.outrasSubstancias)}>
          <PerguntaChave
            compacta
            pergunta="Usa outras substâncias?"
            resposta={dados.outrasSubstancias}
            onChange={(r) => onChange({ ...dados, outrasSubstancias: r })}
          />
        </LinhaPergunta>
      </ListaPerguntas>
    </CorpoWidget>
  )
}

function CartaoHabito({
  icone: Icone,
  titulo,
  resposta,
  onChange,
  detalhe,
  onDetalhe,
  placeholder,
}: {
  icone: typeof Cigarette
  titulo: string
  resposta: DadosHabitos['tabaco']
  onChange: (r: DadosHabitos['tabaco']) => void
  detalhe?: string
  onDetalhe: (v: string) => void
  placeholder: string
}) {
  const valor = resposta.estado === 'RESPONDIDO' ? resposta.valor : undefined
  return (
    <div className="flex h-full flex-col rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center gap-2">
        <Icone className="size-3.5 shrink-0 text-muted-foreground" />
        <EtiquetaSecao>{titulo}</EtiquetaSecao>
      </div>

      <div className="mt-2.5">
        <Escolha
          opcoes={USO.map((u) => ({ valor: u.valor, rotulo: u.rotulo, status: u.status }))}
          valor={valor}
          onChange={(v) => onChange({ estado: 'RESPONDIDO', valor: v })}
          colunas={3}
        />
      </div>

      {/* Slot reservado: o detalhe entra e sai sem os dois cartões trocarem de altura. */}
      <div className="mt-2.5 h-9">
        {valor && valor !== 'NUNCA' && (
          <Input
            value={detalhe ?? ''}
            placeholder={placeholder}
            onChange={(e) => onDetalhe(e.target.value)}
            className="h-9 text-[13px]"
          />
        )}
      </div>
    </div>
  )
}

/* ══════════════ condições especiais ══════════════ */

export function WidgetCondicoesEspeciais({
  dados,
  onChange,
}: {
  dados: DadosCondicoesEspeciais
  onChange: (d: DadosCondicoesEspeciais) => void
}) {
  const campoOutra = useId()
  const gestante = positiva(dados.gestante)

  return (
    <CorpoWidget>
      <ListaPerguntas>
        <LinhaPergunta destaque={gestante}>
          <PerguntaChave
            compacta
            pergunta="Está gestante?"
            resposta={dados.gestante}
            onChange={(r) => onChange({ ...dados, gestante: r })}
          />
        </LinhaPergunta>
        <LinhaPergunta destaque={positiva(dados.lactante)}>
          <PerguntaChave
            compacta
            pergunta="Está amamentando?"
            resposta={dados.lactante}
            onChange={(r) => onChange({ ...dados, lactante: r })}
          />
        </LinhaPergunta>
      </ListaPerguntas>

      {gestante && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
          <EtiquetaSecao>Semanas de gestação</EtiquetaSecao>
          <Input
            type="number"
            aria-label="Semanas de gestação"
            value={dados.semanasGestacao ?? ''}
            onChange={(e) => onChange({ ...dados, semanasGestacao: Number(e.target.value) })}
            className="h-9 w-24 bg-card font-mono text-base tabular-nums"
          />
        </div>
      )}

      <div>
        <label htmlFor={campoOutra}>
          <EtiquetaSecao>Outra condição declarada pelo paciente</EtiquetaSecao>
        </label>
        <Input
          id={campoOutra}
          value={dados.outraCondicao ?? ''}
          placeholder="Só o que ele declarou — o app não deduz condição."
          onChange={(e) => onChange({ ...dados, outraCondicao: e.target.value })}
          className="mt-2 h-9 text-[13px]"
        />
      </div>
    </CorpoWidget>
  )
}

/* ══════════════ exames ══════════════ */

const STATUS_EXAME: Record<StatusExame, { rotulo: string; status: Status }> = {
  DISPONIVEL: { rotulo: 'Em mãos', status: 'ideal' },
  SOLICITADO: { rotulo: 'Solicitado', status: 'atencao' },
  AUSENTE: { rotulo: 'Não tem', status: 'critico' },
}

const ORDEM_EXAME = Object.keys(STATUS_EXAME) as StatusExame[]

/**
 * Os três estados de um exame são uma escolha só, e por isso vivem dentro de
 * um mesmo sulco: o selecionado sobe para a cor do estado, os outros recuam.
 */
function SeletorExame({
  nome,
  valor,
  onChange,
}: {
  nome: string
  valor: StatusExame
  onChange: (s: StatusExame) => void
}) {
  return (
    <div
      role="group"
      aria-label={`Situação de ${nome}`}
      className="flex shrink-0 gap-0.5 rounded-lg border bg-muted/50 p-0.5"
    >
      {ORDEM_EXAME.map((s) => {
        const ativo = valor === s
        const def = STATUS_EXAME[s]
        const tom = STATUS[def.status]
        return (
          <button
            key={s}
            type="button"
            aria-pressed={ativo}
            onClick={() => onChange(s)}
            className={cn(
              'flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[11px] font-medium transition-all',
              ativo
                ? cn('bg-card shadow-sm', tom.texto)
                : 'text-muted-foreground/70 hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'size-1.5 rounded-full transition-colors',
                ativo ? tom.ponto : 'bg-muted-foreground/30',
              )}
              aria-hidden
            />
            {def.rotulo}
          </button>
        )
      })}
    </div>
  )
}

export function WidgetExames({
  dados,
  onChange,
}: {
  dados: DadosExames
  onChange: (d: DadosExames) => void
}) {
  const pendentes = dados.itens.filter((i) => i.status !== 'DISPONIVEL')

  return (
    <CorpoWidget>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <EtiquetaSecao>{dados.itens.length} exames verificados</EtiquetaSecao>
        {pendentes.length > 0 && (
          <ChipStatus status="atencao">{pendentes.length} viram pendência do caso</ChipStatus>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        {dados.itens.map((item) => {
          const pendente = item.status !== 'DISPONIVEL'
          return (
            <div
              key={item.id}
              className={cn(
                // Colunas fixas: nome, data e controle batem entre todas as linhas,
                // inclusive nas que não têm data.
                'grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 border-t px-4 py-2.5 first:border-t-0',
                pendente && 'bg-muted/20',
              )}
            >
              <FileText className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate text-[13px]">{item.nome}</span>
              <span className="w-[5.5rem] text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {item.data ?? '—'}
              </span>
              <SeletorExame
                nome={item.nome}
                valor={item.status}
                onChange={(s) =>
                  onChange({
                    ...dados,
                    itens: dados.itens.map((i) => (i.id === item.id ? { ...i, status: s } : i)),
                  })
                }
              />
            </div>
          )
        })}
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Exame ausente vira pendência operacional do caso — nunca soma minuto à consulta,
        porque a falta do papel não torna a entrevista mais longa.
      </p>
    </CorpoWidget>
  )
}

/* ══════════════ contexto do procedimento ══════════════ */

export function WidgetContexto({
  dados,
  onChange,
}: {
  dados: DadosContexto
  onChange: (d: DadosContexto) => void
}) {
  const campoObservacao = useId()

  return (
    <CorpoWidget>
      <div className="rounded-xl border bg-muted/30 px-5 py-4">
        <EtiquetaSecao>Veio no encaminhamento</EtiquetaSecao>
        <p className="mt-2 text-lg font-medium leading-snug">{dados.indicacao}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t pt-3 text-[13px] text-muted-foreground">
          {dados.dataPlanejada && (
            <span className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5" />
              Cirurgia prevista para {dados.dataPlanejada}
            </span>
          )}
          {dados.lateralidade && <span>Lateralidade: {dados.lateralidade}</span>}
        </div>
      </div>

      <div>
        <label htmlFor={campoObservacao} className="flex flex-wrap items-baseline gap-x-2">
          <EtiquetaSecao>Observação do encaminhamento</EtiquetaSecao>
          <span className="text-[11px] text-muted-foreground">transcrição, não avaliação</span>
        </label>
        <Textarea
          id={campoObservacao}
          rows={2}
          value={dados.observacaoEncaminhamento ?? ''}
          onChange={(e) => onChange({ ...dados, observacaoEncaminhamento: e.target.value })}
          className="mt-2 text-[13px]"
        />
      </div>
    </CorpoWidget>
  )
}

/* ══════════════ observações ══════════════ */

export function WidgetObservacoes({
  dados,
  onChange,
}: {
  dados: DadosObservacoes
  onChange: (d: DadosObservacoes) => void
}) {
  const campoNota = useId()

  return (
    <CorpoWidget>
      <div>
        <label htmlFor={campoNota}>
          <EtiquetaSecao>Nota da entrevista</EtiquetaSecao>
        </label>
        <Textarea
          id={campoNota}
          rows={4}
          value={dados.nota}
          placeholder="O que não coube em nenhum campo, com as palavras de quem entrevistou."
          onChange={(e) => onChange({ ...dados, nota: e.target.value })}
          className="mt-2 text-[13px] leading-relaxed"
        />
      </div>

      {dados.autor && (
        <p className="flex flex-wrap items-center justify-end gap-x-2 font-mono text-[11px] tabular-nums text-muted-foreground">
          <span>{dados.autor}</span>
          <span aria-hidden>·</span>
          <span>{dados.horario}</span>
        </p>
      )}
    </CorpoWidget>
  )
}
