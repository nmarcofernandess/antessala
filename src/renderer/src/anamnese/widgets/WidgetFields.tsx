import { useEffect, useState, type ComponentProps, type ReactNode } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function WidgetField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {children}
    </div>
  )
}

export function numberOrUndefined(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

interface BoundedNumberInputProps extends Omit<
  ComponentProps<typeof Input>,
  'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'type'
> {
  value: number | undefined
  optional?: boolean
  onCommit: (value: number | undefined) => void
}

interface RequiredDraftInputProps extends Omit<
  ComponentProps<typeof Input>,
  'value' | 'defaultValue' | 'onChange' | 'onBlur'
> {
  value: string
  onCommit: (value: string) => void
  emptyError?: string
}

/** Publica texto obrigatório somente no blur e nunca expõe um valor vazio ao schema pai. */
export function RequiredDraftInput({
  value,
  onCommit,
  emptyError = 'Informe um valor.',
  onKeyDown,
  ...props
}: RequiredDraftInputProps): React.JSX.Element {
  const [draft, setDraft] = useState(value)
  const [showError, setShowError] = useState(false)

  useEffect(() => {
    setDraft(value)
    setShowError(false)
  }, [value])

  const commit = (): void => {
    const normalized = draft.trim()
    if (!normalized) {
      setShowError(true)
      return
    }
    setDraft(normalized)
    setShowError(false)
    onCommit(normalized)
  }

  return (
    <div className="space-y-1">
      <Input
        {...props}
        value={draft}
        aria-invalid={showError && !draft.trim()}
        onChange={(event) => {
          setDraft(event.target.value)
          if (event.target.value.trim()) setShowError(false)
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (!event.defaultPrevented && event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }
        }}
      />
      {showError && !draft.trim() ? (
        <p className="text-xs text-destructive" role="alert">{emptyError}</p>
      ) : null}
    </div>
  )
}

/**
 * Mantém o texto transitório no renderer. Assim digitar "70" não publica o
 * primeiro "7" contra um schema com min(20) e não desmonta o widget.
 */
export function BoundedNumberInput({
  value,
  optional = false,
  min,
  max,
  onCommit,
  onKeyDown,
  ...props
}: BoundedNumberInputProps): React.JSX.Element {
  const [draft, setDraft] = useState(value === undefined ? '' : String(value))
  const [showError, setShowError] = useState(false)

  useEffect(() => {
    setDraft(value === undefined ? '' : String(value))
  }, [value])

  const parsed = numberOrUndefined(draft)
  const minValue = typeof min === 'number' ? min : undefined
  const maxValue = typeof max === 'number' ? max : undefined
  const valid = draft.trim() === ''
    ? optional
    : parsed !== undefined &&
      (minValue === undefined || parsed >= minValue) &&
      (maxValue === undefined || parsed <= maxValue)

  const errorMessage = draft.trim() === ''
    ? 'Informe um valor.'
    : parsed === undefined
      ? 'Informe um número válido.'
      : minValue !== undefined && parsed < minValue
        ? `Valor mínimo: ${minValue}.`
        : maxValue !== undefined && parsed > maxValue
          ? `Valor máximo: ${maxValue}.`
          : null

  const commit = (): void => {
    if (!valid) {
      setShowError(true)
      return
    }
    setShowError(false)
    onCommit(parsed)
  }

  return (
    <div className="space-y-1">
      <Input
        {...props}
        type="number"
        min={min}
        max={max}
        value={draft}
        aria-invalid={showError && !valid}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (!event.defaultPrevented && event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }
        }}
      />
      {showError && !valid && errorMessage ? (
        <p className="text-xs text-destructive" role="alert">{errorMessage}</p>
      ) : null}
    </div>
  )
}
