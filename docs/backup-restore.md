# Backup e Restore — FlowKit

Sistema de backup/restore manual do FlowKit. Export completo do banco em ZIP, restore com validacao.

---

## Arquitetura

```
src/main/backup.ts    ← Fonte unica: createSnapshot, restoreSnapshot, parseBackupFile
src/main/tipc.ts      ← IPC handlers (backup.*)
```

---

## Formato ZIP

```
flowkit-backup-2026-04-04T14-30-00-000.zip
├── _meta.json              ← versao, data, contagem de tabelas/registros
├── conhecimento/           ← knowledge_sources, chunks, entities, relations
├── conversas/              ← ia_conversas, ia_mensagens, ia_memorias
├── galeria/                ← gallery_images (metadata, nao binarios)
└── config/                 ← configuracao_ia, config
```

---

## Fluxo

### Export
1. Usuario clica "Criar Backup" em Configuracoes
2. `createSnapshot()` → serializa todas tabelas em JSON → grava ZIP
3. Dialog nativo para escolher destino

### Restore
1. Usuario clica "Restaurar" → seleciona ZIP
2. Valida formato (`_meta.json` presente)
3. Backup de seguranca automatico antes do restore
4. Limpa tabelas → importa dados → recria indexes
5. Notifica renderer via `data:invalidated`

---

## Tabelas Incluidas

| Grupo | Tabelas |
|-------|---------|
| Config | `config`, `configuracao_ia` |
| Knowledge | `knowledge_sources`, `knowledge_chunks`, `knowledge_entities`, `knowledge_relations` |
| IA | `ia_conversas`, `ia_mensagens`, `ia_memorias` |
| Gallery | `gallery_images` |

---

## UI

Botoes em Configuracoes:
- **Criar Backup** — export manual completo
- **Restaurar Backup** — import de ZIP

Sem auto-backup, sem Time Machine. Backup e sempre manual e completo.

---

## Testes

`tests/main/knowledge/backup-restore.spec.ts` — verifica roundtrip de backup/restore.
