/**
 * Revisão por sistemas: `anesthesia_history@1`, `cardiovascular@1`,
 * `respiratory@1` e `bleeding_thrombosis@1`.
 *
 * O padrão é o mesmo em todos: uma pergunta de entrada e, quando ela é
 * positiva, os fatos que só existem por causa dela. O contrato é explícito
 * neste ponto — sem anestesia prévia, as perguntas sobre a anestesia prévia
 * não ficam “em branco”, elas deixam de se aplicar.
 *
 * A composição segue essa mesma ordem: pergunta, resposta, e o que a resposta
 * revelou. As perguntas satélite moram numa lista de trilho único, e só o
 * achado positivo ganha cor — cinco linhas cinzas não dizem nada de relance.
 */

import type { ReactNode } from 'react'
import { HeartPulse, Droplets, Wind } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { ChipStatus, CorpoWidget, EtiquetaSecao } from '../primitivos'
import { PerguntaChave } from './PerguntaChave'
import { positiva, tratada } from './tipos'
import type {
  DadosCardiovascular,
  DadosHistoriaAnestesica,
  DadosRespiratorio,
  DadosSangramento,
  Resposta,
} from './tipos'

/* ══════════════ lista de perguntas satélite ══════════════ */

/** Moldura única para uma sequência de perguntas — uma borda, não cinco. */
function ListaPerguntas({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-lg border bg-card', className)}>{children}</div>
  )
}

/**
 * Uma linha da lista.
 *
 * `PerguntaChave compacta` já entrega a pergunta à esquerda e o trio de
 * respostas à direita, sempre com a mesma largura — as colunas batem sozinhas.
 * O que faltava era ritmo: envolver cada pergunta neutraliza o `first:` do
 * primitivo (todo filho passa a ser o primeiro), então é o trilho que manda no
 * respiro, na divisória e na cor. Daí o `[&>div]:py-0`.
 */
function LinhaPergunta({
  destaque,
  children,
}: {
  destaque?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'relative border-t py-3 pl-4 pr-3.5 transition-colors first:border-t-0',
        '[&>div]:py-0',
        destaque && 'bg-warning/[0.07]',
      )}
    >
      {destaque && <span className="absolute inset-y-0 left-0 w-[3px] bg-warning" aria-hidden />}
      {children}
    </div>
  )
}

/** O campo que só existe porque alguma resposta foi positiva. */
function DetalheDoAchado({
  rotulo,
  placeholder,
  valor,
  onChange,
}: {
  rotulo: string
  placeholder: string
  valor: string
  onChange: (v: string) => void
}) {
  return (
    <div className="rounded-lg border border-warning/30 bg-warning/[0.06] px-4 py-3">
      <EtiquetaSecao>{rotulo}</EtiquetaSecao>
      <Textarea
        rows={2}
        value={valor}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 bg-card text-[13px]"
      />
    </div>
  )
}

/* ══════════════ história anestésica ══════════════ */

const ANTERIORES: { chave: keyof DadosHistoriaAnestesica; pergunta: string }[] = [
  { chave: 'complicacaoPessoal', pergunta: 'Teve alguma complicação com a anestesia?' },
  { chave: 'viaAereaDificil', pergunta: 'Alguém já disse que foi difícil colocar o tubo de respiração?' },
  { chave: 'nauseaVomitoPos', pergunta: 'Passou mal com náusea ou vômito depois?' },
]

export function WidgetHistoriaAnestesica({
  dados,
  onChange,
}: {
  dados: DadosHistoriaAnestesica
  onChange: (d: DadosHistoriaAnestesica) => void
}) {
  const jaOperou = positiva(dados.anestesiaPrevia)
  const respondeuNao =
    dados.anestesiaPrevia.estado === 'RESPONDIDO' && dados.anestesiaPrevia.valor === false

  return (
    <CorpoWidget>
      <PerguntaChave
        pergunta="O paciente já foi anestesiado alguma vez?"
        apoio="Cirurgia, endoscopia, parto com raquianestesia — qualquer procedimento com anestesia."
        resposta={dados.anestesiaPrevia}
        onChange={(r) => onChange({ ...dados, anestesiaPrevia: r })}
        statusQuandoSim="adequado"
      />

      {jaOperou && (
        <div className="space-y-2.5">
          <EtiquetaSecao>O que aconteceu nas vezes anteriores</EtiquetaSecao>

          <ListaPerguntas>
            {ANTERIORES.map((s) => (
              <LinhaPergunta
                key={String(s.chave)}
                destaque={positiva(dados[s.chave] as Resposta<boolean>)}
              >
                <PerguntaChave
                  compacta
                  pergunta={s.pergunta}
                  resposta={dados[s.chave] as Resposta<boolean>}
                  onChange={(r) => onChange({ ...dados, [s.chave]: r })}
                />
              </LinhaPergunta>
            ))}
          </ListaPerguntas>

          {positiva(dados.complicacaoPessoal) && (
            <DetalheDoAchado
              rotulo="O que exatamente aconteceu?"
              placeholder="Registre o relato como ele foi dito, sem interpretar."
              valor={dados.descricaoComplicacao ?? ''}
              onChange={(v) => onChange({ ...dados, descricaoComplicacao: v })}
            />
          )}
        </div>
      )}

      {respondeuNao && (
        <p className="rounded-lg border border-dashed px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
          Primeira anestesia. As perguntas sobre episódios anteriores não se aplicam a este
          caso — e ficam registradas assim, não em branco.
        </p>
      )}

      <div className="space-y-2.5">
        <EtiquetaSecao>Na família</EtiquetaSecao>
        <ListaPerguntas>
          <LinhaPergunta destaque={positiva(dados.complicacaoFamiliar)}>
            <PerguntaChave
              compacta
              pergunta="Alguém da família já teve problema grave com anestesia?"
              resposta={dados.complicacaoFamiliar}
              onChange={(r) => onChange({ ...dados, complicacaoFamiliar: r })}
            />
          </LinhaPergunta>
        </ListaPerguntas>
      </div>
    </CorpoWidget>
  )
}

