import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/**
 * Embedding local via @huggingface/transformers (ONNX Runtime).
 * Modelo: multilingual-e5-base (768 dims, ~150-440MB quantizado).
 *
 * Funciona estritamente offline, sem API key e sem download automático.
 * Graceful degradation: retorna null se o modelo local estiver indisponível.
 *
 * e5 requer prefixes: "query: " para busca, "passage: " para indexação.
 */

let _extractor: any = null

function resolveModelPath(): string {
  try {
    const electron = require('electron') as { app?: { isPackaged?: boolean } }
    if (electron.app?.isPackaged) {
      return path.join(process.resourcesPath, 'models', 'embeddings')
    }
  } catch {
    // fallback para modo Node (test runner, scripts)
  }
  return path.join(__dirname, '../../models/embeddings')
}

async function getExtractor(): Promise<any> {
  if (_extractor) return _extractor

  const { pipeline, env } = await import('@huggingface/transformers')
  const fs = require('fs')

  const modelPath = resolveModelPath()

  // Esta fronteira é deliberadamente fail-closed: o Antessala nunca baixa
  // modelos em runtime, mesmo se o módulo dormente de Memória for chamado.
  const hasLocalModel = fs.existsSync(path.join(modelPath, 'onnx'))
    || fs.existsSync(path.join(modelPath, 'model.onnx'))
    || fs.existsSync(path.join(modelPath, 'tokenizer.json'))

  env.localModelPath = modelPath
  env.allowRemoteModels = false
  if (!hasLocalModel) throw new Error(`Modelo local não encontrado em ${modelPath}.`)

  console.log('[embeddings] Usando modelo local:', modelPath)

  _extractor = await pipeline('feature-extraction', 'Xenova/multilingual-e5-base', {
    dtype: 'q8' as any,
  } as any)

  console.log('[embeddings] Modelo carregado com sucesso (768 dims)')
  return _extractor
}

/**
 * Gera embedding para uma query de busca (prefix "query: ").
 * Retorna null se modelo indisponível.
 * Graceful degradation: NUNCA lança erro — retorna null.
 */
export async function generateQueryEmbedding(text: string): Promise<number[] | null> {
  try {
    const ext = await getExtractor()
    const output = await ext(`query: ${text}`, { pooling: 'mean', normalize: true })
    return Array.from(output.data as Float32Array)
  } catch (err) {
    console.warn('[knowledge:embeddings] Modelo local indisponível:', (err as Error).message)
    return null
  }
}

/**
 * Gera embedding para um passage/documento (prefix "passage: ").
 * Retorna null se modelo indisponível.
 * Graceful degradation: NUNCA lança erro — retorna null.
 */
export async function generatePassageEmbedding(text: string): Promise<number[] | null> {
  try {
    const ext = await getExtractor()
    const output = await ext(`passage: ${text}`, { pooling: 'mean', normalize: true })
    return Array.from(output.data as Float32Array)
  } catch (err) {
    console.warn('[knowledge:embeddings] Modelo local indisponível:', (err as Error).message)
    return null
  }
}

/**
 * Gera embeddings em lote para passages (prefix "passage: ").
 * Retorna null se modelo indisponível.
 * Processa sequencialmente para controle de memória.
 * Graceful degradation: NUNCA lança erro — retorna null.
 */
export async function generatePassageEmbeddings(texts: string[]): Promise<number[][] | null> {
  try {
    const ext = await getExtractor()
    const results: number[][] = []
    for (const text of texts) {
      const output = await ext(`passage: ${text}`, { pooling: 'mean', normalize: true })
      results.push(Array.from(output.data as Float32Array))
    }
    return results
  } catch (err) {
    console.warn('[knowledge:embeddings] Modelo local indisponível:', (err as Error).message)
    return null
  }
}
