import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { toursFor, type TourStep, type TourSurface } from '../src/lib/tours';

const OWNER = { email: 'e2e-owner@shop.test', password: 'e2e-owner-pass' };
const SHOTS = new Set(['impact', 'exceptions', 'exception-action', 'activity', 'results-home']);

function surfaceOf(page: Page): TourSurface {
  return (page.viewportSize()?.width ?? 1280) < 1024 ? 'mobile' : 'desktop';
}

async function footerFits(page: Page) {
  const card = page.locator('#tour-card');
  await expect(card).toHaveAttribute('data-tour-mode', /float|sheet|corner/);
  await expect(async () => {
    const fit = await page.evaluate(() => {
      const node = document.getElementById('tour-card');
      const footer = document.querySelector('[data-tour-footer]');
      if (!node || !footer) return { ok: false, reason: 'missing' };
      const buttons = [...footer.querySelectorAll('button')];
      if (buttons.length !== 4) return { ok: false, reason: 'count' };
      const cardBox = node.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      for (const button of buttons) {
        const box = button.getBoundingClientRect();
        if (box.left < cardBox.left - 1) return { ok: false, reason: 'left' };
        if (box.right > cardBox.right + 1) return { ok: false, reason: 'right' };
        if (box.top < -1) return { ok: false, reason: 'top' };
        if (box.bottom > viewportHeight + 2) return { ok: false, reason: 'bottom' };
      }
      return { ok: true, reason: 'fit' };
    });
    expect(fit.ok).toBe(true);
  }).toPass({ timeout: 5_000 });
}

async function cardClearsTarget(page: Page, stepId: string) {
  const card = page.locator('#tour-card');
  const target = page.locator(`[data-tour="${stepId}"]`).first();
  await expect(target).toBeVisible();
  const cardBox = await card.boundingBox();
  const targetBox = await target.boundingBox();
  expect(cardBox && targetBox).toBeTruthy();
  if (!cardBox || !targetBox) return;
  const separated =
    cardBox.x + cardBox.width <= targetBox.x + 1
    || targetBox.x + targetBox.width <= cardBox.x + 1
    || cardBox.y + cardBox.height <= targetBox.y + 1
    || targetBox.y + targetBox.height <= cardBox.y + 1;
  expect(separated).toBe(true);
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
    await expect(page.getByRole('region', { name: 'Demo: in the real product, RTO Shield calls the buyer automatically.' })).toBeVisible();
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
    await cardClearsTarget(page, step.id);
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
  await expect(page.getByRole('region', { name: 'Demo: in the real product, RTO Shield calls the buyer automatically.' })).toHaveCount(0);
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
});

test('try the demo reaches the connected store', async ({ page }) => {
  await openDemo(page);
  const steps = toursFor('demo', surfaceOf(page));
  await startTour(page, steps[0]!.title);
  await expect(page.locator('[data-tour="results-home"]').first()).toBeVisible();
  const card = page.locator('#tour-card');
  for (let guard = 0; guard < 12; guard += 1) {
    const heading = card.getByRole('heading', { level: 2, name: 'Shopify, connected', exact: true });
    if (await heading.isVisible().catch(() => false)) break;
    await expect(card.getByRole('heading', { level: 2 })).toBeVisible();
    await card.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await expect(card.getByRole('heading', { level: 2, name: 'Shopify, connected', exact: true })).toBeVisible();
  await expect(page.locator('[data-tour="shopify-connected"]').first()).toBeVisible();
  await expect(page.locator('[data-tour="shopify-connect"]')).toHaveCount(0);
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
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { level: 1, name: 'What leaves the shop' })).toBeVisible();
  await page.goto('/terms');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.goto('/shopify');
  await expect(page.getByRole('heading', { level: 1, name: 'RTO Shield' })).toBeVisible();
  await page.goto('/pay/not-a-real-token');
  await expect(page.getByRole('heading', { level: 1, name: 'Pay this order' })).toBeVisible();

  await loginOwner(page);
  if (await page.locator('#tour-card').isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await assertTourClosed(page);
  }
  const routes = ['/app', '/app/queue', '/app/orders', '/app/orders/new', '/app/orders/import', '/app/history', '/app/settings', '/app/start'];
  for (const route of routes) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize({ width: 360, height: 700 });
  await page.goto('/app/queue');
  const narrowCard = page.locator('#tour-card');
  await expect(async () => {
    if (await narrowCard.isVisible().catch(() => false)) return;
    if (await page.locator('[data-tour-overlay]').isVisible().catch(() => false)) {
      await expect(narrowCard).toBeVisible({ timeout: 1500 });
      return;
    }
    await page.getByRole('button', { name: 'Help' }).click({ timeout: 2000 });
    await page.getByRole('menuitem', { name: 'Take the tour' }).click({ timeout: 2000 });
    await expect(narrowCard).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  if (await narrowCard.getByRole('button', { name: 'Start', exact: true }).isVisible().catch(() => false)) {
    await narrowCard.getByRole('button', { name: 'Start', exact: true }).click();
  }
  await footerFits(page);
  await page.keyboard.press('Escape');
  await assertTourClosed(page);
  await page.goto('/app/queue');
  await expect(page.getByRole('heading', { level: 1, name: 'Exceptions', exact: true })).toBeVisible();
  await expect(page.locator('[data-tour="exceptions"]')).toBeVisible();
  if (await page.locator('[data-tour="exceptions"] a').count()) {
    await expect(page.locator('[data-tour="exception-order"]')).toBeHidden();
  } else {
    await expect(page.locator('[data-tour="exception-order"]')).toBeVisible();
    await expect(page.locator('[data-tour="exception-action"]')).toBeVisible();
  }
  await expect(page.locator('[data-selection-bar="true"]')).toHaveCount(0);

  await page.goto('/app/history');
  await expect(page.getByRole('heading', { name: 'Activity', exact: true })).toBeVisible();
  await expect(page.locator('[data-tour="activity"]')).toBeVisible();
});
