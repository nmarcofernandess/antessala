import { useMemo, useState } from 'react'

import {
  WIDGET_CATEGORIES,
  getWidgetDefinition,
  type WidgetCategory,
  type WidgetType,
} from '@shared/anamnese'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export interface SelectionDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableWidgetTypes: readonly WidgetType[]
  onSelect: (type: WidgetType) => void
}

export function SelectionDrawer({
  open,
  onOpenChange,
  availableWidgetTypes,
  onSelect,
}: SelectionDrawerProps): React.JSX.Element {
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR')
    const result = new Map<WidgetCategory, WidgetType[]>()

    for (const type of availableWidgetTypes) {
      const definition = getWidgetDefinition(type)
      const searchable = [definition.label, definition.description, ...definition.tags]
        .join(' ')
        .toLocaleLowerCase('pt-BR')
      if (normalized && !searchable.includes(normalized)) continue

      const current = result.get(definition.category) ?? []
      current.push(type)
      result.set(definition.category, current)
    }
    return result
  }, [availableWidgetTypes, query])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Adicionar bloco</SheetTitle>
          <SheetDescription>Escolha um dos widgets disponíveis para esta anamnese.</SheetDescription>
        </SheetHeader>

        <Input
          className="mt-4"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar bloco..."
          aria-label="Buscar bloco"
        />

        <ScrollArea className="mt-4 min-h-0 flex-1 pr-3">
          <div className="space-y-6 pb-6">
            {Array.from(groups.entries()).map(([category, types]) => (
              <section key={category} className="space-y-2">
                <h3 className="text-sm font-semibold">
                  {WIDGET_CATEGORIES[category].icon} {WIDGET_CATEGORIES[category].label}
                </h3>
                <div className="space-y-2">
                  {types.map((type) => {
                    const definition = getWidgetDefinition(type)
                    return (
                      <Button
                        key={type}
                        type="button"
                        variant="outline"
                        className="h-auto w-full justify-start whitespace-normal px-4 py-3 text-left"
                        onClick={() => {
                          onSelect(type)
                          onOpenChange(false)
                        }}
                      >
                        <span>
                          <span className="block font-medium">{definition.label}</span>
                          <span className="block text-xs font-normal text-muted-foreground">
                            {definition.description}
                          </span>
                        </span>
                      </Button>
                    )
                  })}
                </div>
              </section>
            ))}
            {groups.size === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum bloco encontrado.</p>
            ) : null}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
