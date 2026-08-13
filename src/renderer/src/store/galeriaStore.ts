import { create } from 'zustand'
import type { GalleryImage } from '@shared/index'
import { servicoGaleria } from '@/servicos/galeria'

interface GaleriaFiltros {
  origem?: string
  favorito?: boolean
  busca?: string
}

interface GaleriaStore {
  imagens: GalleryImage[]
  filtros: GaleriaFiltros
  carregando: boolean
  imagemSelecionada: GalleryImage | null

  buscar: () => Promise<void>
  setFiltros: (filtros: Partial<GaleriaFiltros>) => void
  upload: (input: { data_base64: string; mime_type: string; nome: string }) => Promise<void>
  remover: (id: string) => Promise<void>
  toggleFavorito: (id: string) => Promise<void>
  atualizarTags: (id: string, tags: string[]) => Promise<void>
  selecionarImagem: (img: GalleryImage | null) => void
}

let _fetchGen = 0

export const useGaleriaStore = create<GaleriaStore>((set, get) => ({
  imagens: [],
  filtros: {},
  carregando: false,
  imagemSelecionada: null,

  buscar: async () => {
    const gen = ++_fetchGen
    set({ carregando: true })
    try {
      const { filtros } = get()
      const imagens = await servicoGaleria.listar({
        origem: filtros.origem,
        favorito: filtros.favorito,
        busca: filtros.busca,
      })
      if (gen !== _fetchGen) return // stale, discard
      set({ imagens, carregando: false })
    } catch {
      if (gen === _fetchGen) set({ carregando: false })
    }
  },

  setFiltros: (novosFiltros) => {
    set((s) => ({ filtros: { ...s.filtros, ...novosFiltros } }))
    // Re-fetch with new filters
    get().buscar()
  },

  upload: async (input) => {
    await servicoGaleria.upload(input)
    await get().buscar()
  },

  remover: async (id) => {
    await servicoGaleria.remover(id)
    const { imagemSelecionada } = get()
    if (imagemSelecionada?.id === id) {
      set({ imagemSelecionada: null })
    }
    await get().buscar()
  },

  toggleFavorito: async (id) => {
    const result = await servicoGaleria.toggleFavorito(id)
    // Update in-place
    set((s) => ({
      imagens: s.imagens.map((img) =>
        img.id === id ? { ...img, favorito: result.favorito } : img,
      ),
      imagemSelecionada:
        s.imagemSelecionada?.id === id
          ? { ...s.imagemSelecionada, favorito: result.favorito }
          : s.imagemSelecionada,
    }))
  },

  atualizarTags: async (id, tags) => {
    const result = await servicoGaleria.atualizarTags(id, tags)
    set((s) => ({
      imagens: s.imagens.map((img) =>
        img.id === id ? { ...img, tags: result.tags } : img,
      ),
      imagemSelecionada:
        s.imagemSelecionada?.id === id
          ? { ...s.imagemSelecionada, tags: result.tags }
          : s.imagemSelecionada,
    }))
  },

  selecionarImagem: (imagemSelecionada) => set({ imagemSelecionada }),
}))
