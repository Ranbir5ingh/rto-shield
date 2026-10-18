import type { TourReveal, TourStep } from '@/lib/tours';

const GAP_MS = 450;

export interface RevealMemory {
  at: Partial<Record<string, number>>;
  openedAll: boolean;
  openedOrder: boolean;
}

export function freshRevealMemory(): RevealMemory {
  return { at: {}, openedAll: false, openedOrder: false };
}

function isVisible(node: HTMLElement) {
  const rect = node.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  const style = getComputedStyle(node);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function firstVisible(selector: string) {
  const nodes = document.querySelectorAll<HTMLElement>(selector);
  for (const node of nodes) {
    if (isVisible(node)) return node;
  }
  return null;
}

function cooled(memory: RevealMemory, key: string) {
  return performance.now() - (memory.at[key] || 0) > GAP_MS;
}

function tap(memory: RevealMemory, key: string, node: HTMLElement) {
  if (!cooled(memory, key)) return false;
  memory.at[key] = performance.now();
  node.click();
  return true;
}

/**
 * Open what this step explains, and close what an earlier step opened.
 * A call step opens More only long enough to press Call the buyer, then leaves
 * the panel up and the menu closed.
 */
export function revealStep(step: TourStep, mobile: boolean, memory: RevealMemory) {
  const needs = new Set<TourReveal>(step.reveal || []);
  const callPanel = firstVisible('[data-tour="call-panel"]');
  const more = firstVisible('[data-tour-open="more"]');
  const language = firstVisible('[data-tour-open="language"]');
  const keepMore = needs.has('more') || (needs.has('call') && !callPanel);

  if (!needs.has('language') && language?.getAttribute('aria-expanded') === 'true') {
    tap(memory, 'language-close', language);
  }

  if (!needs.has('call') && callPanel) {
    const closeCall = firstVisible('[data-tour-close="call"]');
    if (closeCall) tap(memory, 'call-close', closeCall);
  }

  if (!keepMore && more?.getAttribute('aria-expanded') === 'true') {
    tap(memory, 'more-close', more);
  }

  if (!needs.has('all-open') && memory.openedAll) {
    const needsAction = firstVisible('[data-tour-open="needs-action"]');
    if (needsAction && needsAction.getAttribute('aria-selected') !== 'true') {
      if (tap(memory, 'needs-action', needsAction)) memory.openedAll = false;
    } else if (needsAction?.getAttribute('aria-selected') === 'true') {
      memory.openedAll = false;
    }
  }

  if (needs.has('all-open')) {
    const all = firstVisible('[data-tour-open="all-open"]');
    if (all && all.getAttribute('aria-selected') !== 'true') {
      if (tap(memory, 'all-open', all)) memory.openedAll = true;
    }
  }

  if (needs.has('language') && language && language.getAttribute('aria-expanded') !== 'true') {
    tap(memory, 'language', language);
  }

  if (needs.has('order') && mobile && !window.location.pathname.startsWith('/app/orders/')) {
    const row = firstVisible('[data-tour-row="1"]');
    if (row && tap(memory, 'order', row)) memory.openedOrder = true;
  }

  if (keepMore && more && more.getAttribute('aria-expanded') !== 'true') {
    tap(memory, 'more', more);
  }

  if (needs.has('call') && !callPanel) {
    const item = firstVisible('[data-tour="menu-call"]');
    if (item) tap(memory, 'call', item);
  }
}

export function restoreTourUi(memory: RevealMemory) {
  const language = firstVisible('[data-tour-open="language"]');
  if (language?.getAttribute('aria-expanded') === 'true') language.click();
  const closeCall = firstVisible('[data-tour-close="call"]');
  if (closeCall) closeCall.click();
  const more = firstVisible('[data-tour-open="more"]');
  if (more?.getAttribute('aria-expanded') === 'true') more.click();
  if (memory.openedAll) {
    const needsAction = firstVisible('[data-tour-open="needs-action"]');
    if (needsAction && needsAction.getAttribute('aria-selected') !== 'true') needsAction.click();
  }
  memory.openedAll = false;
}

export function stepOnPage(step: TourStep, pathname: string, mobile: boolean) {
  if (mobile && step.reveal?.includes('order')) return pathname.startsWith('/app/orders/');
  return pathname === step.route;
}
