import { expect, test, type Page } from '@playwright/test';

const OWNER = { email: 'e2e-owner@shop.test', password: 'e2e-owner-pass' };

async function dismissTour(page: Page) {
  const overlay = page.locator('[data-tour-overlay]');
  const started = Date.now();
  while (Date.now() - started < 3_000) {
    if (await overlay.isVisible().catch(() => false)) {
      const saved = page.waitForResponse((response) => response.url().includes('/api/tours/complete') && response.ok()).catch(() => null);
      await page.keyboard.press('Escape');
      await saved;
      await expect(page.locator('#tour-card')).toHaveCount(0);
      return;
    }
    await page.waitForTimeout(200);
  }
}

test('settings shows platform messaging and calls without a voice key', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(OWNER.email);
  await page.getByLabel('Password').fill(OWNER.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/app/);
  await dismissTour(page);
  await page.goto('/app/settings');
  await dismissTour(page);
  await expect(page.getByTestId('messaging-status')).toHaveText(/Messaging: RTO Shield \(default\)|Messaging: Your own number/);
  await expect(page.getByTestId('calls-status')).toHaveText('Calls: by RTO Shield');
  await expect(page.getByRole('checkbox', { name: 'Use my own WhatsApp Business number' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send test message to my number' })).toBeVisible();
  await expect(page.getByLabel('API key')).toHaveCount(0);
  await expect(page.getByText('ElevenLabs')).toHaveCount(0);
  await expect(page.getByText('e2e-webhook-verify-secret')).toHaveCount(0);
  await page.getByRole('button', { name: 'Setup guide' }).click();
  await expect(page.getByRole('dialog', { name: 'Setup guide' })).toBeVisible();
  await expect(page.getByText('https://api.rtoshield.tech/api/whatsapp/webhook')).toBeVisible();
  await expect(page.getByText('e2e-webhook-verify-secret')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reveal verify token' }).click();
  await page.getByLabel('Account password').fill(OWNER.password);
  await page.getByRole('button', { name: 'Show verify token' }).click();
  await expect(page.getByTestId('verify-token-value')).toHaveText('e2e-webhook-verify-secret');
});
