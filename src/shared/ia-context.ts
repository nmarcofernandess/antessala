export const IA_CONTEXT_VERSION = 1 as const

/** Limites herdados do Studio; todos são medidos em caracteres, não tokens. */
export const IA_CONTEXT_LIMITS = {
  routeChars: 256,
  idChars: 128,
  selectionChars: 6_000,
  catalogItems: 100,
  catalogChars: 4_000,
  sources: 8,
  sourceSnippetChars: 1_200,
  sourceChars: 8_000,
  bundleChars: 16_000,
} as const

export type IaContextMode = 'global' | 'adaptive' | 'pinned'
export type IaScopeKind = 'global' | 'registro' | 'memoria'

export interface IaContextSelection {
  text: string
  from: number
  to: number
  sourceRevision: number
  hash: string
}

export interface RequestedIaContext {
  version: typeof IA_CONTEXT_VERSION
  route: string
  mode: IaContextMode
  registroId?: string
  memoriaId?: string
  selection?: IaContextSelection
  attachedRegistroIds: string[]
  attachedMemoriaIds: string[]
  capturedAt: string
}

export type IaRetrievalScope =
  | { kind: 'registro'; registroIds: string[] }
  | { kind: 'memoria'; memoriaIds: string[] }
  | { kind: 'global'; reason: 'explicit_user_intent' | 'confirmed_expansion' }

export interface ResolvedIaContextSnapshot {
  version: typeof IA_CONTEXT_VERSION
  contextId: string
  requested: RequestedIaContext
  resolvedScope: IaRetrievalScope
  resolvedAt: string
}

export interface IaContextCatalogItem {
  id: string
  kind: Exclude<IaScopeKind, 'global'>
  title: string
  updatedAt: string
}

export interface IaContextSource {
  sourceId: string
  title: string
  snippet: string
  citation: string
}

export interface IaContextBudget {
  selectionChars: number
  catalogChars: number
  sourceChars: number
  totalChars: number
}

export interface IaContextBundle {
  snapshot: ResolvedIaContextSnapshot
  catalog: IaContextCatalogItem[]
  sources: IaContextSource[]
  rendered: string
  budget: IaContextBudget
}

export function isIaContextMode(value: unknown): value is IaContextMode {
  return value === 'global' || value === 'adaptive' || value === 'pinned'
}

export async function hashIaContextSelection(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

function clamp(value: string, maxChars: number): string {
  return value.length <= maxChars ? value : value.slice(0, maxChars)
}

/**
 * Monta o envelope textual sem consultar banco, rede ou histórico. O adapter
 * futuro decide quais fontes fornecer; esta função apenas aplica o contrato e
 * o orçamento do Studio de forma determinística.
 */
export function buildIaContextBundle(
  snapshot: ResolvedIaContextSnapshot,
  rawCatalog: readonly IaContextCatalogItem[],
  rawSources: readonly IaContextSource[],
): IaContextBundle {
  const selection = clamp(
    snapshot.requested.selection?.text ?? '',
    IA_CONTEXT_LIMITS.selectionChars,
  )

  const catalog: IaContextCatalogItem[] = []
  let catalogChars = 0
  for (const item of rawCatalog.slice(0, IA_CONTEXT_LIMITS.catalogItems)) {
    const normalized = {
      ...item,
      id: clamp(item.id, IA_CONTEXT_LIMITS.idChars),
      title: clamp(item.title, IA_CONTEXT_LIMITS.idChars),
    }
    const lineLength = `${normalized.kind}:${normalized.id}:${normalized.title}`.length
    if (catalogChars + lineLength > IA_CONTEXT_LIMITS.catalogChars) break
    catalog.push(normalized)
    catalogChars += lineLength
  }

  const sources: IaContextSource[] = []
  let sourceChars = 0
  for (const item of rawSources.slice(0, IA_CONTEXT_LIMITS.sources)) {
    const normalized = {
      ...item,
      sourceId: clamp(item.sourceId, IA_CONTEXT_LIMITS.idChars),
      title: clamp(item.title, IA_CONTEXT_LIMITS.idChars),
      snippet: clamp(item.snippet, IA_CONTEXT_LIMITS.sourceSnippetChars),
    }
    const lineLength = normalized.title.length + normalized.snippet.length + normalized.citation.length
    if (sourceChars + lineLength > IA_CONTEXT_LIMITS.sourceChars) break
    sources.push(normalized)
    sourceChars += lineLength
  }

  const sections = [
    `Modo: ${snapshot.requested.mode}`,
    `Escopo: ${snapshot.resolvedScope.kind}`,
    selection ? `Seleção:\n${selection}` : '',
    catalog.length
      ? `Catálogo:\n${catalog.map((item) => `- [${item.kind}] ${item.title} (${item.id})`).join('\n')}`
      : '',
    sources.length
      ? `Fontes:\n${sources.map((item) => `- ${item.title}: ${item.snippet} [${item.citation}]`).join('\n')}`
      : '',
  ].filter(Boolean)
  const rendered = clamp(sections.join('\n\n'), IA_CONTEXT_LIMITS.bundleChars)

  return {
    snapshot,
    catalog,
    sources,
    rendered,
    budget: {
      selectionChars: selection.length,
      catalogChars,
      sourceChars,
      totalChars: rendered.length,
    },
  }
}
