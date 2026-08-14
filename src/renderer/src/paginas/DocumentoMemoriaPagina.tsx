import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Download, FileText, History, Loader2, RotateCcw } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/componentes/PageHeader'
import { RichTextEditor, type RichTextJson } from '@/componentes/RichTextEditor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  servicoConhecimento,
  type KnowledgeDocument,
  type KnowledgeDocumentVersion,
} from '@/servicos/conhecimento'

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'indexing' | 'error'

function cleanError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error))
    .replace(/^Error invoking remote method '[^']+': Error:\s*/i, '')
    .replace(/^Error:\s*/i, '')
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export function DocumentoMemoriaPagina() {
  const { id: rawId } = useParams<{ id: string }>()
  const id = Number(rawId)
  const navigate = useNavigate()
  const [document, setDocument] = useState<KnowledgeDocument | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState<RichTextJson>({ type: 'doc', content: [] })
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [loading, setLoading] = useState(true)
  const [versions, setVersions] = useState<KnowledgeDocumentVersion[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [restoring, setRestoring] = useState<number | null>(null)
  const revisionRef = useRef(0)
  const titleRef = useRef('')
  const contentRef = useRef<RichTextJson>(content)
  const changeRef = useRef(0)
  const savedChangeRef = useRef(0)
  const savingRef = useRef(false)
  const enrichmentTimerRef = useRef<number | null>(null)

  const load = useCallback(async () => {
    if (!Number.isInteger(id) || id <= 0) {
      setLoading(false)
      setStatus('error')
      return
    }
    setLoading(true)
    try {
      const loaded = await servicoConhecimento.obterDocumento(id)
      setDocument(loaded)
      setTitle(loaded.titulo)
      setContent(loaded.content_json)
      titleRef.current = loaded.titulo
      contentRef.current = loaded.content_json
      revisionRef.current = loaded.revision
      changeRef.current = 0
      savedChangeRef.current = 0
      setStatus('saved')
    } catch (error) {
      setStatus('error')
      toast.error('Não foi possível abrir o documento', { description: cleanError(error) })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  const scheduleEnrichment = useCallback(() => {
    if (enrichmentTimerRef.current) window.clearTimeout(enrichmentTimerRef.current)
    enrichmentTimerRef.current = window.setTimeout(async () => {
      setStatus('indexing')
      try {
        await servicoConhecimento.enrich(id)
      } catch {
        // Leitura, edição e busca textual continuam funcionais sem Gemini.
      } finally {
        setStatus('saved')
      }
    }, 10_000)
  }, [id])

  const save = useCallback(async () => {
    if (!document || savingRef.current || savedChangeRef.current === changeRef.current) return
    savingRef.current = true
    const savingChange = changeRef.current
    setStatus('saving')
    try {
      const saved = await servicoConhecimento.salvarDocumento({
        id,
        expected_revision: revisionRef.current,
        titulo: titleRef.current,
        content_json: contentRef.current,
      })
      revisionRef.current = saved.revision
      savedChangeRef.current = savingChange
      setDocument(saved)
      if (changeRef.current === savingChange) {
        setStatus('saved')
        if (saved.enrichment_status !== 'ready') scheduleEnrichment()
      } else {
        setStatus('dirty')
      }
    } catch (error) {
      setStatus('error')
      toast.error('Não foi possível salvar', { description: cleanError(error) })
    } finally {
      savingRef.current = false
    }
  }, [document, id, scheduleEnrichment])

  useEffect(() => {
    if (status !== 'dirty') return
    const timer = window.setTimeout(() => void save(), 700)
    return () => window.clearTimeout(timer)
  }, [save, status, title, content])

  useEffect(() => () => {
    const enrichmentWasScheduled = enrichmentTimerRef.current != null
    if (enrichmentTimerRef.current) {
      window.clearTimeout(enrichmentTimerRef.current)
    }
    if (savedChangeRef.current !== changeRef.current && !savingRef.current) {
      void servicoConhecimento.salvarDocumento({
        id,
        expected_revision: revisionRef.current,
        titulo: titleRef.current,
        content_json: contentRef.current,
      }).then((saved) => {
        if (enrichmentWasScheduled || saved.enrichment_status !== 'ready') {
          return servicoConhecimento.enrich(id)
        }
        return undefined
      }).catch(() => undefined)
    } else if (enrichmentWasScheduled) {
      void servicoConhecimento.enrich(id).catch(() => undefined)
    }
  }, [id])

  const markChanged = () => {
    changeRef.current += 1
    setStatus('dirty')
  }

  const handleTitleChange = (next: string) => {
    titleRef.current = next
    setTitle(next)
    markChanged()
  }

  const handleContentChange = (next: RichTextJson) => {
    contentRef.current = next
    setContent(next)
    markChanged()
  }

  const openHistory = async () => {
    setHistoryOpen(true)
    try {
      setVersions(await servicoConhecimento.listarVersoes(id))
    } catch (error) {
      toast.error('Não foi possível carregar as versões', { description: cleanError(error) })
    }
  }

  const restore = async (revision: number) => {
    setRestoring(revision)
    try {
      const restored = await servicoConhecimento.restaurarVersao(id, revision, revisionRef.current)
      setDocument(restored)
      setTitle(restored.titulo)
      setContent(restored.content_json)
      titleRef.current = restored.titulo
      contentRef.current = restored.content_json
      revisionRef.current = restored.revision
      changeRef.current += 1
      savedChangeRef.current = changeRef.current
      setStatus('saved')
      setVersions(await servicoConhecimento.listarVersoes(id))
      scheduleEnrichment()
      toast.success(`Revisão ${revision} restaurada como revisão ${restored.revision}`)
    } catch (error) {
      toast.error('Não foi possível restaurar', { description: cleanError(error) })
    } finally {
      setRestoring(null)
    }
  }

  const exportMarkdown = async () => {
    try {
      await save()
      const result = await servicoConhecimento.exportarMarkdown(id)
      if (result.saved) toast.success('Markdown exportado')
    } catch (error) {
      toast.error('Não foi possível exportar', { description: cleanError(error) })
    }
  }

  if (loading) {
    return <div className="grid min-h-full place-items-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  }

  if (!document) {
    return (
      <div className="grid min-h-full place-items-center p-8 text-center">
        <div><FileText className="mx-auto size-10 text-muted-foreground" /><p className="mt-4 font-medium">Documento não encontrado</p><Button className="mt-4" variant="outline" onClick={() => navigate('/memoria')}>Voltar à Memória</Button></div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-muted/10">
      <PageHeader breadcrumbs={[{ label: 'Antessala' }, { label: 'Memória' }, { label: document.titulo }]} />
      <div className="mx-auto w-full max-w-5xl px-6 py-7 lg:px-8">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/memoria')}><ArrowLeft className="size-4" /> Biblioteca</Button>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void openHistory()}><History className="size-4" /> Versões</Button>
            <Button variant="outline" size="sm" onClick={() => void exportMarkdown()}><Download className="size-4" /> Exportar Markdown</Button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{document.source_format.toUpperCase()}</Badge>
          {document.page_count && <span>{document.page_count} páginas</span>}
          <span>{document.word_count.toLocaleString('pt-BR')} palavras</span>
          <span>revisão {document.revision}</span>
        </div>

        <RichTextEditor
          value={content}
          onChange={handleContentChange}
          title={title}
          onTitleChange={handleTitleChange}
          status={status}
          revision={revisionRef.current}
          placeholder="Escreva o conteúdo do documento…"
        />
      </div>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de versões</DialogTitle>
            <DialogDescription>Cada restauração cria uma nova revisão; nada é sobrescrito silenciosamente.</DialogDescription>
          </DialogHeader>
          <div className="divide-y rounded-xl border">
            {versions.map((version) => (
              <div key={version.revision} className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">Revisão {version.revision} · {version.titulo}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(version.criada_em)} · {version.reason}</p>
                </div>
                <Button size="sm" variant="outline" disabled={version.revision === revisionRef.current || restoring != null} onClick={() => void restore(version.revision)}>
                  {restoring === version.revision ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Restaurar
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