/* ══════════════ revisão de sintomas ══════════════ */

type Sintoma<D> = { chave: keyof D; pergunta: string }

function RevisaoSintomas<D extends Record<string, unknown>>({
  dados,
  onChange,
  sintomas,
  icone: Icone,
  campoDetalhe,
  rotuloDetalhe,
  placeholderDetalhe,
}: {
  dados: D
  onChange: (d: D) => void
  sintomas: Sintoma<D>[]
  icone: typeof HeartPulse
  campoDetalhe: keyof D
  rotuloDetalhe: string
  placeholderDetalhe: string
}) {
  const positivos = sintomas.filter((s) => positiva(dados[s.chave] as Resposta<boolean>))
  const tratados = sintomas.filter((s) => tratada(dados[s.chave] as Resposta<boolean>))

  return (
    <CorpoWidget>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Icone className="size-4 text-muted-foreground" />
          <EtiquetaSecao>
            {tratados.length} de {sintomas.length} perguntas tratadas
          </EtiquetaSecao>
        </span>
        {positivos.length > 0 && (
          <ChipStatus status="atencao">
            {positivos.length === 1
              ? '1 achado positivo'
              : `${positivos.length} achados positivos`}
          </ChipStatus>
        )}
      </div>

      <ListaPerguntas>
        {sintomas.map((s) => (
          <LinhaPergunta
            key={String(s.chave)}
            destaque={positiva(dados[s.chave] as Resposta<boolean>)}
          >
            <PerguntaChave
              compacta
              pergunta={s.pergunta}
              resposta={dados[s.chave] as Resposta<boolean>}
              onChange={(r) => onChange({ ...dados, [s.chave]: r })}
            />
          </LinhaPergunta>
        ))}
      </ListaPerguntas>

      {positivos.length > 0 && (
        <DetalheDoAchado
          rotulo={rotuloDetalhe}
          placeholder={placeholderDetalhe}
          valor={(dados[campoDetalhe] as string) ?? ''}
          onChange={(v) => onChange({ ...dados, [campoDetalhe]: v })}
        />
      )}
    </CorpoWidget>
  )
}

export function WidgetCardiovascular({
  dados,
  onChange,
}: {
  dados: DadosCardiovascular
  onChange: (d: DadosCardiovascular) => void
}) {
  return (
    <RevisaoSintomas
      dados={dados}
      onChange={onChange}
      icone={HeartPulse}
      campoDetalhe="detalhe"
      rotuloDetalhe="Detalhe do que foi relatado"
      placeholderDetalhe="Quando começou, com que esforço aparece, o que melhora."
      sintomas={[
        { chave: 'dorToracica', pergunta: 'Sente dor ou aperto no peito?' },
        { chave: 'dispneiaRepouso', pergunta: 'Falta o ar mesmo parado?' },
        { chave: 'sincope', pergunta: 'Já desmaiou ou quase desmaiou?' },
        { chave: 'palpitacao', pergunta: 'Sente o coração disparar ou falhar?' },
        { chave: 'edema', pergunta: 'As pernas ou os pés incham?' },
      ]}
    />
  )
}

export function WidgetRespiratorio({
  dados,
  onChange,
}: {
  dados: DadosRespiratorio
  onChange: (d: DadosRespiratorio) => void
}) {
  return (
    <RevisaoSintomas
      dados={dados}
      onChange={onChange}
      icone={Wind}
      campoDetalhe="descricaoSuporte"
      rotuloDetalhe="Detalhe do suporte ou do sintoma"
      placeholderDetalhe="CPAP à noite, oxigênio domiciliar, bombinha de resgate…"
      sintomas={[
        { chave: 'dispneia', pergunta: 'Falta o ar ao subir escada ou caminhar?' },
        { chave: 'sibilo', pergunta: 'O peito chia?' },
        { chave: 'infeccaoRecente', pergunta: 'Teve gripe forte ou pneumonia nas últimas semanas?' },
        { chave: 'apneiaSono', pergunta: 'Já disseram que ele para de respirar dormindo?' },
        { chave: 'suporteRespiratorio', pergunta: 'Usa aparelho para respirar ou oxigênio?' },
      ]}
    />
  )
}

export function WidgetSangramento({
  dados,
  onChange,
}: {
  dados: DadosSangramento
  onChange: (d: DadosSangramento) => void
}) {
  return (
    <RevisaoSintomas
      dados={dados}
      onChange={onChange}
      icone={Droplets}
      campoDetalhe="detalhe"
      rotuloDetalhe="Detalhe obrigatório para qualquer resposta positiva"
      placeholderDetalhe="Qual medicamento, desde quando, se houve orientação de suspender."
      sintomas={[
        { chave: 'sangramentoAnormal', pergunta: 'Sangra fácil, faz mancha roxa sem bater?' },
        { chave: 'trombosePrevia', pergunta: 'Já teve trombose ou coágulo?' },
        { chave: 'anticoagulante', pergunta: 'Toma remédio para afinar o sangue?' },
      ]}
    />
  )
}
