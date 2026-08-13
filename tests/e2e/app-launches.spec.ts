import { test, expect } from '@playwright/test'
import { launchApp } from './helpers'

test('app opens and renders content', async () => {
  const { app, page } = await launchApp('app-launches')
  try {
    // Check the page has ANY content (not a blank white screen)
    const body = await page.locator('body').textContent()
    expect(body?.length).toBeGreaterThan(0)
  } finally {
    await app.close()
  }
})
