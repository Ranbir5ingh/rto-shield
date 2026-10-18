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
}

const queueList: TourStep = {
  id: 'queue-list',
  route: '/app/queue',
  title: 'The queue',
  body: 'Each row is one order. The number is the risk score. Red means look twice before you ship.',
  narrationId: 'queue-list',
};

const allOpen: TourStep = {
  id: 'all-open',
  route: '/app/queue',
  title: 'All open',
  body: 'Needs action is only High and Medium. All open is on now, so the quiet Low orders are in the list too.',
  narrationId: 'all-open',
  reveal: ['all-open'],
};

const whyFlagged = (mobile: boolean): TourStep => ({
  id: 'why-flagged',
  route: '/app/queue',
  title: 'Why it was flagged',
  body: mobile
    ? 'This order is open. The chips are facts from the order, not a paragraph the model wrote.'
    : 'These chips are facts from the order, not a paragraph the model wrote. The score sits beside them.',
  narrationId: mobile ? 'why-flagged-mobile' : 'why-flagged',
  reveal: mobile ? ['order'] : undefined,
});

const messageDraft = (mobile: boolean): TourStep => ({
  id: 'message-draft',
  route: '/app/queue',
  title: 'The message',
  body: 'This is the WhatsApp draft. Copy it, or send it from the green button once the number is saved.',
  narrationId: 'message-draft',
  reveal: mobile ? ['order'] : undefined,
});

const language: TourStep = {
  id: 'message-language',
  route: '/app/queue',
  title: 'Language',
  body: 'The language menu is open. Hinglish, Hindi, or English. The draft changes as soon as you pick one.',
  narrationId: 'message-language',
  reveal: ['language'],
};

const langOption = (id: string, title: string, body: string): TourStep => ({
  id,
  route: '/app/queue',
  title,
  body,
  narrationId: id,
  reveal: ['language'],
});

const bandLow: TourStep = {
  id: 'band-low',
  route: '/app/queue',
  title: 'Low risk',
  body: 'All open stays on, so this Low tab is here. It was hidden on Needs action.',
  narrationId: 'band-low',
  reveal: ['all-open'],
};

const conversation = (mobile: boolean): TourStep => ({
  id: 'conversation',
  route: '/app/queue',
  title: 'Did they reply',
  body: 'Queued, sent, delivered, read. The lines under that are the WhatsApp thread.',
  narrationId: 'conversation',
  reveal: mobile ? ['order'] : undefined,
});

const holdApprove = (mobile: boolean): TourStep => ({
  id: 'hold-approve',
  route: '/app/queue',
  title: 'The next action',
  body: 'The green button is the action this order needs. Hold, ask for a landmark, offer prepaid, or approve and send.',
  narrationId: 'hold-approve',
  reveal: mobile ? ['order'] : undefined,
});

function menuStep(id: string, title: string, body: string, narrationId: string, mobile: boolean): TourStep {
  return {
    id,
    route: '/app/queue',
    title,
    body,
    narrationId,
    reveal: mobile ? ['order', 'more'] : ['more'],
  };
}

const moreMenu = (mobile: boolean): TourStep => menuStep(
  'more-menu',
  'More actions',
  'More is open. Each button under it gets its own step. Nothing here is pressed until Call the buyer.',
  'more-menu',
  mobile,
);

const confirmed = (mobile: boolean) => menuStep(
  'menu-confirmed',
  'Confirmed',
  'Confirmed means the buyer said yes. The tour is only showing the button.',
  'menu-confirmed',
  mobile,
);

const cancelled = (mobile: boolean) => menuStep(
  'menu-cancelled',
  'Cancelled',
  'Cancelled means the buyer said no. The order is not cancelled by this step.',
  'menu-cancelled',
  mobile,
);

const skip = (mobile: boolean) => menuStep(
  'menu-skip',
  'Skip',
  'Skip is for no answer yet. The order stays open.',
  'menu-skip',
  mobile,
);

