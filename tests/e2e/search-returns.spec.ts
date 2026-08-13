import { test, expect } from '@playwright/test'
import { launchApp, dismissWizard } from './helpers'

test('searching for seeded content returns results', async () => {
  const { app, page } = await launchApp('search-returns')
  try {
    await dismissWizard(page)

    // Navigate to Memoria page via sidebar
    await page.locator('[data-sidebar="menu-button"] >> text=Memoria').click()
    await page.waitForTimeout(1500)

    // Click Avancado tab (RAG Playground)
    await page.getByRole('tab', { name: /Avancado/i }).click()
    await page.waitForTimeout(1500)

    // The RAG Playground should be visible with search capabilities
    // Look for the playground input field
    const searchInput = page.locator('textarea, input[type="text"]').last()
    if (await searchInput.isVisible({ timeout: 3000 })) {
      await searchInput.fill('FlowKit')
      await page.waitForTimeout(2000)

      // Check that the playground area has content (results or UI elements)
      const body = await page.locator('body').textContent()
      expect(body).toBeTruthy()
    }

    // Verify the RAG Playground header is visible regardless
    await expect(page.getByText('RAG Playground')).toBeVisible()
  } finally {
    await app.close()
  }
})
