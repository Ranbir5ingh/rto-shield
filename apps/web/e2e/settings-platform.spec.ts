import { expect, test } from '@playwright/test';

const OWNER = { email: 'e2e-owner@shop.test', password: 'e2e-owner-pass' };

test('settings shows platform messaging and calls without a voice key', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(OWNER.email);
  await page.getByLabel('Password').fill(OWNER.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/app/);
  if (await page.locator('#tour-card').isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
  }
  await page.goto('/app/settings');
  await expect(page.getByTestId('messaging-status')).toHaveText(/Messaging: RTO Shield \(default\)|Messaging: Your own number/);
  await expect(page.getByTestId('calls-status')).toHaveText('Calls: by RTO Shield');
  await expect(page.getByRole('checkbox', { name: 'Use my own WhatsApp Business number' })).toBeVisible();
  await expect(page.getByLabel('API key')).toHaveCount(0);
  await expect(page.getByText('ElevenLabs')).toHaveCount(0);
});
