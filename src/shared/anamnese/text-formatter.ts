/** Helpers estáveis para o texto usado em resumo, clipboard e PDF. */
export const TextFormatter = {
  sectionTitle(title: string): string {
    return title.toUpperCase()
  },

  field(label: string, value: string | number): string {
    return `• ${label}: ${value}`
  },

  listItem(text: string): string {
    return `• ${text}`
  },

  subItem(text: string): string {
    return `  - ${text}`
  },

  continuation(text: string): string {
    return `  ${text}`
  },

  textBlock(text: string): string {
    return stripHtmlToPlainText(text)
  },

  join(lines: Array<string | null | undefined>): string {
    const filtered = lines.filter(
      (line): line is string => typeof line === 'string' && line.length > 0,
    )

    if (filtered.length === 0) return ''
    if (filtered.length === 1) return filtered[0]

    const [title, ...rest] = filtered
    return [title, '', ...rest].join('\n')
  },
}

/** Mantém compatibilidade com observações rich text já produzidas no DietFlow. */
export function stripHtmlToPlainText(html: string): string {
  if (!html) return ''
  if (!/[<&]/.test(html)) return html.trim()

  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")

  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
