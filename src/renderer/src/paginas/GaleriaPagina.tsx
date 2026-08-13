import { useEffect } from 'react'
import { Search, Star, Image } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useGaleriaStore } from '@/store/galeriaStore'
import { GaleriaGrid } from '@/componentes/GaleriaGrid'
import { GaleriaDetailModal } from '@/componentes/GaleriaDetailModal'
import { GaleriaUploadDialog } from '@/componentes/GaleriaUploadDialog'
import { cn } from '@/lib/utils'

export function GaleriaPagina() {
  const buscar = useGaleriaStore((s) => s.buscar)
  const filtros = useGaleriaStore((s) => s.filtros)
  const setFiltros = useGaleriaStore((s) => s.setFiltros)

  useEffect(() => {
    buscar()
  }, [])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Galeria</h1>
          <p className="text-muted-foreground text-sm">
            Imagens geradas, extraidas e enviadas.
          </p>
        </div>
        <GaleriaUploadDialog />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filtros.origem ?? 'todas'}
          onValueChange={(v) => setFiltros({ origem: v === 'todas' ? undefined : v })}
        >
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="upload">Upload</SelectItem>
            <SelectItem value="chat">Chat</SelectItem>
            <SelectItem value="extracted">Extraidas</SelectItem>
            <SelectItem value="ai_generated">IA</SelectItem>
            <SelectItem value="screenshot">Screenshot</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={filtros.favorito ? 'default' : 'outline'}
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setFiltros({ favorito: filtros.favorito ? undefined : true })}
        >
          <Star
            className={cn(
              'size-3.5',
              filtros.favorito && 'fill-yellow-400 text-yellow-400',
            )}
          />
          Favoritas
        </Button>

        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={filtros.busca ?? ''}
            onChange={(e) => setFiltros({ busca: e.target.value || undefined })}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Grid */}
      <GaleriaGrid />

      {/* Detail modal */}
      <GaleriaDetailModal />
    </div>
  )
}
