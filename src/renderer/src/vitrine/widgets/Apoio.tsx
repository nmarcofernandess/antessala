/**
 * Apoio e contexto: `accommodations@1`, `habits_substances@1`,
 * `special_conditions@1`, `exams_pending@1`, `procedure_context@1` e
 * `clinical_notes@1`.
 *
 * A acomodação é o widget que mais muda a agenda: ela não descreve o paciente,
 * descreve o que a vaga precisa ter. Intérprete de Libras, sala acessível e
 * acompanhante legal viram requisito da sala, e por isso somam dez minutos
 * fora do teto que limita os demais domínios.
 */

import { Accessibility, CalendarClock, Cigarette, FileText, Languages, Wine } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  ChipStatus,
  CorpoWidget,
  Escolha,
  EtiquetaSecao,
  GradeDados,
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

      <div className="space-y-3">
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

        <div className="rounded-lg border bg-card px-4 py-3">
          <PerguntaChave
            compacta
            pergunta="Precisa de representante legal para decidir?"
            resposta={dados.representanteLegal}
            onChange={(r) => onChange({ ...dados, representanteLegal: r })}
          />
        </div>
      </div>

      {necessidades > 0 && (
        <p className="rounded-lg border border-dashed px-4 py-3 text-[13px] text-muted-foreground">
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
    <div className={cn('rounded-lg border bg-card px-4 py-3', sim && 'border-primary/25 bg-primary/5')}>
      <div className="flex items-start gap-3">
        <Icone className={cn('mt-0.5 size-4 shrink-0', sim ? 'text-primary' : 'text-muted-foreground')} />
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
              className="mt-3 h-9 text-[13px]"
            />
          )}
        </div>
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
      <p className="text-xs text-muted-foreground">
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

      <div className="rounded-lg border bg-card px-4 py-3">
        <PerguntaChave
          compacta
          pergunta="Usa outras substâncias?"
          resposta={dados.outrasSubstancias}
          onChange={(r) => onChange({ ...dados, outrasSubstancias: r })}
        />
      </div>
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
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center gap-2">
        <Icone className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">{titulo}</span>
      </div>
      <div className="mt-2.5">
        <Escolha
          opcoes={USO.map((u) => ({ valor: u.valor, rotulo: u.rotulo, status: u.status }))}
          valor={valor}
          onChange={(v) => onChange({ estado: 'RESPONDIDO', valor: v })}
        />
      </div>
      {valor && valor !== 'NUNCA' && (
        <Input
          value={detalhe ?? ''}
          placeholder={placeholder}
          onChange={(e) => onDetalhe(e.target.value)}
          className="mt-2.5 h-8 text-[13px]"
        />
      )}
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
  const gestante = positiva(dados.gestante)
  return (
    <CorpoWidget>
      <div className="rounded-lg border bg-card px-4 py-3">
        <PerguntaChave
          compacta
          pergunta="Está gestante?"
          resposta={dados.gestante}
          onChange={(r) => onChange({ ...dados, gestante: r })}
        />
        <PerguntaChave
          compacta
          pergunta="Está amamentando?"
          resposta={dados.lactante}
          onChange={(r) => onChange({ ...dados, lactante: r })}
        />
      </div>

      {gestante && (
        <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
          <span className="text-[13px]">Semanas de gestação</span>
          <Input
            type="number"
            value={dados.semanasGestacao ?? ''}
            onChange={(e) => onChange({ ...dados, semanasGestacao: Number(e.target.value) })}
            className="h-8 w-20 font-mono tabular-nums"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[11px] text-muted-foreground">
          Outra condição declarada pelo paciente
        </label>
        <Input
          value={dados.outraCondicao ?? ''}
          placeholder="Só o que ele declarou — o app não deduz condição."
          onChange={(e) => onChange({ ...dados, outraCondicao: e.target.value })}
          className="h-9 text-[13px]"
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
          <ChipStatus status="atencao">
            {pendentes.length} viram pendência do caso
          </ChipStatus>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border bg-card divide-y">
        {dados.itens.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 text-[13px]">{item.nome}</span>
            {item.data && (
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {item.data}
              </span>
            )}
            <div className="flex gap-1">
              {(Object.keys(STATUS_EXAME) as StatusExame[]).map((s) => {
                const ativo = item.status === s
                const def = STATUS_EXAME[s]
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...dados,
                        itens: dados.itens.map((i) =>
                          i.id === item.id ? { ...i, status: s } : i,
                        ),
                      })
                    }
                    className="rounded-md"
                  >
                    <ChipStatus
                      status={ativo ? def.status : 'neutro'}
                      className={cn('transition-opacity', !ativo && 'opacity-40')}
                    >
                      {def.rotulo}
                    </ChipStatus>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
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
  return (
    <CorpoWidget>
      <div className="rounded-lg border bg-muted/30 px-5 py-4">
        <EtiquetaSecao>Veio no encaminhamento</EtiquetaSecao>
        <p className="mt-2 text-lg font-medium leading-snug">{dados.indicacao}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-muted-foreground">
          {dados.dataPlanejada && (
            <span className="flex items-center gap-1.5">
              <CalendarClock className="size-3.5" />
              Cirurgia prevista para {dados.dataPlanejada}
            </span>
          )}
          {dados.lateralidade && <span>Lateralidade: {dados.lateralidade}</span>}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] text-muted-foreground">
          Observação do encaminhamento — transcrição, não avaliação
        </label>
        <Textarea
          rows={2}
          value={dados.observacaoEncaminhamento ?? ''}
          onChange={(e) => onChange({ ...dados, observacaoEncaminhamento: e.target.value })}
          className="text-[13px]"
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
  return (
    <CorpoWidget>
      <Textarea
        rows={4}
        value={dados.nota}
        placeholder="O que não coube em nenhum campo, com as palavras de quem entrevistou."
        onChange={(e) => onChange({ ...dados, nota: e.target.value })}
        className="text-[13px] leading-relaxed"
      />
      {dados.autor && (
        <p className="font-mono text-[11px] text-muted-foreground">
          {dados.autor} · {dados.horario}
        </p>
      )}
    </CorpoWidget>
  )
}
