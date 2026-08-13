import { useState, useEffect } from 'react'
import { servicoGaleria } from '../servicos/galeria'

export function useImageBlobUrl(filePath: string | undefined, mimeType?: string | null): string | null {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!filePath) { setSrc(null); return }
    let revoked = false
    let url: string | undefined

    servicoGaleria.lerArquivo(filePath).then((base64) => {
      if (revoked) return
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: mimeType ?? 'image/png' })
      url = URL.createObjectURL(blob)
      setSrc(url)
    }).catch(() => { if (!revoked) setSrc(null) })

    return () => {
      revoked = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [filePath, mimeType])

  return src
}
