export interface RichTextJson {
  type?: string
  attrs?: Record<string, unknown>
  content?: RichTextJson[]
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
  text?: string
}

export const EMPTY_DOCUMENT: RichTextJson = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

export function normalizeRichTextJson(value: unknown): RichTextJson {
  const parsed = typeof value === 'string' ? JSON.parse(value) as unknown : value
  if (!parsed || typeof parsed !== 'object' || (parsed as RichTextJson).type !== 'doc') {
    throw new Error('Conteúdo estruturado inválido: nó raiz TipTap ausente.')
  }
  const document = parsed as RichTextJson
  return { ...document, content: Array.isArray(document.content) ? document.content : [] }
}

function inlineText(node: RichTextJson): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  return (node.content ?? []).map(inlineText).join('')
}

function markedText(node: RichTextJson): string {
  let text = node.text ?? ''
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') text = `**${text}**`
    else if (mark.type === 'italic') text = `*${text}*`
    else if (mark.type === 'strike') text = `~~${text}~~`
    else if (mark.type === 'highlight') text = `==${text}==`
    else if (mark.type === 'code') text = `\`${text}\``
    else if (mark.type === 'link' && typeof mark.attrs?.href === 'string') text = `[${text}](${mark.attrs.href})`
  }
  return text
}

function inlineMarkdown(node: RichTextJson): string {
  if (node.type === 'text') return markedText(node)
  if (node.type === 'hardBreak') return '  \n'
  return (node.content ?? []).map(inlineMarkdown).join('')
}

function blockMarkdown(node: RichTextJson, depth = 0): string {
  const content = node.content ?? []
  switch (node.type) {
    case 'doc': return content.map((child) => blockMarkdown(child, depth)).filter(Boolean).join('\n\n')
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)))
      return `${'#'.repeat(level)} ${inlineMarkdown(node)}`
    }
    case 'paragraph': return inlineMarkdown(node)
    case 'blockquote': return content.map((child) => blockMarkdown(child, depth)).join('\n').split('\n').map((line) => `> ${line}`).join('\n')
    case 'bulletList': return content.map((child) => blockMarkdown(child, depth)).join('\n')
    case 'orderedList': return content.map((child, index) => blockMarkdown({ ...child, attrs: { ...child.attrs, order: index + 1 } }, depth)).join('\n')
    case 'listItem': {
      const prefix = typeof node.attrs?.order === 'number' ? `${node.attrs.order}.` : '-'
      const rendered = content.map((child) => blockMarkdown(child, depth + 1)).join('\n')
      return rendered.split('\n').map((line, index) => `${index === 0 ? prefix : ' '.repeat(prefix.length)} ${line}`).join('\n')
    }
    case 'codeBlock': return `\`\`\`${String(node.attrs?.language ?? '')}\n${inlineText(node)}\n\`\`\``
    case 'horizontalRule': return '---'
    case 'table': return content.map((child) => blockMarkdown(child, depth)).join('\n')
    case 'tableRow': return `| ${content.map((child) => inlineText(child).replaceAll('|', '\\|')).join(' | ')} |`
    case 'tableHeader':
    case 'tableCell': return inlineMarkdown(node)
    default: return content.length ? content.map((child) => blockMarkdown(child, depth)).join('\n') : inlineMarkdown(node)
  }
}

export function richTextToMarkdown(value: unknown): string {
  return blockMarkdown(normalizeRichTextJson(value)).trim()
}

export function richTextToPlainText(value: unknown): string {
  const root = normalizeRichTextJson(value)
  const blocks: string[] = []
  const visit = (node: RichTextJson) => {
    if (node.type === 'text') return
    if (['heading', 'paragraph', 'blockquote', 'listItem', 'codeBlock', 'tableRow'].includes(node.type ?? '')) {
      const text = inlineText(node).trim()
      if (text) blocks.push(text)
      return
    }
    for (const child of node.content ?? []) visit(child)
  }
  visit(root)
  return blocks.join('\n\n').trim()
}

function parseInline(text: string): RichTextJson[] {
  return text ? [{ type: 'text', text }] : []
}

export function markdownToRichText(markdown: string): RichTextJson {
  const content: RichTextJson[] = []
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  let paragraph: string[] = []
  let list: RichTextJson[] = []
  let ordered = false
  const flushParagraph = () => {
    const text = paragraph.join(' ').trim()
    if (text) content.push({ type: 'paragraph', content: parseInline(text) })
    paragraph = []
  }
  const flushList = () => {
    if (list.length) content.push({ type: ordered ? 'orderedList' : 'bulletList', content: list })
    list = []
  }
  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    const listItem = /^\s*(?:(\d+)\.|[-*+])\s+(.+)$/.exec(line)
    if (heading) {
      flushParagraph(); flushList()
      content.push({ type: 'heading', attrs: { level: heading[1].length }, content: parseInline(heading[2]) })
    } else if (listItem) {
      flushParagraph()
      const nextOrdered = Boolean(listItem[1])
      if (list.length && nextOrdered !== ordered) flushList()
      ordered = nextOrdered
      list.push({ type: 'listItem', content: [{ type: 'paragraph', content: parseInline(listItem[2]) }] })
    } else if (!line.trim()) {
      flushParagraph(); flushList()
    } else {
      flushList()
      paragraph.push(line.trim())
    }
  }
  flushParagraph(); flushList()
  return { type: 'doc', content: content.length ? content : EMPTY_DOCUMENT.content }
}

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/u).length : 0
}
