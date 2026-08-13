import { useState, useRef } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useGaleriaStore } from '@/store/galeriaStore'
import { toast } from 'sonner'

export function GaleriaUploadDialog() {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<{ base64: string; mime: string; nome: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useGaleriaStore((s) => s.upload)

  const reset = () => {
    setPreview(null)
    fileRef.current = null
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // result = "data:<mime>;base64,<data>"
      const [header, data] = result.split(',')
      const mime = header.match(/data:(.*);/)?.[1] ?? 'image/png'
      fileRef.current = { base64: data, mime, nome: file.name }
      setPreview(result)
    }
    reader.readAsDataURL(file)
  }

  const handleUpload = async () => {
    if (!fileRef.current) return
    setUploading(true)
    try {
      await upload({
        data_base64: fileRef.current.base64,
        mime_type: fileRef.current.mime,
        nome: fileRef.current.nome,
      })
      toast.success('Imagem enviada com sucesso')
      reset()
      setOpen(false)
    } catch (err) {
      toast.error('Erro ao enviar imagem')
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Upload className="size-4" />
        Upload
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) reset()
          setOpen(v)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload de imagem</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
            />

            {preview && (
              <div className="flex justify-center">
                <img
                  src={preview}
                  alt="Preview"
                  className="max-h-48 rounded-md object-contain"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { reset(); setOpen(false) }}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={!fileRef.current || uploading}>
              {uploading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
