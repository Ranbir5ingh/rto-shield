import { mkdirSync } from 'node:fs';
import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

const OWNER = { email: 'e2e-owner@shop.test', password: 'e2e-owner-pass' };
const PUBLIC = ['/', '/login', '/signup', '/guides/whatsapp', '/privacy', '/terms', '/shopify', '/pay/not-a-real-token'];
const APP = ['/app', '/app/queue', '/app/orders', '/app/orders/new', '/app/orders/import', '/app/history', '/app/settings', '/app/start', '/app/scanner'];

function ignore(text: string) {
  return /favicon|Download the React DevTools/i.test(text);
}

function watch(page: Page, bucket: string[]) {
  const note = (text: string) => {
    if (!ignore(text)) bucket.push(text);
  };
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') note(message.text());
  });
  page.on('pageerror', (error) => note(error.message));
}

async function dismissTour(page: Page) {
  const overlay = page.locator('[data-tour-overlay]');
  if (await overlay.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await expect(page.locator('#tour-card')).toHaveCount(0);
  }
}

test('public and app pages stay quiet, and the docks match their surfaces', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  watch(page, errors);
  const desktop = (page.viewportSize()?.width ?? 1280) >= 1024;

  for (const route of PUBLIC) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }

  await page.goto('/');
  const landing = await page.evaluate(() => {
    const nav = document.querySelector('[data-dock="responsive"] nav');
    if (!nav) return null;
    const box = nav.getBoundingClientRect();
    return {
      width: box.width,
      viewport: window.innerWidth,
      shadow: getComputedStyle(nav).boxShadow,
      leftGap: box.left,
    };
  });
  expect(landing).toBeTruthy();
  expect(landing!.width).toBeLessThan(landing!.viewport - 8);
  expect(landing!.shadow).not.toBe('none');
  expect(landing!.leftGap).toBeGreaterThan(4);
  const sections = await page.locator('#gap, #chapters, #model, #pricing, #faq').count();
  expect(sections).toBe(5);

  await page.goto('/login');
  await page.getByLabel('Email').fill(OWNER.email);
  await page.getByLabel('Password').fill(OWNER.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/app/);
  await dismissTour(page);

  for (const route of APP) {
    await page.goto(route);
    await dismissTour(page);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }

  if (!desktop) {
    await page.goto('/app');
    await dismissTour(page);
    const dock = await page.evaluate(() => {
      const wrap = document.querySelector('[data-dock="bottom"]');
      const nav = wrap?.querySelector('nav');
      const main = document.getElementById('app-main');
      if (!wrap || !nav || !main) return null;
      const box = wrap.getBoundingClientRect();
      const pad = Number.parseFloat(getComputedStyle(main).paddingBottom);
      return {
        left: box.left,
        width: box.width,
        bottom: box.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        shadow: getComputedStyle(nav).boxShadow,
        pad,
        dockHeight: box.height,
      };
    });
    expect(dock).toBeTruthy();
    expect(dock!.left).toBeLessThanOrEqual(1);
    expect(dock!.width).toBeGreaterThanOrEqual(dock!.viewportWidth - 1);
    expect(Math.abs(dock!.bottom - dock!.viewportHeight)).toBeLessThanOrEqual(1);
    expect(dock!.shadow).toBe('none');
    expect(dock!.pad).toBeGreaterThanOrEqual(dock!.dockHeight - 1);
    mkdirSync('/opt/cursor/artifacts/pre-submission', { recursive: true });
    await page.screenshot({ path: '/opt/cursor/artifacts/pre-submission/mobile-dock.png' });
  }

  expect(errors).toEqual([]);
});
