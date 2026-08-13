import { client } from './client'
import type { GalleryImage } from '@shared/index'

export const servicoGaleria = {
  listar: (filtros?: { origem?: string; favorito?: boolean; tags?: string[]; busca?: string }) =>
    client['gallery.listar'](filtros ?? {}) as Promise<GalleryImage[]>,

  upload: (input: { file_path?: string; data_base64?: string; mime_type?: string; nome: string }) =>
    client['gallery.upload'](input) as Promise<{ id: string; file_path: string }>,

  remover: (id: string) =>
    client['gallery.remover']({ id }) as Promise<{ ok: boolean }>,

  toggleFavorito: (id: string) =>
    client['gallery.toggleFavorito']({ id }) as Promise<{ favorito: boolean }>,

  atualizarTags: (id: string, tags: string[]) =>
    client['gallery.atualizarTags']({ id, tags }) as Promise<{ tags: string[] }>,

  lerArquivo: (relative_path: string) =>
    client['gallery.lerArquivo']({ relative_path }) as Promise<string>,
}
