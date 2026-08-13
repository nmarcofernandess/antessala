/**
 * Fronteira de embeddings do repositório de conhecimento dormente.
 *
 * O Antessala não empacota um modelo, não baixa artefatos e não escolhe um
 * provider implicitamente. Uma implementação futura precisa ser registrada por
 * uma ação explícita antes de usar esta API. Sem adaptador, a busca e a ingestão
 * continuam em modo textual e estas funções retornam `null`.
 */

export type KnowledgeEmbeddingKind = 'query' | 'passage'

export interface KnowledgeEmbeddingAdapter {
  embed(text: string, kind: KnowledgeEmbeddingKind): Promise<number[] | null>
  embedMany?(
    texts: string[],
    kind: KnowledgeEmbeddingKind,
  ): Promise<Array<number[] | null> | null>
}

let registeredAdapter: KnowledgeEmbeddingAdapter | null = null

export function registerKnowledgeEmbeddingAdapter(
  adapter: KnowledgeEmbeddingAdapter,
): () => void {
  registeredAdapter = adapter
  return () => {
    if (registeredAdapter === adapter) registeredAdapter = null
  }
}

export function hasKnowledgeEmbeddingAdapter(): boolean {
  return registeredAdapter !== null
}

async function embed(
  text: string,
  kind: KnowledgeEmbeddingKind,
): Promise<number[] | null> {
  if (!registeredAdapter) return null

  try {
    return await registeredAdapter.embed(text, kind)
  } catch (error) {
    console.warn('[knowledge:embeddings] Adaptador indisponível:', (error as Error).message)
    return null
  }
}

export function generateQueryEmbedding(text: string): Promise<number[] | null> {
  return embed(text, 'query')
}

export function generatePassageEmbedding(text: string): Promise<number[] | null> {
  return embed(text, 'passage')
}

export async function generatePassageEmbeddings(
  texts: string[],
): Promise<number[][] | null> {
  if (!registeredAdapter) return null

  try {
    if (registeredAdapter.embedMany) {
      const result = await registeredAdapter.embedMany(texts, 'passage')
      if (!result || result.some((value) => value === null)) return null
      return result as number[][]
    }

    const result: number[][] = []
    for (const text of texts) {
      const embedding = await registeredAdapter.embed(text, 'passage')
      if (!embedding) return null
      result.push(embedding)
    }
    return result
  } catch (error) {
    console.warn('[knowledge:embeddings] Adaptador indisponível:', (error as Error).message)
    return null
  }
}
