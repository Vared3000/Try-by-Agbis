import { expect, test } from '@playwright/test'

test('login page and API are available', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'С возвращением' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Войти' })).toBeEnabled()

  const health = await request.get('/api/v1/health')
  expect(health.ok()).toBeTruthy()
  expect((await health.json()).data.status).toBe('ok')
})

test('login layout stays usable on the configured viewport', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('main.login-page')).toBeVisible()
  const viewport = page.viewportSize()
  const card = await page.locator('form.login-card').boundingBox()
  expect(card.x).toBeGreaterThanOrEqual(0)
  expect(card.x + card.width).toBeLessThanOrEqual(viewport.width)
})
