import { useEffect, useState } from 'react'

export type ImageBlobReader = (filePath: string) => Promise<string | null>

let registeredReader: ImageBlobReader | null = null

/** Registra a leitura de anexos quando uma superfície futura voltar a usá-la. */
export function registerImageBlobReader(reader: ImageBlobReader): () => void {
  registeredReader = reader
  return () => {
    if (registeredReader === reader) registeredReader = null
  }
}

/**
 * Hook dormente, sem vínculo com a galeria removida. Sem reader explícito ele
 * falha fechado e não toca disco, rede ou IPC.
 */
export function useImageBlobUrl(
  filePath: string | undefined,
  mimeType?: string | null,
): string | null {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!filePath || !registeredReader) {
      setSrc(null)
      return
    }

    let cancelled = false
    let objectUrl: string | undefined
    registeredReader(filePath)
      .then((base64) => {
        if (cancelled || !base64) return
        const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType ?? 'image/png' }))
        setSrc(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setSrc(null)
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [filePath, mimeType])

  return src
}
