import { expect, test, type Page } from '@playwright/test';
import { demoTour, sellerTour } from '../src/lib/tours';

const OWNER = { email: 'e2e-owner@shop.test', password: 'e2e-owner-pass' };

async function cardInView(page: Page) {
  const card = page.locator('#tour-card');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-tour-mode', /float|sheet|corner/);
  const box = await card.boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport).toBeTruthy();
  if (!box || !viewport) return;
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 2);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 2);
}

async function walk(page: Page, titles: string[]) {
  for (let index = 0; index < titles.length; index += 1) {
    const card = page.locator('#tour-card');
    await expect(card).toContainText(titles[index]!);
    await cardInView(page);
    if (index === titles.length - 1) await page.getByRole('button', { name: 'Done' }).click();
    else await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await expect(page.locator('#tour-card')).toHaveCount(0);
}

async function replay(page: Page, title: string) {
  await page.getByRole('button', { name: 'Help' }).click();
  await page.getByRole('menuitem', { name: 'Take the tour' }).click();
  await expect(page.locator('#tour-card')).toContainText(title);
  await cardInView(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#tour-card')).toHaveCount(0);
}

async function loginOwner(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(OWNER.email);
  await page.getByLabel('Password').fill(OWNER.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/app/);
}

test.describe.configure({ mode: 'serial' });

test('owner walks the full tour, then replay and Escape reset it', async ({ page }) => {
  await loginOwner(page);
  const card = page.locator('#tour-card');
  if (!(await card.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Help' }).click();
    await page.getByRole('menuitem', { name: 'Take the tour' }).click();
  }
  await expect(card).toBeVisible();
  await walk(page, sellerTour.map((step) => step.title));
  await replay(page, sellerTour[0]!.title);
});

test('demo walks the full tour', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the demo' }).first().click();
  await expect(page).toHaveURL(/\/app/);
  await expect(page.locator('#tour-card')).toContainText(demoTour[0]!.title);
  await walk(page, demoTour.map((step) => step.title));
});

test('every screen renders without a sideways scroll', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'Open your shop' })).toBeVisible();
  await page.goto('/guides/whatsapp');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await loginOwner(page);
  if (await page.locator('#tour-card').isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
  }
  const routes = ['/app', '/app/queue', '/app/orders', '/app/history', '/app/settings', '/app/start'];
  for (const route of routes) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
  await page.goto('/app/history');
  await expect(page.getByRole('heading', { name: /order history/i })).toBeVisible();
  const historyLink = page.locator('article a[href^="/app/orders/"]').first();
  await expect(historyLink).toBeVisible();
  await historyLink.click();
  await expect(page).toHaveURL(/\/app\/orders\//);
  await expect(page.getByText(/Reasons from the order facts/i)).toBeVisible();
});
