import { useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'

import {
  createWidgetBlock,
  getAvailableWidgetTypes,
  type AnamneseContent,
  type Bloco,
  type BlocoWidget,
  type WidgetType,
} from '@shared/anamnese'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

import { SelectionDrawer } from './SelectionDrawer'
import type { WidgetCatalogs } from './types'
import { WidgetContainer } from './WidgetContainer'

export interface AnamneseComposerProps {
  value: AnamneseContent
  onChange: (content: AnamneseContent) => void
  availableWidgetTypes?: readonly WidgetType[]
  catalogs?: WidgetCatalogs
  disabled?: boolean
}

/** Reordena somente widgets e mantém snapshots/resultados nos mesmos slots. */
export function reorderWidgetsPreservingAnchors(
  blocos: readonly Bloco[],
  activeId: string,
  overId: string,
): Bloco[] {
  const widgets = blocos.filter((bloco): bloco is BlocoWidget => bloco.type === 'widget')
  const oldIndex = widgets.findIndex((bloco) => bloco.id === activeId)
  const newIndex = widgets.findIndex((bloco) => bloco.id === overId)
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return [...blocos]

  const reordered = arrayMove(widgets, oldIndex, newIndex)
  let widgetIndex = 0
  return blocos.map((bloco) => bloco.type === 'widget' ? reordered[widgetIndex++] : bloco)
}

export function AnamneseComposer({
  value,
  onChange,
  availableWidgetTypes = getAvailableWidgetTypes(),
  catalogs,
  disabled,
}: AnamneseComposerProps): React.JSX.Element {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const widgetIds = value.blocos
    .filter((bloco): bloco is BlocoWidget => bloco.type === 'widget')
    .map((bloco) => bloco.id)

  const handleDragEnd = ({ active, over }: DragEndEvent): void => {
    if (!over || active.id === over.id) return
    onChange({
      ...value,
      blocos: reorderWidgetsPreservingAnchors(
        value.blocos,
        String(active.id),
        String(over.id),
      ),
    })
  }

  const updateWidget = (next: BlocoWidget): void => {
    onChange({
      ...value,
      blocos: value.blocos.map((bloco) => bloco.id === next.id ? next : bloco),
    })
  }

  return (
    <div className="space-y-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={widgetIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {value.blocos.map((bloco) => bloco.type === 'widget' ? (
              <WidgetContainer
                key={bloco.id}
                bloco={bloco}
                catalogs={catalogs}
                disabled={disabled}
                onChange={updateWidget}
                onDelete={() => onChange({
                  ...value,
                  blocos: value.blocos.filter((item) => item.id !== bloco.id),
                })}
              />
            ) : (
              <Card key={bloco.id}>
                <CardContent className="p-4 text-sm text-muted-foreground">
                  {bloco.type === 'snapshot' ? 'Snapshot capturado' : 'Resultado de protocolo capturado'}
                </CardContent>
              </Card>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {value.blocos.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum bloco foi adicionado. O catálogo clínico ativo será definido em
          {' '}hack/specs/02-quais-widgets/.
        </div>
      ) : null}

      <Button type="button" variant="outline" disabled={disabled} onClick={() => setDrawerOpen(true)}>
        <Plus /> Adicionar bloco
      </Button>

      <SelectionDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        availableWidgetTypes={availableWidgetTypes}
        onSelect={(widgetType) => onChange({
          ...value,
          blocos: [...value.blocos, createWidgetBlock(widgetType)],
        })}
      />
    </div>
  )
}
