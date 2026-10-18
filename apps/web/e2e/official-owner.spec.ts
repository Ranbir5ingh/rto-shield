import { expect, test } from '@playwright/test';

const OFFICIAL = { email: 'e2e-demo@shop.test', password: 'e2e-demo-pass' };

test('an owner login on the official demo account is a seller session', async ({ page }) => {
  test.setTimeout(120_000);
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  await page.addInitScript(() => {
    window.localStorage.setItem('rto-sidebar', 'collapsed');
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await page.getByLabel('Email').fill(OFFICIAL.email);
  await page.getByLabel('Password').fill(OFFICIAL.password);
  const completed = page
    .waitForResponse(
      (response) => response.url().includes('/api/tours/complete') && response.request().method() === 'POST',
      { timeout: 8_000 },
    )
    .catch(() => null);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/app/);
  const overlay = page.locator('[data-tour-overlay]');
  const started = await overlay.waitFor({ state: 'visible', timeout: 6_000 }).then(() => true).catch(() => false);
  if (started) {
    await page.keyboard.press('Escape');
    const saved = await completed;
    expect(saved?.status()).toBe(201);
    expect(saved?.request().postData()).toContain('"tour":"seller"');
    await expect(page.locator('#tour-card')).toHaveCount(0);
  }

  await expect(page.locator('header').getByText('Demo', { exact: true })).toHaveCount(0);
  await page.goto('/app/queue');
  await expect(page.getByRole('heading', { level: 1, name: 'Exceptions', exact: true })).toBeVisible();
  await page.locator('[data-tour="exceptions"] a').first().click();
  await expect(page).toHaveURL(/\/app\/queue\/[a-f\d]{24}$/i);
  await expect(page.getByRole('button', { name: 'Try one more call' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Demo: in the real product, RTO Shield calls the buyer automatically.' }),
  ).toHaveCount(0);

  await page.goto('/app/settings');
  await expect(page.getByRole('checkbox', { name: 'Run the shop without a morning queue' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Reset the demo' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/app');
  const expand = page.getByRole('button', { name: 'Expand sidebar' });
  await expect(expand).toBeVisible();
  await page.reload();
  await expect(expand).toBeVisible();
  await expand.click();
  await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible();

  const hydration = problems.filter((line) => /418|hydrat/i.test(line));
  expect(hydration).toEqual([]);
});
