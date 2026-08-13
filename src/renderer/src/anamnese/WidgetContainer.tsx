import { useState } from 'react'
import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import { ChevronDown, ChevronUp, FileText, GripVertical, RotateCcw, Trash2 } from 'lucide-react'

import type { BlocoWidget, WidgetDefinition } from '@shared/anamnese'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { Textarea } from '@/components/ui/textarea'

import { getWidgetUI } from './registry'
import type { WidgetCatalogs } from './types'

export interface WidgetContainerProps {
  bloco: BlocoWidget
  onChange: (bloco: BlocoWidget) => void
  onDelete: () => void
  disabled?: boolean
  catalogs?: WidgetCatalogs
}

export function WidgetContainer({
  bloco,
  onChange,
  onDelete,
  disabled,
  catalogs,
}: WidgetContainerProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(true)
  const sortable = useSortable({ id: bloco.id, disabled })
  const entry = getWidgetUI(bloco.widgetType)
  const definition = entry.definition as unknown as WidgetDefinition<Record<string, unknown>>
  const parsed = definition.schema.safeParse(bloco.data)
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.65 : 1,
  }

  const data = parsed.success ? parsed.data : null
  const complete = data ? definition.isComplete(data) : false
  const summary = data ? definition.renderToSummary(data) : null

  return (
    <div ref={sortable.setNodeRef} style={style}>
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <Card>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0 p-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="cursor-grab"
              aria-label={`Reordenar ${definition.label}`}
              disabled={disabled}
              {...sortable.attributes}
              {...sortable.listeners}
            >
              <GripVertical />
            </Button>
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => setExpanded((current) => !current)}
              aria-expanded={expanded}
            >
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{definition.label}</CardTitle>
                <Badge variant={complete ? 'secondary' : 'outline'}>
                  {complete ? 'Completo' : 'Pendente'}
                </Badge>
              </div>
              <CardDescription className="mt-1">
                {!expanded && summary ? summary : definition.description}
              </CardDescription>
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={expanded ? 'Recolher bloco' : 'Expandir bloco'}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? <ChevronUp /> : <ChevronDown />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remover ${definition.label}`}
              disabled={disabled}
              onClick={onDelete}
            >
              <Trash2 />
            </Button>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="space-y-4 p-4 pt-0">
              {!parsed.success ? (
                <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                  Os dados deste widget são inválidos. Remova o bloco ou corrija a origem antes de salvar.
                </div>
              ) : bloco.convertidoParaTexto ? (
                <div className="space-y-3">
                  <Textarea
                    className="min-h-36 font-mono text-sm"
                    value={bloco.textoConvertido ?? ''}
                    disabled={disabled}
                    onChange={(event) => onChange({ ...bloco, textoConvertido: event.target.value })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={() => onChange({ ...bloco, convertidoParaTexto: false })}
                  >
                    <RotateCcw /> Voltar ao widget
                  </Button>
                </div>
              ) : (
                <>
                  <entry.Component
                    data={parsed.data}
                    catalogs={catalogs}
                    disabled={disabled}
                    onChange={(nextData) => onChange({ ...bloco, data: nextData })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled || definition.isEmpty(parsed.data)}
                    onClick={() => onChange({
                      ...bloco,
                      convertidoParaTexto: true,
                      textoConvertido: definition.renderToText(parsed.data),
                    })}
                  >
                    <FileText /> Converter em texto
                  </Button>
                </>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  )
}
