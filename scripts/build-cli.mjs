// Build do CLI: src/cli/index.ts -> out/cli/index.js via API do esbuild.
//
// Por que API e não CLI: a forma `esbuild ... --banner:js='#!/usr/bin/env node'`
// depende de aspas simples, que o bash desfaz mas o cmd.exe do Windows NÃO —
// lá o `node'` virava um segundo input ("Must use outdir when there are
// multiple input files"). A API recebe o banner como string JS, sem shell.
import { build } from 'esbuild'

await build({
  entryPoints: ['src/cli/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'out/cli/index.js',
  banner: { js: '#!/usr/bin/env node' },
})
