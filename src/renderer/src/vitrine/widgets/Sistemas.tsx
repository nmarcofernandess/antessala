/**
 * Revisão por sistemas: `anesthesia_history@1`, `cardiovascular@1`,
 * `respiratory@1` e `bleeding_thrombosis@1`.
 *
 * O padrão é o mesmo em todos: uma pergunta de entrada e, quando ela é
 * positiva, os fatos que só existem por causa dela. O contrato é explícito
 * neste ponto — sem anestesia prévia, as perguntas sobre a anestesia prévia
 * não ficam “em branco”, elas deixam de se aplicar.
 */

import { Activity, HeartPulse, Droplets, Wind } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
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

/* ══════════════ história anestésica ══════════════ */

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
        <div className="rounded-lg border bg-card px-4 py-3">
          <EtiquetaSecao>O que aconteceu nas vezes anteriores</EtiquetaSecao>
          <div className="mt-2">
            <PerguntaChave
              compacta
              pergunta="Teve alguma complicação com a anestesia?"
              resposta={dados.complicacaoPessoal}
              onChange={(r) => onChange({ ...dados, complicacaoPessoal: r })}
            />
            <PerguntaChave
              compacta
              pergunta="Alguém já disse que foi difícil colocar o tubo de respiração?"
              resposta={dados.viaAereaDificil}
              onChange={(r) => onChange({ ...dados, viaAereaDificil: r })}
            />
            <PerguntaChave
              compacta
              pergunta="Passou mal com náusea ou vômito depois?"
              resposta={dados.nauseaVomitoPos}
              onChange={(r) => onChange({ ...dados, nauseaVomitoPos: r })}
            />
          </div>

          {positiva(dados.complicacaoPessoal) && (
            <div className="mt-3 space-y-1.5">
              <label className="text-[11px] text-muted-foreground">
                O que exatamente aconteceu?
              </label>
              <Textarea
                rows={2}
                value={dados.descricaoComplicacao ?? ''}
                placeholder="Registre o relato como ele foi dito, sem interpretar."
                onChange={(e) => onChange({ ...dados, descricaoComplicacao: e.target.value })}
                className="text-[13px]"
              />
            </div>
          )}
        </div>
      )}

      {respondeuNao && (
        <p className="rounded-lg border border-dashed px-4 py-3 text-[13px] text-muted-foreground">
          Primeira anestesia. As perguntas sobre episódios anteriores não se aplicam a este
          caso — e ficam registradas assim, não em branco.
        </p>
      )}

      <div className="border-t pt-3">
        <PerguntaChave
          compacta
          pergunta="Alguém da família já teve problema grave com anestesia?"
          resposta={dados.complicacaoFamiliar}
          onChange={(r) => onChange({ ...dados, complicacaoFamiliar: r })}
        />
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

      <div className="rounded-lg border bg-card px-4 py-2">
        {sintomas.map((s) => (
          <PerguntaChave
            key={String(s.chave)}
            compacta
            pergunta={s.pergunta}
            resposta={dados[s.chave] as Resposta<boolean>}
            onChange={(r) => onChange({ ...dados, [s.chave]: r })}
          />
        ))}
      </div>

      {positivos.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-[11px] text-muted-foreground">{rotuloDetalhe}</label>
          <Textarea
            rows={2}
            value={(dados[campoDetalhe] as string) ?? ''}
            placeholder={placeholderDetalhe}
            onChange={(e) => onChange({ ...dados, [campoDetalhe]: e.target.value })}
            className="text-[13px]"
          />
        </div>
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
    <CorpoWidget>
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
    </CorpoWidget>
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

export { Activity }
