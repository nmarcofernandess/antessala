import { useState } from 'react'
import { Star, Trash2, X, Plus, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useGaleriaStore } from '@/store/galeriaStore'
import { cn } from '@/lib/utils'
import { ORIGEM_LABELS } from '@/lib/galeria-constants'
import { useImageBlobUrl } from '@/hooks/useImageBlobUrl'

function formatarBytes(bytes: number | null): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatarData(iso: string): string {
  try {
    const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function GaleriaDetailModal() {
  const imagemSelecionada = useGaleriaStore((s) => s.imagemSelecionada)
  const selecionarImagem = useGaleriaStore((s) => s.selecionarImagem)
  const toggleFavorito = useGaleriaStore((s) => s.toggleFavorito)
  const remover = useGaleriaStore((s) => s.remover)
  const atualizarTags = useGaleriaStore((s) => s.atualizarTags)
  const navigate = useNavigate()

  const [novaTag, setNovaTag] = useState('')
  const [confirmRemover, setConfirmRemover] = useState(false)

  const img = imagemSelecionada
  const src = useImageBlobUrl(img?.file_path, img?.mime_type)

  if (!img) return null

  const handleAddTag = () => {
    const tag = novaTag.trim()
    if (!tag || img.tags.includes(tag)) return
    atualizarTags(img.id, [...img.tags, tag])
    setNovaTag('')
  }

  const handleRemoveTag = (tag: string) => {
    atualizarTags(img.id, img.tags.filter((t) => t !== tag))
  }

  return (
    <>
      <Dialog open={!!imagemSelecionada} onOpenChange={(open) => !open && selecionarImagem(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] p-0 gap-0 overflow-hidden">
          <div className="flex flex-col sm:flex-row h-full">
            {/* Image preview */}
            <div className="flex-1 min-h-0 flex items-center justify-center bg-black/5 dark:bg-black/20 p-4">
              {src && (
                <img
                  src={src}
                  alt={img.nome_original}
                  className="max-h-[60vh] max-w-full object-contain rounded"
                />
              )}
            </div>

            {/* Sidebar info */}
            <div className="w-full sm:w-64 flex-shrink-0 p-4 space-y-4 overflow-y-auto border-t sm:border-t-0 sm:border-l">
              <DialogHeader className="p-0">
                <DialogTitle className="text-sm font-medium break-all">
                  {img.nome_original}
                </DialogTitle>
              </DialogHeader>

              <Badge variant="secondary">{ORIGEM_LABELS[img.origem] ?? img.origem}</Badge>

              {/* Tags */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {img.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs gap-1">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)}>
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-1">
                  <Input
                    value={novaTag}
                    onChange={(e) => setNovaTag(e.target.value)}
                    placeholder="Nova tag..."
                    className="h-7 text-xs"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  />
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleAddTag}>
                    <Plus className="size-3" />
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Metadata */}
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Tamanho: {formatarBytes(img.size_bytes)}</p>
                {img.width && img.height && <p>Dimensoes: {img.width} x {img.height}</p>}
                <p>Criada em: {formatarData(img.criada_em)}</p>
              </div>

              {img.conversa_id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-xs"
                  onClick={() => {
                    selecionarImagem(null)
                    navigate('/ia')
                  }}
                >
                  <ExternalLink className="size-3" />
                  Ver conversa
                </Button>
              )}

              <Separator />

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => toggleFavorito(img.id)}
                >
                  <Star
                    className={cn(
                      'size-3.5',
                      img.favorito && 'fill-yellow-400 text-yellow-400',
                    )}
                  />
                  {img.favorito ? 'Desfavoritar' : 'Favoritar'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setConfirmRemover(true)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRemover} onOpenChange={setConfirmRemover}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover imagem</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover &quot;{img.nome_original}&quot;? Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await remover(img.id)
                  setConfirmRemover(false)
                } catch {
                  setConfirmRemover(false)
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
