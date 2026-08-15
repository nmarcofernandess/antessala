import { resolve } from 'node:path'
import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    exclude: [
      ...configDefaults.exclude,
      'scripts/**/*.spec.ts',
      'tests/e2e/**',
      // `hack/arquivo` guarda código que nunca foi integrado. Ele está ali para
      // ser lido, não para rodar — os imports apontam para caminhos que não
      // existem mais, e coletá-lo só produziria vermelho sem significado.
      'hack/arquivo/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
})