const prepaid = (mobile: boolean) => menuStep(
  'menu-prepaid',
  'Offer prepaid',
  'Offer prepaid makes a checkout link. Cash on delivery stays until they pay. This step does not send it.',
  'prepaid-offer',
  mobile,
);

const playHindi = (mobile: boolean) => menuStep(
  'menu-voice',
  'Play Hindi',
  'Play Hindi reads the draft aloud. This step only shows the button.',
  'menu-voice',
  mobile,
);

const pincode = (mobile: boolean) => menuStep(
  'menu-pin',
  'Pincode',
  'Pincode is courier context for this address. It is not a ban, and this step does not look it up.',
  'menu-pin',
  mobile,
);

const callBuyer = (mobile: boolean): TourStep => ({
  id: 'call-panel',
  route: '/app/queue',
  title: 'Call the buyer',
  body: 'Call the buyer opened this panel and closed the menu. The call stays in the browser. Allow the microphone. The phone number stays on the server.',
  narrationId: 'call-buyer',
  reveal: mobile ? ['order', 'call'] : ['call'],
});

const history: TourStep = {
  id: 'history-list',
  route: '/app/history',
  title: 'History',
  body: 'Delivered, RTO, and cancelled orders teach the model. A confirm you tap in the app is not a training label.',
  narrationId: 'history-list',
};

const impact: TourStep = {
  id: 'impact',
  route: '/app',
  title: 'Impact',
  body: 'Rupees that did not go back, plus prepaid checkouts, address fixes, and confirmations.',
  narrationId: 'impact',
};

const sellerStart: TourStep[] = [
  {
    id: 'shopify-connect',
    route: '/app/start',
    title: 'Connect Shopify',
    body: 'Enter the shop domain. Shopify sends the orders. You do not have to upload a sheet first.',
    narrationId: 'shopify-connect',
  },
  {
    id: 'import-alternatives',
    route: '/app/start',
    title: 'Other ways in',
    body: 'A CSV or the sample shop still works if Shopify is not ready.',
    narrationId: 'import-alternatives',
  },
];

const sellerWhatsapp: TourStep = {
  id: 'whatsapp-setup',
  route: '/app/start',
  title: 'WhatsApp',
  body: 'This is your Cloud API number. The setup guide walks through Meta.',
  narrationId: 'whatsapp-setup',
};

const demoStart: TourStep = {
  id: 'shopify-connected',
  route: '/app/start',
  title: 'Shopify, connected',
  body: 'Sellers connect a store in one click. This demo store is already connected.',
  narrationId: 'shopify-connected',
};

const demoWhatsapp: TourStep = {
  id: 'whatsapp-card',
  route: '/app/start',
  title: 'WhatsApp, ready',
  body: "Already configured with Meta's test number. A real shop pastes its own token.",
  narrationId: 'whatsapp-card',
};

function queueSteps(mobile: boolean): TourStep[] {
  return [
    queueList,
    allOpen,
    bandLow,
    language,
    langOption('lang-hinglish', 'Hinglish', 'Hinglish is the usual pick. The menu stays open so you can see the other two.'),
    langOption('lang-hindi', 'Hindi', 'Hindi is the next line in the same menu.'),
    langOption('lang-english', 'English', 'English is the last line. Picking one would change the draft. This step does not pick.'),
    whyFlagged(mobile),
    messageDraft(mobile),
    conversation(mobile),
    holdApprove(mobile),
    moreMenu(mobile),
    confirmed(mobile),
    cancelled(mobile),
    skip(mobile),
    prepaid(mobile),
    playHindi(mobile),
    pincode(mobile),
    callBuyer(mobile),
  ];
}

export function toursFor(kind: TourKind, surface: TourSurface): TourStep[] {
  const mobile = surface === 'mobile';
  if (kind === 'demo') return [demoStart, ...queueSteps(mobile), demoWhatsapp, history, impact];
  return [...sellerStart, ...queueSteps(mobile), sellerWhatsapp, history, impact];
}

/** Desktop lists. Tests and the shell both go through toursFor. */
export const sellerTour = toursFor('seller', 'desktop');
export const demoTour = toursFor('demo', 'desktop');
