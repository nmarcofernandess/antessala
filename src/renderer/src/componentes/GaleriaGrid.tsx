import { Image, Loader2 } from 'lucide-react'
import { useGaleriaStore } from '@/store/galeriaStore'
import { GaleriaCard } from './GaleriaCard'
import { EmptyState } from './EmptyState'

export function GaleriaGrid() {
  const imagens = useGaleriaStore((s) => s.imagens)
  const carregando = useGaleriaStore((s) => s.carregando)
  const selecionarImagem = useGaleriaStore((s) => s.selecionarImagem)
  const toggleFavorito = useGaleriaStore((s) => s.toggleFavorito)

  if (carregando && imagens.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (imagens.length === 0) {
    return (
      <EmptyState
        icon={Image}
        title="Nenhuma imagem na galeria"
        description="Faca upload para comecar"
      />
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
      {imagens.map((img) => (
        <GaleriaCard
          key={img.id}
          image={img}
          onSelect={() => selecionarImagem(img)}
          onToggleFavorito={() => toggleFavorito(img.id)}
        />
      ))}
    </div>
  )
}
