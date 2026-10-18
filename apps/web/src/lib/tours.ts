import { tourText, type TourLang } from '@/lib/tour-copy';

export type TourReveal = 'order' | 'more' | 'language' | 'call' | 'all-open';
export type TourKind = 'seller' | 'demo';
export type TourSurface = 'desktop' | 'mobile';

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

const queueList = bare({ id: 'queue-list', route: '/app/queue' });

const allOpen = bare({ id: 'all-open', route: '/app/queue', reveal: ['all-open'] });

const whyFlagged = (mobile: boolean): TourStep => bare({
  id: 'why-flagged',
  route: '/app/queue',
  narrationId: mobile ? 'why-flagged-mobile' : 'why-flagged',
  reveal: mobile ? ['order'] : undefined,
});

const messageDraft = (mobile: boolean): TourStep => bare({
  id: 'message-draft',
  route: '/app/queue',
  reveal: mobile ? ['order'] : undefined,
});

const copyDraft = (mobile: boolean): TourStep => bare({
  id: 'copy-draft',
  route: '/app/queue',
  reveal: mobile ? ['order'] : undefined,
});

const sendWhatsapp = (mobile: boolean): TourStep => bare({
  id: 'send-whatsapp',
  route: '/app/queue',
  reveal: mobile ? ['order'] : undefined,
});

const language = bare({ id: 'message-language', route: '/app/queue', reveal: ['language'] });

const langOption = (id: string): TourStep => bare({ id, route: '/app/queue', reveal: ['language'] });

const bandLow = bare({ id: 'band-low', route: '/app/queue', reveal: ['all-open'] });

const conversation = (mobile: boolean): TourStep => bare({
  id: 'conversation',
  route: '/app/queue',
  reveal: mobile ? ['order'] : undefined,
});

const holdApprove = (mobile: boolean): TourStep => bare({
  id: 'hold-approve',
  route: '/app/queue',
  reveal: mobile ? ['order'] : undefined,
  titleFromAnchor: true,
});

function menuStep(id: string, narrationId: string, mobile: boolean): TourStep {
  return bare({
    id,
    route: '/app/queue',
    narrationId,
    reveal: mobile ? ['order', 'more'] : ['more'],
  });
}

const callBuyer = (mobile: boolean): TourStep => bare({
  id: 'call-panel',
  route: '/app/queue',
  narrationId: 'call-buyer',
  reveal: mobile ? ['order', 'call'] : ['call'],
});

const history = bare({ id: 'history-list', route: '/app/history' });
const impact = bare({ id: 'impact', route: '/app' });

const sellerStart: TourStep[] = [
  bare({ id: 'shopify-connect', route: '/app/start' }),
  bare({ id: 'import-alternatives', route: '/app/start' }),
];

const sellerWhatsapp = bare({ id: 'whatsapp-setup', route: '/app/start' });
const demoStart = bare({ id: 'shopify-connected', route: '/app/start' });
const demoWhatsapp = bare({ id: 'whatsapp-card', route: '/app/start' });

function queueSteps(mobile: boolean): TourStep[] {
  return [
    queueList,
    allOpen,
    bandLow,
    language,
    langOption('lang-hinglish'),
    langOption('lang-hindi'),
    langOption('lang-english'),
    whyFlagged(mobile),
    messageDraft(mobile),
    copyDraft(mobile),
    sendWhatsapp(mobile),
    conversation(mobile),
    holdApprove(mobile),
    menuStep('more-menu', 'more-menu', mobile),
    menuStep('menu-confirmed', 'menu-confirmed', mobile),
    menuStep('menu-cancelled', 'menu-cancelled', mobile),
    menuStep('menu-skip', 'menu-skip', mobile),
    menuStep('menu-prepaid', 'prepaid-offer', mobile),
    menuStep('menu-voice', 'menu-voice', mobile),
    menuStep('menu-pin', 'menu-pin', mobile),
    callBuyer(mobile),
  ];
}

export function toursFor(kind: TourKind, surface: TourSurface, lang: TourLang = 'english'): TourStep[] {
  const mobile = surface === 'mobile';
  const steps = kind === 'demo'
    ? [demoStart, ...queueSteps(mobile), demoWhatsapp, history, impact]
    : [...sellerStart, ...queueSteps(mobile), sellerWhatsapp, history, impact];
  return steps.map((step) => {
    const text = tourText(step.id, lang, mobile);
    return text ? { ...step, title: text.title, body: text.body } : step;
  });
}

/** Desktop lists. Tests and the shell both go through toursFor. */
export const sellerTour = toursFor('seller', 'desktop');
export const demoTour = toursFor('demo', 'desktop');
