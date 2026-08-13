import { create } from 'zustand'
import type { IaConversa, IaMensagem } from '@shared/index'
import { client } from '@/servicos/client'

function gerarTitulo(conteudo: string): string {
  const prefixo = conteudo.trim().slice(0, 50)
  if (conteudo.trim().length <= 50) return prefixo || 'Nova conversa'
  const ultimoEspaco = prefixo.lastIndexOf(' ')
  return `${ultimoEspaco > 0 ? prefixo.slice(0, ultimoEspaco) : prefixo}...`
}

interface IaStore {
  aberto: boolean
  setAberto: (aberto: boolean) => void
  toggleAberto: () => void
  tela: 'chat' | 'historico'
  setTela: (tela: 'chat' | 'historico') => void
  conversa_ativa_id: string | null
  conversa_ativa_titulo: string
  mensagens: IaMensagem[]
  carregando: boolean
  conversas: IaConversa[]
  busca_titulo: string
  setBuscaTitulo: (busca: string) => void
  _inicializado: boolean
  inicializar: () => Promise<void>
  novaConversa: () => Promise<void>
  carregarConversa: (id: string) => Promise<void>
  adicionarMensagem: (mensagem: IaMensagem) => Promise<void>
  listarConversas: () => Promise<void>
  arquivarConversa: (id: string) => Promise<void>
  restaurarConversa: (id: string) => Promise<void>
  deletarConversa: (id: string) => Promise<void>
  renomearConversa: (id: string, titulo: string) => Promise<void>
  editarEReenviar: (id: string, conteudo: string) => Promise<string | null>
}

async function listarTodos(busca?: string): Promise<IaConversa[]> {
  const [ativas, arquivadas] = await Promise.all([
    client['ia.conversas.listar']({ status: 'ativo', busca: busca || undefined }),
    client['ia.conversas.listar']({ status: 'arquivado', busca: busca || undefined }),
  ])
  return [...ativas, ...arquivadas]
}

export const useIaStore = create<IaStore>((set, get) => ({
  aberto: false,
  setAberto: (aberto) => set({ aberto }),
  toggleAberto: () => set((state) => ({ aberto: !state.aberto })),
  tela: 'chat',
  setTela: (tela) => set({ tela }),
  conversa_ativa_id: null,
  conversa_ativa_titulo: 'Nova conversa',
  mensagens: [],
  carregando: false,
  conversas: [],
  busca_titulo: '',
  setBuscaTitulo: (busca_titulo) => set({ busca_titulo }),
  _inicializado: false,

  inicializar: async () => {
    if (get()._inicializado) return
    set({ _inicializado: true })

    try {
      const conversas = await listarTodos()
      set({ conversas })
      const maisRecente = conversas.find((conversa) => conversa.status === 'ativo')
      if (maisRecente) {
        await get().carregarConversa(maisRecente.id)
      } else {
        await get().novaConversa()
      }
    } catch (error) {
      set({ _inicializado: false })
      throw error
    }
  },

  novaConversa: async () => {
    const conversaAtual = get().conversa_ativa_id
    if (conversaAtual && get().mensagens.length === 0) {
      await client['ia.conversas.deletar']({ id: conversaAtual }).catch(() => undefined)
    }

    const conversa = await client['ia.conversas.criar']({})
    set({
      conversa_ativa_id: conversa.id,
      conversa_ativa_titulo: conversa.titulo,
      mensagens: [],
      tela: 'chat',
    })
    await get().listarConversas()
  },

  carregarConversa: async (id) => {
    const resultado = await client['ia.conversas.obter']({ id })
    set({
      conversa_ativa_id: resultado.conversa.id,
      conversa_ativa_titulo: resultado.conversa.titulo,
      mensagens: resultado.mensagens,
      tela: 'chat',
    })
  },

  adicionarMensagem: async (mensagem) => {
    const { conversa_ativa_id, mensagens } = get()
    if (!conversa_ativa_id) return

    if (mensagem.papel === 'usuario' && !mensagens.some((item) => item.papel === 'usuario')) {
      const titulo = gerarTitulo(mensagem.conteudo)
      await client['ia.conversas.renomear']({ id: conversa_ativa_id, titulo })
      set({ conversa_ativa_titulo: titulo })
    }

    set((state) => ({ mensagens: [...state.mensagens, mensagem] }))
    await client['ia.mensagens.salvar']({ conversa_id: conversa_ativa_id, mensagem })
  },

  listarConversas: async () => {
    set({ conversas: await listarTodos(get().busca_titulo) })
  },

  arquivarConversa: async (id) => {
    await client['ia.conversas.arquivar']({ id })
    if (get().conversa_ativa_id === id) {
      set({ conversa_ativa_id: null, mensagens: [] })
      await get().novaConversa()
    } else {
      await get().listarConversas()
    }
  },

  restaurarConversa: async (id) => {
    await client['ia.conversas.restaurar']({ id })
    await get().listarConversas()
  },

  deletarConversa: async (id) => {
    await client['ia.conversas.deletar']({ id })
    if (get().conversa_ativa_id === id) {
      set({ conversa_ativa_id: null, mensagens: [] })
      await get().novaConversa()
    } else {
      await get().listarConversas()
    }
  },

  renomearConversa: async (id, titulo) => {
    await client['ia.conversas.renomear']({ id, titulo })
    if (get().conversa_ativa_id === id) set({ conversa_ativa_titulo: titulo })
    await get().listarConversas()
  },

  editarEReenviar: async (id, conteudo) => {
    const { conversa_ativa_id, mensagens } = get()
    const index = mensagens.findIndex((mensagem) => mensagem.id === id)
    if (!conversa_ativa_id || index < 0) return null

    const original = mensagens[index]
    await client['ia.mensagens.deletarApos']({
      conversa_id: conversa_ativa_id,
      timestamp: original.timestamp,
    })
    await client['ia.mensagens.atualizar']({ id, conteudo })
    set({ mensagens: [...mensagens.slice(0, index), { ...original, conteudo }] })
    return conteudo
  },
}))
