import { mkdirSync } from 'node:fs';
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
      await expect(overlay).toHaveCount(0);
      return;
    }
    await page.waitForTimeout(200);
  }
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(OWNER.email);
  await page.getByLabel('Password').fill(OWNER.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/app/);
  await dismissTour(page);
}

async function frameOf(page: Page) {
  return page.evaluate(() => {
    const heading = document.querySelector('h1');
    const frame = heading?.closest('header')?.parentElement;
    if (!frame) return null;
    const style = getComputedStyle(frame);
    return {
      paddingLeft: style.paddingLeft,
      paddingRight: style.paddingRight,
      maxWidth: style.maxWidth,
      width: Math.round(frame.getBoundingClientRect().width),
    };
  });
}

test('exceptions use the results frame, and a phone opens a detail page', async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/app');
  await expect(page.getByRole('heading', { level: 1, name: 'Results', exact: true })).toBeVisible();
  const results = await frameOf(page);
  await page.goto('/app/queue');
  await dismissTour(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Exceptions', exact: true })).toBeVisible();
  const desktop = await frameOf(page);
  expect(desktop).toEqual(results);
  await expect(page.locator('[data-tour="exceptions"]')).toBeVisible();
  await expect(page.locator('[data-tour="exception-order"]')).toBeVisible();
  await expect(page.locator('[data-tour="exception-action"]')).toBeVisible();
  const desktopRows = page.locator('[data-tour="exceptions"] button');
  await expect(desktopRows.first()).toBeVisible();
  const firstName = (await desktopRows.first().innerText()).split('\n')[0]?.trim();
  if (await desktopRows.count() > 1) {
    await desktopRows.nth(1).click();
    await expect(page).toHaveURL(/\/app\/queue\?order=/);
  }
  await expect(page.locator('[data-tour="exception-action"]').getByRole('button', { name: 'Confirm' })).toBeVisible();
  await expect(page.locator('[data-tour="exception-action"]').getByRole('button', { name: 'Cancel' })).toBeVisible();
  await expect(page.locator('[data-tour="exception-action"]').getByRole('link', { name: 'Open' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try one more call' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Call the buyer' })).toHaveCount(0);
  await expect(page.locator('[data-autopilot-calls]')).toContainText(/Autopilot called|Autopilot has not called/);
  const extra = page.getByRole('button', { name: 'Try one more call' });
  if (await extra.isEnabled()) await extra.click();
  const result = page.locator('[data-call-result="simulated"]');
  await expect(result).toBeVisible();
  await expect(result).toContainText('Simulated call');
  await expect(result).toContainText('No answer');
  await expect(page.locator('[data-tour="exception-action"]').getByRole('button', { name: 'Confirm' })).toBeVisible();
  await expect(page.locator('[data-tour="exception-action"]').getByRole('button', { name: 'Cancel' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try one more call' })).toBeDisabled();
  await expect(page.getByText('One extra call already used.')).toBeVisible();
  mkdirSync('/opt/cursor/artifacts/final-polish', { recursive: true });
  await page.screenshot({ path: '/opt/cursor/artifacts/final-polish/extra-call-desktop.png' });
  await page.locator('[data-tour="exception-action"]').getByRole('link', { name: 'Open' }).click();
  await expect(page).toHaveURL(/\/app\/orders\//);
  await expect(page.getByRole('button', { name: 'Try one more call' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Call the buyer' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Check pincode' })).toBeVisible();
  expect(firstName).toBeTruthy();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app');
  await expect(page.getByRole('heading', { level: 1, name: 'Results', exact: true })).toBeVisible();
  const resultsPhone = await frameOf(page);
  await page.goto('/app/queue');
  await dismissTour(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Exceptions', exact: true })).toBeVisible();
  const phone = await frameOf(page);
  expect(phone).toEqual(resultsPhone);
  const phoneRows = page.locator('[data-tour="exceptions"] a');
  await expect(phoneRows.first()).toBeVisible();
  await expect(page.locator('[data-tour="exception-order"]')).toBeHidden();
  await phoneRows.first().click();
  await expect(page).toHaveURL(/\/app\/queue\/[a-f\d]{24}$/i);
  const back = page.getByRole('link', { name: '← Exceptions' });
  await expect(back).toBeVisible();
  await expect(page.locator('[data-tour="exception-action"]').getByRole('button', { name: 'Confirm' })).toBeVisible();
  await expect(page.locator('[data-tour="exception-action"]').getByRole('button', { name: 'Cancel' })).toBeVisible();
  await expect(page.locator('[data-tour="exception-action"]').getByRole('link', { name: 'Open' })).toBeVisible();
  await back.click();
  await expect(page).toHaveURL(/\/app\/queue$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Exceptions', exact: true })).toBeVisible();

  const dock = page.locator('[data-dock="bottom"]');
  const exceptions = dock.getByRole('link', { name: 'Exceptions' });
  await exceptions.evaluate((node) => {
    node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
  });
  const tip = page.getByRole('tooltip');
  await expect(tip).toHaveText('Exceptions');
  const tipBox = await tip.boundingBox();
  const dockBox = await dock.boundingBox();
  const viewport = page.viewportSize();
  expect(tipBox && dockBox && viewport).toBeTruthy();
  if (!tipBox || !dockBox || !viewport) return;
  const natural = await tip.evaluate((node) => ({
    bottom: node.style.bottom,
    clientHeight: node.clientHeight,
    scrollHeight: node.scrollHeight,
  }));
  expect(natural.bottom).toBe('auto');
  expect(tipBox.height).toBeGreaterThan(22);
  expect(natural.scrollHeight).toBeLessThanOrEqual(natural.clientHeight + 1);
  expect(tipBox.y).toBeGreaterThanOrEqual(0);
  expect(tipBox.x).toBeGreaterThanOrEqual(0);
  expect(tipBox.x + tipBox.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(tipBox.y + tipBox.height).toBeLessThanOrEqual(dockBox.y);
  const uncovered = await tip.evaluate((node) => {
    const previous = node.style.pointerEvents;
    node.style.pointerEvents = 'auto';
    const rect = node.getBoundingClientRect();
    const xs = [rect.left + 4, rect.left + rect.width / 2, rect.right - 4];
    const ys = [rect.top + 3, rect.top + rect.height / 2, rect.bottom - 3];
    const clear = ys.every((y) => xs.every((x) => {
      const hit = document.elementFromPoint(x, y);
      return hit === node || (hit !== null && node.contains(hit));
    }));
    node.style.pointerEvents = previous;
    return clear;
  });
  expect(uncovered).toBe(true);

  await page.goto('/app/settings');
  await dismissTour(page);
  await expect(page.getByRole('button', { name: 'Send test message to my number' })).toBeVisible();
});
