/**
 * Widgets operacionais: `fasting_guidance@1` e `escort_and_transport@1`.
 *
 * São os dois blocos que mais separam um procedimento ambulatorial de um com
 * internação, e ambos registram **processo e requisito de vaga** — nunca achado
 * clínico. É a mesma natureza de `accommodations@1`: o que sai deles vira o que
 * a sala precisa ter, e a recepção lê isso sem ver motivo clínico nenhum.
 *
 * O que estes widgets deliberadamente não fazem: declarar quantas horas de
 * jejum são necessárias. Duração de jejum é regra clínica e institucional, o
 * produto não a possui, e inventá-la seria exatamente o que o contrato proíbe.
 * O widget pergunta se a orientação aconteceu e quem a deu.
 */

import { useId } from 'react'
import { CarFront, Clock, UserRoundCheck, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { ChipStatus, CorpoWidget, Escolha, EtiquetaSecao, type Status } from '../primitivos'
import { ListaPerguntas, LinhaPergunta } from './Apoio'
import { PerguntaChave } from './PerguntaChave'
import { positiva } from './tipos'
import type { DadosAcompanhante, DadosJejum, FormaRetorno } from './tipos'

/* ══════════════ orientação de jejum ══════════════ */

export function WidgetJejum({
  dados,
  onChange,
}: {
  dados: DadosJejum
  onChange: (d: DadosJejum) => void
}) {
  const campoQuem = useId()
  const campoDuvida = useId()
  const orientado = positiva(dados.orientado)

  return (
    <CorpoWidget>
      <PerguntaChave
        pergunta="O paciente já foi orientado sobre o jejum?"
        apoio="O registro é de que a conversa aconteceu — o tempo de jejum é definido pelo serviço, não por este app."
        resposta={dados.orientado}
        onChange={(r) => onChange({ ...dados, orientado: r })}
        statusQuandoSim="ideal"
      />

      {orientado ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor={campoQuem}>
              <EtiquetaSecao>Quem orientou</EtiquetaSecao>
            </label>
            <Input
              id={campoQuem}
              value={dados.orientadoPor ?? ''}
              placeholder="Nome e função de quem orientou"
              onChange={(e) => onChange({ ...dados, orientadoPor: e.target.value })}
              className="h-9 text-[13px]"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={campoDuvida}>
              <EtiquetaSecao>Dúvida que ficou</EtiquetaSecao>
            </label>
            <Input
              id={campoDuvida}
              value={dados.duvidaRegistrada ?? ''}
              placeholder="“Pode tomar o remédio da pressão?”"
              onChange={(e) => onChange({ ...dados, duvidaRegistrada: e.target.value })}
              className="h-9 text-[13px]"
            />
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
          Enquanto a orientação não acontece, o bloco fica aberto. Quem define o tempo de jejum
          é o serviço que vai operar — o app apenas registra que a pessoa foi orientada.
        </p>
      )}
    </CorpoWidget>
  )
}

/* ══════════════ acompanhante e retorno ══════════════ */

const RETORNO: { valor: FormaRetorno; rotulo: string; detalhe: string; status: Status }[] = [
  {
    valor: 'ACOMPANHADO',
    rotulo: 'Acompanhado',
    detalhe: 'alguém leva e traz',
    status: 'ideal',
  },
  {
    valor: 'SOZINHO',
    rotulo: 'Sozinho',
    detalhe: 'vai e volta por conta',
    status: 'atencao',
  },
  {
    valor: 'TRANSPORTE_SANITARIO',
    rotulo: 'Transporte sanitário',
    detalhe: 'veículo do serviço',
    status: 'adequado',
  },
]

export function WidgetAcompanhante({
  dados,
  onChange,
}: {
  dados: DadosAcompanhante
  onChange: (d: DadosAcompanhante) => void
}) {
  const campoNome = useId()
  const campoContato = useId()
  const tem = positiva(dados.temAcompanhante)
  const forma = dados.formaRetorno.estado === 'RESPONDIDO' ? dados.formaRetorno.valor : undefined

  return (
    <CorpoWidget>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <EtiquetaSecao>O que a vaga precisa prever</EtiquetaSecao>
        {tem && <ChipStatus status="adequado">Espaço para acompanhante</ChipStatus>}
      </div>

      <ListaPerguntas>
        <LinhaPergunta destaque={tem} tom="primary" icone={Users}>
          <PerguntaChave
            compacta
            pergunta="Vem acompanhado no dia da consulta?"
            resposta={dados.temAcompanhante}
            onChange={(r) => onChange({ ...dados, temAcompanhante: r })}
          />
        </LinhaPergunta>

        {tem && (
          <LinhaPergunta icone={UserRoundCheck}>
            <div className="grid w-full gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor={campoNome}>
                  <EtiquetaSecao>Quem acompanha</EtiquetaSecao>
                </label>
                <Input
                  id={campoNome}
                  value={dados.nomeAcompanhante ?? ''}
                  placeholder="Nome e vínculo"
                  onChange={(e) => onChange({ ...dados, nomeAcompanhante: e.target.value })}
                  className="h-9 bg-card text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={campoContato}>
                  <EtiquetaSecao>Contato</EtiquetaSecao>
                </label>
                <Input
                  id={campoContato}
                  value={dados.contato ?? ''}
                  placeholder="Telefone de quem acompanha"
                  onChange={(e) => onChange({ ...dados, contato: e.target.value })}
                  className="h-9 bg-card text-[13px]"
                />
              </div>
            </div>
          </LinhaPergunta>
        )}
      </ListaPerguntas>

      <div>
        <div className="flex items-center gap-2">
          <CarFront className="size-3.5 text-muted-foreground" />
          <EtiquetaSecao>Como retorna para casa</EtiquetaSecao>
        </div>
        <div className="mt-2.5">
          <Escolha
            opcoes={RETORNO.map((r) => ({
              valor: r.valor,
              rotulo: r.rotulo,
              detalhe: r.detalhe,
              status: r.status,
            }))}
            valor={forma}
            onChange={(v) => onChange({ ...dados, formaRetorno: { estado: 'RESPONDIDO', valor: v } })}
            colunas={3}
          />
        </div>
      </div>

      {forma === 'SOZINHO' && (
        <p
          className={cn(
            'rounded-lg border px-4 py-3 text-[13px] leading-relaxed',
            'border-warning/30 bg-warning/[0.07]',
          )}
        >
          <Clock className="mr-1.5 inline size-3.5 align-[-2px]" />
          Registrado que retorna sozinho. O que a recepção vê é a necessidade da vaga, não a
          razão — a conversa sobre o retorno pertence à consulta.
        </p>
      )}
    </CorpoWidget>
  )
}
