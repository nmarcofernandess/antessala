import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  value: string
  onChange: (valor: string) => void
  onEnviar: () => void
  disabled: boolean
  providerLabel: string
  modelo?: string
}

export function IaChatInput({ value, onChange, onEnviar, disabled, providerLabel, modelo }: Props) {
  const canSend = !disabled && value.trim().length > 0

  return (
    <div className="shrink-0 p-3">
      <div className="rounded-xl border bg-muted/30 p-2">
        <Textarea
          data-testid="ia-chat-input"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              if (canSend) onEnviar()
            }
          }}
          placeholder={disabled ? 'Configure a IA para conversar' : 'Escreva sua mensagem...'}
          aria-label="Mensagem"
          className="min-h-24 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center justify-between gap-3 px-1 pb-1">
          <span className="truncate text-xs text-muted-foreground">
            {providerLabel}{modelo ? ` · ${modelo}` : ''}
          </span>
          <Button
            type="button"
            size="icon"
            data-testid="ia-chat-send"
            aria-label="Enviar"
            disabled={!canSend}
            onClick={onEnviar}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        A IA só usa o conteúdo desta conversa. Revise informações clínicas antes de utilizá-las.
      </p>
    </div>
  )
}
