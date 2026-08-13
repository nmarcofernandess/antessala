export type MaiaCommandKind =
  | 'ask'
  | 'summarize_clipboard'
  | 'dictate_clipboard'
  | 'draft_reply'

export type MaiaCommandOutput =
  | 'voice'
  | 'text'
  | 'copy'
  | 'paste'
  | 'replace'
  | 'chat'

export interface MaiaCommandInputSources {
  selection: boolean
  clipboard: boolean
  screenshot: boolean
}

export interface MaiaCommand {
  kind: MaiaCommandKind
  prompt: string
  inputSources: MaiaCommandInputSources
  output: MaiaCommandOutput
  openChatAfter: boolean
}

export interface MaiaCommandResult {
  conversaId?: string
  resposta: string
  output: MaiaCommandOutput
  sideEffects: {
    spoke: boolean
    copied: boolean
    pasted: boolean
    replaced: boolean
    openedChat: boolean
  }
  captured: {
    selection: boolean
    clipboard: boolean
    screenshot: boolean
  }
}

export function createDefaultDiscordReplyCommand(prompt: string): MaiaCommand {
  return {
    kind: 'ask',
    prompt,
    inputSources: {
      selection: true,
      clipboard: true,
      screenshot: true,
    },
    output: 'voice',
    openChatAfter: false,
  }
}
