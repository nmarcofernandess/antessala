import { test, expect } from '@playwright/test'
import { launchApp, dismissWizard } from './helpers'

test('app has a theme class on html element', async () => {
  const { app, page } = await launchApp('dark-mode')
  try {
    await dismissWizard(page)
    // next-themes sets a class on <html> — either "light" or "dark"
    const htmlClass = await page.locator('html').getAttribute('class')
    expect(htmlClass).toBeTruthy()
    const hasTheme = htmlClass!.includes('dark') || htmlClass!.includes('light')
    expect(hasTheme).toBe(true)
  } finally {
    await app.close()
  }
})
