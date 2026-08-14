/**
 * Registro dos widgets do DietFlow, com um caso real preenchido.
 *
 * Este é o repertório que o Antessala herda. As respostas são de uma paciente
 * de consultório nutricional — dorme mal, bebe pouca água, seguiu o plano pela
 * metade — porque widget vazio não ensina nada sobre o que ele sabe fazer.
 */

import {
  Apple,
  Bed,
  ClipboardList,
  CupSoda,
  Pill,
  Target,
  Toilet,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import type { ComponentType } from 'react'

import {
  WidgetAdesao,
  WidgetBristol,
  WidgetHidratacao,
  WidgetMedicacoesDietFlow,
  WidgetObservacoesGerais,
  WidgetProblemas,
  WidgetRotina,
  WidgetSono,
  calcularGi,
  calcularIsi,
  type DadosAdesao,
  type DadosBristol,
  type DadosHidratacao,
  type DadosMedicacoesDietFlow,
  type DadosObservacoesGerais,
  type DadosProblemas,
  type DadosRotina,
  type DadosSono,
} from './DietFlow'

export type DefWidgetDietFlow = {
  tipo: string
  nome: string
  descricao: string
  icone: LucideIcon
  Componente: ComponentType<{ dados: never; onChange: (d: never) => void }>
  dadosIniciais: () => unknown
  resumo: (d: never) => string
}

const def = <D,>(w: {
  tipo: string
  nome: string
  descricao: string
  icone: LucideIcon
  Componente: ComponentType<{ dados: D; onChange: (d: D) => void }>
  dadosIniciais: () => D
  resumo: (d: D) => string
}): DefWidgetDietFlow => w as unknown as DefWidgetDietFlow

export const WIDGETS_DIETFLOW: DefWidgetDietFlow[] = [
  def<DadosSono>({
    tipo: 'sono',
    nome: 'Sono',
    descricao: 'Horas dormidas e três perguntas que viram um índice de insônia.',
    icone: Bed,
    Componente: WidgetSono,
    dadosIniciais: () => ({
      horasDormidas: 5.5,
      satisfacao: 3,
      interferenciaDiurna: 3,
      preocupacao: 2,
      acordouNoite: 'varias',
    }),
    resumo: (d) => `${d.horasDormidas} h por noite · ISI-3 ${calcularIsi(d)} de 12`,
  }),

  def<DadosBristol>({
    tipo: 'bristol',
    nome: 'Hábito intestinal',
    descricao: 'Escala de Bristol e sintomas associados, somados num GI Score.',
    icone: Toilet,
    Componente: WidgetBristol,
    dadosIniciais: () => ({
      tipo: 2,
      frequencia: 'dias_alternados',
      sintomas: { inchaco: 2, gases: 2, dorAbdominal: 1 },
      observacao: 'Piora nos dias em que come pão e massa; melhora quando bebe mais água.',
    }),
    resumo: (d) => `Tipo ${d.tipo} · GI Score ${calcularGi(d)} de 12`,
  }),

  def<DadosHidratacao>({
    tipo: 'hidratacao',
    nome: 'Hidratação',
    descricao: 'Litros por dia contra a meta em mililitros por quilo.',
    icone: CupSoda,
    Componente: WidgetHidratacao,
    dadosIniciais: () => ({
      litrosDia: 1.25,
      perfil: 'sedentario',
      peso: 68,
      maxSlider: 5,
    }),
    resumo: (d) => `${d.litrosDia} L por dia · ${Math.round((d.litrosDia * 1000) / d.peso)} ml/kg`,
  }),

  def<DadosAdesao>({
    tipo: 'adesao',
    nome: 'Adesão ao plano',
    descricao: 'O desvio calórico do período traduzido em impacto no peso.',
    icone: Target,
    Componente: WidgetAdesao,
    dadosIniciais: () => ({
      seguiu: 'parcial',
      diferencaCalorica: 350,
      diasPeriodo: 14,
      observacao: 'Segue durante a semana e escapa nos fins de semana, em almoço de família.',
    }),
    resumo: (d) =>
      `${d.seguiu === 'sim' ? 'Seguiu' : d.seguiu === 'parcial' ? 'Parcial' : 'Não seguiu'} · ${d.diferencaCalorica > 0 ? '+' : ''}${d.diferencaCalorica} kcal por dia`,
  }),

  def<DadosRotina>({
    tipo: 'rotina_alimentar',
    nome: 'Rotina alimentar',
    descricao: 'O dia como ele acontece de verdade, momento a momento.',
    icone: UtensilsCrossed,
    Componente: WidgetRotina,
    dadosIniciais: () => ({
      registros: [
        { id: 'r1', titulo: 'Café da manhã', horario: '07:00', descricao: 'Café com leite e dois pães na chapa' },
        { id: 'r2', titulo: 'Lanche da manhã', horario: '10:30', descricao: 'Costuma pular' },
        { id: 'r3', titulo: 'Almoço', horario: '12:30', descricao: 'Arroz, feijão, carne e salada de alface e tomate' },
        { id: 'r4', titulo: 'Lanche da tarde', horario: '16:00', descricao: 'Café e biscoito recheado' },
        { id: 'r5', titulo: 'Jantar', horario: '20:00', descricao: 'Repete o almoço ou come pão com queijo' },
        { id: 'r6', titulo: 'Ceia', horario: '22:30', descricao: 'Leite quente antes de deitar' },
      ],
    }),
    resumo: (d) => `${d.registros.length} momentos mapeados`,
  }),

  def<DadosProblemas>({
    tipo: 'problemas_saude',
    nome: 'Problemas de saúde',
    descricao: 'Condições relatadas e se estão controladas.',
    icone: Apple,
    Componente: WidgetProblemas,
    dadosIniciais: () => ({
      problemas: [
        { id: 'p1', nome: 'Hipertensão arterial', codigo: 'I10', desde: '2018', controlado: true },
        { id: 'p2', nome: 'Refluxo gastroesofágico', codigo: 'K21', desde: '2021', controlado: false },
        { id: 'p3', nome: 'Enxaqueca', codigo: 'G43', desde: '2009', controlado: true },
      ],
      observacao: 'O refluxo piora quando janta tarde.',
    }),
    resumo: (d) => `${d.problemas.length} condições · ${d.problemas.filter((p) => p.controlado).length} controladas`,
  }),

  def<DadosMedicacoesDietFlow>({
    tipo: 'medicacoes_dietflow',
    nome: 'Medicações',
    descricao: 'O que ela toma, com dose, frequência e motivo.',
    icone: Pill,
    Componente: WidgetMedicacoesDietFlow,
    dadosIniciais: () => ({
      medicacoes: [
        { id: 'md1', nome: 'Losartana', dose: '50 mg', frequencia: '1x ao dia', motivo: 'pressão' },
        { id: 'md2', nome: 'Omeprazol', dose: '20 mg', frequencia: 'em jejum', motivo: 'refluxo' },
        { id: 'md3', nome: 'Vitamina D', dose: '2000 UI', frequencia: '1x ao dia' },
      ],
    }),
    resumo: (d) => `${d.medicacoes.length} medicações`,
  }),

  def<DadosObservacoesGerais>({
    tipo: 'observacoes_gerais',
    nome: 'Observações gerais',
    descricao: 'Texto livre para o que não coube em campo.',
    icone: ClipboardList,
    Componente: WidgetObservacoesGerais,
    dadosIniciais: () => ({
      texto:
        'Mora sozinha e cozinha para a semana no domingo. Diz que come melhor quando tem comida pronta na geladeira. Tem receio de dieta restritiva porque já fez várias e recuperou o peso.',
    }),
    resumo: (d) => (d.texto ? 'Observação registrada' : 'Sem observação'),
  }),
]
