import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { toursFor, type TourStep, type TourSurface } from '../src/lib/tours';

const OWNER = { email: 'e2e-owner@shop.test', password: 'e2e-owner-pass' };
const SHOTS = new Set(['all-open', 'band-low', 'message-language', 'lang-hindi', 'why-flagged', 'copy-draft', 'send-whatsapp', 'more-menu', 'menu-pin', 'call-panel']);

function surfaceOf(page: Page): TourSurface {
  return (page.viewportSize()?.width ?? 1280) < 1024 ? 'mobile' : 'desktop';
}

async function footerFits(page: Page) {
  const footer = page.locator('[data-tour-footer]');
  const card = page.locator('#tour-card');
  await expect(footer).toBeVisible();
  const buttons = footer.getByRole('button');
  await expect(buttons).toHaveCount(4);
  const viewport = page.viewportSize();
  const cardBox = await card.boundingBox();
  expect(viewport && cardBox).toBeTruthy();
  if (!viewport || !cardBox) return;
  for (const button of await buttons.all()) {
    const box = await button.boundingBox();
    expect(box).toBeTruthy();
    if (!box) continue;
    expect(box.x).toBeGreaterThanOrEqual(cardBox.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 2);
  }
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

async function walk(page: Page, steps: TourStep[], shots: boolean, requested?: string[]) {
  const mobile = surfaceOf(page) === 'mobile';
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index]!;
    const card = page.locator('#tour-card');
    if (step.titleFromAnchor) {
      const anchor = page.locator(`[data-tour="${step.id}"]`).first();
      await expect(anchor).toBeVisible();
      const label = ((await anchor.textContent()) || '').replace(/\s+/g, ' ').trim();
      await expect(card.getByRole('heading', { level: 2 })).toHaveText(label);
    } else {
      await expect(card.getByRole('heading', { level: 2, name: step.title, exact: true })).toBeVisible();
    }
    await assertReveal(page, step, mobile);
    await cardInView(page);
    if (index === 0) {
      await footerFits(page);
      const second = steps[1]?.narrationId;
      if (requested && second) {
        await expect.poll(() => requested.some((url) => url.includes(`/api/tours/narration/${second}`) && url.includes('lang='))).toBe(true);
        await expect(card).toHaveAttribute('data-tour-audio', 'ready');
      }
    }
    if (shots && SHOTS.has(step.id)) {
      await page.screenshot({
        path: `/opt/cursor/artifacts/tour-lang-prefetch/${mobile ? 'mobile' : 'desktop'}-${step.id}.png`,
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
  // The tour can mount while Help is being clicked, and its scrim then swallows the click.
  await expect(async () => {
    if (await card.isVisible().catch(() => false)) return;
    if (await page.locator('[data-tour-overlay]').isVisible().catch(() => false)) {
      await expect(card).toBeVisible({ timeout: 1500 });
      return;
    }
    await page.getByRole('button', { name: 'Help' }).click({ timeout: 2000 });
    await page.getByRole('menuitem', { name: 'Take the tour' }).click({ timeout: 2000 });
    await expect(card).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await expect(card.getByRole('heading', { level: 2, name: 'Tour language', exact: true })).toBeVisible();
  await expect(card.getByRole('radio', { name: 'English', exact: true })).toBeChecked();
  await expect(card.getByRole('radio', { name: 'Hindi', exact: true })).toBeVisible();
  await expect(card.getByRole('radio', { name: 'Hinglish', exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Start', exact: true }).click();
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
  mkdirSync('/opt/cursor/artifacts/tour-lang-prefetch', { recursive: true });
  const requested: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/tours/narration/')) requested.push(req.url());
  });
  const steps = toursFor('seller', surfaceOf(page));
  await loginOwner(page);
  await startTour(page, steps[0]!.title);
  await expect(page.locator('#tour-card').getByRole('button', { name: 'Mute' })).toBeVisible();
  await walk(page, steps, true, requested);

  await startTour(page, steps[0]!.title);
  await advanceTo(page, 'More');
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
  await page.setViewportSize({ width: 360, height: 700 });
  await page.goto('/app/queue');
  if (!(await page.locator('#tour-card').isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Help' }).click();
    await page.getByRole('menuitem', { name: 'Take the tour' }).click();
  }
  const narrowCard = page.locator('#tour-card');
  if (await narrowCard.getByRole('button', { name: 'Start', exact: true }).isVisible().catch(() => false)) {
    await narrowCard.getByRole('button', { name: 'Start', exact: true }).click();
  }
  await footerFits(page);
  await page.keyboard.press('Escape');
  await assertTourClosed(page);
  await page.goto('/app/queue');
  await expect(page.getByRole('heading', { level: 1, name: /confirmation queue/i })).toBeVisible();
  const row = page.locator('[data-tour-row="1"]');
  await expect(row).toBeVisible();
  await row.locator('input[type="checkbox"]').check();
  const bar = page.locator('[data-selection-bar="true"]');
  await expect(bar).toBeVisible();
  const barBox = await bar.boundingBox();
  const narrow = page.viewportSize();
  expect(barBox && narrow).toBeTruthy();
  if (barBox && narrow) {
    expect(barBox.height).toBeLessThan(56);
    expect(barBox.x).toBeGreaterThanOrEqual(-1);
    expect(barBox.x + barBox.width).toBeLessThanOrEqual(narrow.width + 1);
    const centers: number[] = [];
    for (const button of await bar.getByRole('button').all()) {
      const box = await button.boundingBox();
      expect(box).toBeTruthy();
      if (!box) continue;
      expect(box.x + box.width).toBeLessThanOrEqual(narrow.width + 1);
      centers.push(box.y + box.height / 2);
    }
    const mid = centers[0] ?? 0;
    for (const center of centers) expect(Math.abs(center - mid)).toBeLessThan(8);
  }
  await bar.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(bar).toHaveCount(0);
  await row.click();
  await expect(page).toHaveURL(/\/app\/orders\//);
  await page.getByRole('button', { name: 'More', exact: true }).click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Check pincode' })).toBeVisible();
  const menuBox = await menu.boundingBox();
  const menuViewport = page.viewportSize();
  expect(menuBox && menuViewport).toBeTruthy();
  if (menuBox && menuViewport) {
    expect(menuBox.x).toBeGreaterThanOrEqual(-1);
    expect(menuBox.y).toBeGreaterThanOrEqual(-1);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(menuViewport.width + 1);
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(menuViewport.height + 2);
  }
  await page.getByRole('button', { name: 'Close menu' }).click();

  await page.goto('/app/history');
  await expect(page.getByRole('heading', { name: /order history/i })).toBeVisible();
  const historyLink = page.locator('article a[href^="/app/orders/"]').first();
  await expect(historyLink).toBeVisible();
  await historyLink.click();
  await expect(page).toHaveURL(/\/app\/orders\//);
  await expect(page.getByText(/Reasons from the order facts/i)).toBeVisible();
});
