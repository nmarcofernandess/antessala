import { test, expect } from '@playwright/test'
import { launchApp, dismissWizard } from './helpers'

test.describe('database status', () => {
  test('dashboard renders stat cards with numeric values (DB is functional)', async () => {
    const { app, page } = await launchApp('db-status')
    try {
      await dismissWizard(page)

      // Dashboard should show stat cards: Fontes, Fragmentos, Entidades, Memorias
      // Each with a "0" value (fresh DB) — not an error state
      const statLabels = ['Fontes', 'Fragmentos', 'Entidades', 'Memorias']

      for (const label of statLabels) {
        const card = page.getByText(label, { exact: true })
        await expect(card).toBeVisible()
      }

      // Verify the "Banco de dados" system status shows "Conectado"
      await expect(page.getByText('Conectado').first()).toBeVisible()

      // Verify stat values are "0" (not error text)
      // The stat cards render a <p> with "0" and class "text-2xl font-bold"
      const zeros = page.locator('p.font-bold').filter({ hasText: '0' })
      const count = await zeros.count()
      expect(count).toBeGreaterThanOrEqual(4)
    } finally {
      await app.close()
    }
  })
})
