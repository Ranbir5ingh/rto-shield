import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { toursFor, type TourStep, type TourSurface } from '../src/lib/tours';

const OWNER = { email: 'e2e-owner@shop.test', password: 'e2e-owner-pass' };
const SHOTS = new Set(['all-open', 'band-low', 'message-language', 'lang-hindi', 'why-flagged', 'more-menu', 'menu-prepaid', 'call-panel']);

function surfaceOf(page: Page): TourSurface {
  return (page.viewportSize()?.width ?? 1280) < 1024 ? 'mobile' : 'desktop';
}

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

async function assertReveal(page: Page, step: TourStep, mobile: boolean) {
  await expect(page.locator(`[data-tour="${step.id}"]`).first()).toBeVisible();
  if (step.reveal?.includes('all-open')) {
    await expect(page.getByRole('tab', { name: /All open/i })).toHaveAttribute('aria-selected', 'true');
  }
  if (step.reveal?.includes('language')) {
    await expect(page.getByRole('listbox', { name: 'Message language' })).toBeVisible();
  }
  if (step.reveal?.includes('more')) {
    await expect(page.getByRole('menu')).toBeVisible();
  }
  if (step.reveal?.includes('order') && mobile) {
    await expect(page).toHaveURL(/\/app\/orders\//);
  }
  if (step.reveal?.includes('call')) {
    await expect(page.getByRole('region', { name: 'Call the buyer' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start browser call' })).toBeVisible();
    await expect(page.getByRole('menu')).toHaveCount(0);
  }
  if (!mobile && (step.id === 'why-flagged' || step.id === 'hold-approve')) {
    await expect(page.getByRole('tab', { name: /Needs action/i })).toHaveAttribute('aria-selected', 'true');
  }
}

async function walk(page: Page, steps: TourStep[], shots: boolean) {
  const mobile = surfaceOf(page) === 'mobile';
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index]!;
    const card = page.locator('#tour-card');
    await expect(card.getByRole('heading', { level: 2, name: step.title, exact: true })).toBeVisible();
    await assertReveal(page, step, mobile);
    await cardInView(page);
    if (shots && SHOTS.has(step.id)) {
      await page.screenshot({
        path: `/opt/cursor/artifacts/tour-voice-guide/${mobile ? 'mobile' : 'desktop'}-${step.id}.png`,
      });
    }
    if (index === steps.length - 1) await card.getByRole('button', { name: 'Done' }).click();
    else await card.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await assertTourClosed(page);
}

async function assertTourClosed(page: Page) {
  await expect(page.locator('#tour-card')).toHaveCount(0);
  await expect(page.locator('[data-tour-overlay]')).toHaveCount(0);
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.getByRole('listbox', { name: 'Message language' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Call the buyer' })).toHaveCount(0);
}

async function startTour(page: Page, title: string) {
  const card = page.locator('#tour-card');
  if (!(await card.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Help' }).click();
    await page.getByRole('menuitem', { name: 'Take the tour' }).click();
  }
  await expect(card.getByRole('heading', { level: 2, name: title, exact: true })).toBeVisible();
}

async function advanceTo(page: Page, title: string) {
  const card = page.locator('#tour-card');
  for (let guard = 0; guard < 40; guard += 1) {
    if (await card.getByRole('heading', { level: 2, name: title, exact: true }).isVisible().catch(() => false)) return;
    await card.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await expect(card.getByRole('heading', { level: 2, name: title, exact: true })).toBeVisible();
}

async function loginOwner(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(OWNER.email);
  await page.getByLabel('Password').fill(OWNER.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/app/);
}

async function openDemo(page: Page) {
  await page.goto('/');
  const buttons = page.getByRole('button', { name: 'Try the demo' });
  await expect(buttons.first()).toBeVisible();
  // The hero button can shift under the pointer, and a click during hydration is lost.
  // Retry until the demo session actually opens the app.
  await expect(async () => {
    const count = await buttons.count();
    for (let index = 0; index < count; index += 1) {
      const button = buttons.nth(index);
      if (await button.isVisible()) {
        await button.click({ timeout: 3000 });
        break;
      }
    }
    await expect(page).toHaveURL(/\/app/, { timeout: 4000 });
  }).toPass({ timeout: 20_000 });
}

test.describe.configure({ mode: 'serial' });

test('owner walks every tour step, including menus the tour opens', async ({ page }) => {
  test.setTimeout(180_000);
  mkdirSync('/opt/cursor/artifacts/tour-voice-guide', { recursive: true });
  const steps = toursFor('seller', surfaceOf(page));
  await loginOwner(page);
  await startTour(page, steps[0]!.title);
  await expect(page.locator('#tour-card').getByRole('button', { name: 'Mute' })).toBeVisible();
  await walk(page, steps, true);

  await startTour(page, steps[0]!.title);
  await advanceTo(page, 'More actions');
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.locator('[data-tour="menu-prepaid"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await assertTourClosed(page);

  if (surfaceOf(page) === 'mobile') {
    await startTour(page, steps[0]!.title);
    await advanceTo(page, 'Why it was flagged');
    await expect(page).toHaveURL(/\/app\/orders\//);
    await page.keyboard.press('Escape');
    await assertTourClosed(page);
    await expect(page).toHaveURL(/\/app\/queue/);
  }
});

test('demo walks every tour step', async ({ page }) => {
  test.setTimeout(180_000);
  const steps = toursFor('demo', surfaceOf(page));
  await openDemo(page);
  await startTour(page, steps[0]!.title);
  await walk(page, steps, false);
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
    await assertTourClosed(page);
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
