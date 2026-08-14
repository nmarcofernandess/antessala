import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import { TableKit } from '@tiptap/extension-table'
import {
  Bold,
  Heading1,
  Heading2,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

export interface RichTextJson {
  type?: string
  attrs?: Record<string, unknown>
  content?: RichTextJson[]
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
  text?: string
}

interface RichTextEditorProps {
  value: RichTextJson
  onChange: (value: RichTextJson) => void
  title?: string
  onTitleChange?: (title: string) => void
  onSelectionChange?: (selection?: { text: string; from: number; to: number }) => void
  placeholder?: string
  status?: 'idle' | 'dirty' | 'saving' | 'saved' | 'indexing' | 'error'
  revision?: number
  editable?: boolean
}

export function RichTextEditor({
  value,
  onChange,
  title,
  onTitleChange,
  onSelectionChange,
  placeholder = 'Comece a escrever…',
  status = 'idle',
  revision,
  editable = true,
}: RichTextEditorProps) {
  const [linkUrl, setLinkUrl] = useState('')
  const onSelectionChangeRef = useRef(onSelectionChange)
  useEffect(() => { onSelectionChangeRef.current = onSelectionChange }, [onSelectionChange])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
      Highlight.configure({ multicolor: false }),
      TableKit.configure({ table: { resizable: true } }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editable,
    editorProps: {
      attributes: {
        class: 'min-h-[320px] max-w-none px-6 py-5 leading-7 outline-none [&_h1]:mb-5 [&_h1]:mt-8 [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:mb-4 [&_h2]:mt-7 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mb-3 [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_table]:my-5 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:bg-muted [&_th]:p-2 [&_th]:text-left [&_td]:border [&_td]:p-2',
      },
    },
    onUpdate: ({ editor: nextEditor }) => onChange(nextEditor.getJSON() as RichTextJson),
    onSelectionUpdate: ({ editor: nextEditor }) => {
      const { from, to } = nextEditor.state.selection
      const text = nextEditor.state.doc.textBetween(from, to, '\n').trim()
      onSelectionChangeRef.current?.(text ? { text, from, to } : undefined)
    },
  })

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(value)) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [editor, value])

  useEffect(() => {
    editor?.setEditable(editable)
  }, [editor, editable])

  if (!editor) return <div className="min-h-[320px] animate-pulse rounded-xl bg-muted/20" />

  const statusLabel = {
    idle: 'Pronto',
    dirty: 'Alterações pendentes',
    saving: 'Salvando…',
    saved: revision == null ? 'Salvo' : `Salvo · revisão ${revision}`,
    indexing: 'Salvo · indexando…',
    error: 'Não foi possível salvar',
  }[status]

  const toggleLink = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
      setLinkUrl('')
      return
    }
    if (!linkUrl.trim()) return
    editor.chain().focus().setLink({ href: linkUrl.trim() }).run()
    setLinkUrl('')
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {editable && <div className="flex flex-wrap items-center gap-1 border-b bg-muted/20 p-2">
        <Button size="icon" variant={editor.isActive('bold') ? 'secondary' : 'ghost'} aria-label="Negrito" onClick={() => editor.chain().focus().toggleBold().run()}><Bold /></Button>
        <Button size="icon" variant={editor.isActive('italic') ? 'secondary' : 'ghost'} aria-label="Itálico" onClick={() => editor.chain().focus().toggleItalic().run()}><Italic /></Button>
        <Button size="icon" variant={editor.isActive('strike') ? 'secondary' : 'ghost'} aria-label="Riscado" onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough /></Button>
        <Button size="icon" variant={editor.isActive('highlight') ? 'secondary' : 'ghost'} aria-label="Destacar" onClick={() => editor.chain().focus().toggleHighlight().run()}><Highlighter /></Button>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Button size="icon" variant={editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'} aria-label="Título 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 /></Button>
        <Button size="icon" variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'} aria-label="Título 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></Button>
        <Button size="icon" variant={!editor.isActive('heading') ? 'secondary' : 'ghost'} aria-label="Parágrafo" onClick={() => editor.chain().focus().setParagraph().run()}><Pilcrow /></Button>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Button size="icon" variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'} aria-label="Lista com marcadores" onClick={() => editor.chain().focus().toggleBulletList().run()}><List /></Button>
        <Button size="icon" variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'} aria-label="Lista numerada" onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered /></Button>
        <Button size="icon" variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'} aria-label="Citação" onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote /></Button>
        <span className="ml-auto text-xs text-muted-foreground" role="status" aria-live="polite">{statusLabel}</span>
      </div>}

      {editable && <div className="flex items-center gap-2 border-b px-4 py-2">
        <LinkIcon className="size-4 text-muted-foreground" />
        <Input
          value={linkUrl}
          onChange={(event) => setLinkUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              toggleLink()
            }
          }}
          placeholder="Link para o texto selecionado"
          aria-label="URL do link"
          className="h-8 max-w-sm border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <Button size="sm" variant="outline" onClick={toggleLink}>
          {editor.isActive('link') ? 'Remover link' : 'Aplicar link'}
        </Button>
        <div className="ml-auto flex gap-1">
          <Button size="icon" variant="ghost" aria-label="Desfazer" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 /></Button>
          <Button size="icon" variant="ghost" aria-label="Refazer" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 /></Button>
        </div>
      </div>}

      {title !== undefined && onTitleChange && (
        <Input
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          aria-label="Título"
          className="rounded-none border-0 border-b px-6 py-5 text-xl font-semibold shadow-none focus-visible:ring-0"
        />
      )}
      <EditorContent editor={editor} />
    </div>
  )
}
