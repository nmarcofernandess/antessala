import type { IaMensagem } from '@shared/index'

export function formatChatAsMarkdown(mensagens: IaMensagem[], titulo: string): string {
  const lines: string[] = []
  lines.push(`# ${titulo}`)
  lines.push(`*Exportado em ${new Date().toLocaleString('pt-BR')}*`)
  lines.push('')

  for (const m of mensagens) {
    if (m.papel === 'tool_result') continue

    const role = m.papel === 'usuario' ? '**Voce**' : '**IA**'
    lines.push(`### ${role}`)
    lines.push(m.conteudo)

    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}
