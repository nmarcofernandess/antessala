# Release do FlowKit

Guia operacional para publicar builds do FlowKit em GitHub Releases.

Estado atual:
- release por tag `v*` via `.github/workflows/release.yml`;
- macOS + Windows buildados em runners nativos;
- release publicado direto, sem draft;
- build ad-hoc: sem assinatura Apple, sem notarização e sem certificado Windows;
- `latest-mac.yml` e `latest.yml` são publicados para metadata de update, mas esta lane não adiciona runtime de auto-update ao app.

---

## Como funciona

```text
tag vX.Y.Z
  -> GitHub Actions: Release
  -> verify: npm run typecheck + npm test
  -> create-release: cria GitHub Release publicado
  -> build macOS: npm run dist:mac
  -> build Windows: npm run dist:win
  -> verify-release: valida assets publicados
```

O workflow usa os scripts `dist:*`, que mantêm `--publish never`. Cada runner valida os assets da sua plataforma e faz upload direto para o GitHub Release com `gh release upload`.

O workflow não usa `actions/upload-artifact` para o caminho de release, porque quota de GitHub Actions Artifacts pode bloquear uploads grandes. A validação final lê o GitHub Release publicado e exige exatamente os 8 assets esperados. Se build ou validação falhar depois do release ser criado, o job `cleanup-release` apaga o release incompleto.

Essa separação evita publicar diretórios internos (`mac-arm64/`, `win-unpacked/`), `builder-debug.yml` ou zips grandes de GitHub Actions.

---

## Regra de versão

A tag precisa bater exatamente com `package.json`:

```text
package.json: "version": "1.9.0"
tag Git:      v1.9.0
```

Se a tag não bater, o job `create-release` falha antes de criar o release.

---

## Assets esperados

Para `v1.9.0`, o release deve conter:

```text
FlowKit-1.9.0-arm64.dmg
FlowKit-1.9.0-arm64.dmg.blockmap
FlowKit-1.9.0-arm64.zip
FlowKit-1.9.0-arm64.zip.blockmap
latest-mac.yml
FlowKit-Setup-1.9.0.exe
FlowKit-Setup-1.9.0.exe.blockmap
latest.yml
```

Não publicar:

```text
builder-debug.yml
mac-arm64/
win-unpacked/
zips de GitHub Actions artifact
```

O workflow também falha se qualquer asset individual tiver 2 GiB ou mais. GitHub Releases permite assets grandes, mas cada arquivo precisa ficar abaixo desse limite.

Fonte: https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases

---

## Release novo

1. Atualize a versão em `package.json`, se necessário.

2. Rode a validação local:

```bash
npm run typecheck
npm test
```

3. Commit e push em `main`.

4. Crie e envie a tag:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

Exemplo atual:

```bash
git tag v1.9.0
git push origin v1.9.0
```

5. Acompanhe o workflow:

```bash
GH_TOKEN=$(gh auth token --user nmarcofernandess) \
  gh run watch --repo nmarcofernandess/flowkit
```

---

## Verificação obrigatória

Depois do workflow verde:

```bash
GH_TOKEN=$(gh auth token --user nmarcofernandess) \
  gh release view vX.Y.Z \
    --repo nmarcofernandess/flowkit \
    --json isDraft,isPrerelease,assets,url
```

Critérios:
- `isDraft=false`;
- `isPrerelease=false`;
- os 8 assets esperados existem;
- `latest-mac.yml` referencia `FlowKit-X.Y.Z-arm64.dmg` ou `FlowKit-X.Y.Z-arm64.zip`;
- `latest.yml` referencia `FlowKit-Setup-X.Y.Z.exe`.

Baixar os YAMLs:

```bash
GH_TOKEN=$(gh auth token --user nmarcofernandess) \
  gh release download vX.Y.Z \
    --repo nmarcofernandess/flowkit \
    --pattern 'latest-mac.yml' \
    --output -

GH_TOKEN=$(gh auth token --user nmarcofernandess) \
  gh release download vX.Y.Z \
    --repo nmarcofernandess/flowkit \
    --pattern 'latest.yml' \
    --output -
```

---

## Build local com publicação

Use localmente só quando precisar publicar manualmente a partir do Mac/Windows:

```bash
GH_TOKEN=$(gh auth token --user nmarcofernandess) npm run release:mac
GH_TOKEN=$(gh auth token --user nmarcofernandess) npm run release:win
```

Para teste sem publicar:

```bash
npm run dist:mac
npm run dist:win
```

Os scripts `dist:*` geram os arquivos em `dist/`, mas não publicam.

---

## Instalação ad-hoc

### macOS

O build atual usa `identity: "-"` e `notarize: false`, então o Gatekeeper pode bloquear na primeira abertura.

Bypass para teste:

```bash
xattr -dr com.apple.quarantine "/Applications/FlowKit.app"
open "/Applications/FlowKit.app"
```

Também funciona: botão direito no app no Finder -> Abrir -> confirmar.

### Windows

O installer atual não é assinado. SmartScreen pode mostrar "Windows protected your PC".

Bypass para teste:
- clicar em "More info";
- clicar em "Run anyway";
- se necessário, executar como administrador.

Assinatura/notarização ficam para a lane de distribuição oficial.

---

## Recuperação

### Tag errada

```bash
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z
```

Se o release foi criado:

```bash
GH_TOKEN=$(gh auth token --user nmarcofernandess) \
  gh release delete vX.Y.Z --repo nmarcofernandess/flowkit
```

### Release incompleto

Não edite asset incompleto no escuro. Primeiro liste:

```bash
GH_TOKEN=$(gh auth token --user nmarcofernandess) \
  gh release view vX.Y.Z \
    --repo nmarcofernandess/flowkit \
    --json assets \
    --jq '.assets[].name'
```

Se faltou YAML ou blockmap, a correção preferida é ajustar o workflow e criar uma nova tag patch. Upload manual só é aceitável para recuperação controlada, com os YAMLs gerados pelo `electron-builder`.
