import { Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ORIGEM_LABELS } from '@/lib/galeria-constants'
import { useImageBlobUrl } from '@/hooks/useImageBlobUrl'
import type { GalleryImage } from '@shared/index'

interface GaleriaCardProps {
  image: GalleryImage
  onSelect: () => void
  onToggleFavorito: () => void
}

export function GaleriaCard({ image, onSelect, onToggleFavorito }: GaleriaCardProps) {
  const src = useImageBlobUrl(image.file_path, image.mime_type)

  return (
    <div
      className="aspect-square overflow-hidden rounded-md relative group cursor-pointer bg-muted"
      onClick={onSelect}
    >
      {src && (
        <img
          src={src}
          alt={image.nome_original}
          loading="lazy"
          className="size-full object-cover"
        />
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />

      {/* Star — always visible when favorited, hover-visible otherwise */}
      <button
        className={cn(
          'absolute top-1.5 right-1.5 z-10 rounded-full bg-black/40 p-1 transition-opacity',
          image.favorito ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
        onClick={(e) => { e.stopPropagation(); onToggleFavorito() }}
      >
        <Star className={cn('size-4', image.favorito ? 'fill-yellow-400 text-yellow-400' : 'text-white')} />
      </button>

      {/* Origem badge */}
      <Badge
        variant="secondary"
        className="absolute bottom-1.5 left-1.5 text-[10px] px-1.5 py-0 opacity-80"
      >
        {ORIGEM_LABELS[image.origem] ?? image.origem}
      </Badge>
    </div>
  )
}
