import { tourText, type TourLang } from '@/lib/tour-copy';

export type TourReveal = 'order' | 'more' | 'language' | 'call' | 'all-open';
export type TourKind = 'seller' | 'demo';
export type TourSurface = 'desktop' | 'mobile';

/**
 * Try the demo signs into the demo owner, whose stored role is owner.
 * A locked demo session, a disposable demo shop, or that official account
 * all use the demo tour.
 */
export function isDemoSession(user: { role?: string; isDemo?: boolean; officialDemo?: boolean } | null | undefined) {
  return Boolean(user && (user.role === 'demo' || user.isDemo || user.officialDemo));
}

export interface TourStep {
  /** DOM anchor. The first visible match is spotlighted. */
  id: string;
  route: string;
  title: string;
  /** Shown on the card. This is also the caption while the voice plays. */
  body: string;
  /** Server narration key. Spoken text lives on the API so the browser never sends a script. */
  narrationId: string;
  /**
   * Open these before the spotlight. The tour closes anything it opened
   * when the step changes, and again on skip or Escape.
   */
  reveal?: TourReveal[];
  /** Replace the card heading with the anchor's visible text once it is on screen. */
  titleFromAnchor?: boolean;
}

interface BareStep {
  id: string;
  route: string;
  narrationId?: string;
  reveal?: TourReveal[];
  titleFromAnchor?: boolean;
}

function bare(step: BareStep): TourStep {
  return {
    id: step.id,
    route: step.route,
    title: step.id,
    body: '',
    narrationId: step.narrationId || step.id,
    reveal: step.reveal,
    titleFromAnchor: step.titleFromAnchor,
  };
}

const impact = bare({ id: 'impact', route: '/app' });
const autopilot = bare({ id: 'autopilot', route: '/app/settings' });
const exceptions = bare({ id: 'exceptions', route: '/app/queue' });
const exceptionOrder = bare({ id: 'exception-order', route: '/app/queue' });
const exceptionAction = bare({ id: 'exception-action', route: '/app/queue' });
const callBuyer = bare({
  id: 'call-buyer',
  route: '/app/queue',
  narrationId: 'call-buyer',
  reveal: ['call'],
  titleFromAnchor: true,
});
const activity = bare({ id: 'activity', route: '/app/history' });
const resultsHome = bare({ id: 'results-home', route: '/app' });
const shopifyConnect = bare({ id: 'shopify-connect', route: '/app/start' });
const shopifyConnected = bare({ id: 'shopify-connected', route: '/app/start' });
const sellerWhatsapp = bare({ id: 'whatsapp-setup', route: '/app/start' });
const demoWhatsapp = bare({ id: 'whatsapp-card', route: '/app/start' });

export function toursFor(
  kind: TourKind,
  surface: TourSurface,
  lang: TourLang = 'english',
  options?: { shopifyConnected?: boolean },
): TourStep[] {
  const shop = kind === 'demo' || options?.shopifyConnected ? shopifyConnected : shopifyConnect;
  const whatsapp = kind === 'demo' ? demoWhatsapp : sellerWhatsapp;
  const steps = [impact, autopilot, exceptions, exceptionOrder, exceptionAction, callBuyer, activity, shop, whatsapp, resultsHome];
  return steps.map((step) => {
    const text = tourText(step.id, lang, surface === 'mobile');
    return text ? { ...step, title: text.title, body: text.body } : step;
  });
}

/** Desktop lists. Tests and the shell both go through toursFor. */
export const sellerTour = toursFor('seller', 'desktop');
export const demoTour = toursFor('demo', 'desktop');
