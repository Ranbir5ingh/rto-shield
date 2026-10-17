export interface TourStep {
  id: string;
  route: string;
  title: string;
  body: string;
}

/** First login. Anchors stay on data-tour attributes, not on layout. */
export const sellerTour: TourStep[] = [
  {
    id: 'shopify-connect',
    route: '/app/start',
    title: 'Connect Shopify',
    body: 'One click. Enter your store domain and Shopify sends the orders.',
  },
  {
    id: 'import-alternatives',
    route: '/app/start',
    title: 'Other ways in',
    body: 'A CSV upload or the sample shop works if Shopify is not ready yet.',
  },
  {
    id: 'risk-queue',
    route: '/app/queue',
    title: 'The risk queue',
    body: 'Each order picks a next action from its reasons: landmark, prepaid, hold, or a WhatsApp confirm.',
  },
  {
    id: 'next-action',
    route: '/app/queue',
    title: 'The next action',
    body: 'A weak address asks for a landmark. High-risk cash on delivery offers prepaid. A repeat refuser waits for you.',
  },
  {
    id: 'whatsapp-setup',
    route: '/app/start',
    title: 'WhatsApp',
    body: 'This card is your Cloud API number. The setup guide walks through Meta.',
  },
  {
    id: 'approve-send',
    route: '/app/queue',
    title: 'Approve and send',
    body: 'The primary button on the card sends WhatsApp. More holds the rest: call, prepaid, or a decision.',
  },
];

/** Judge session. The shared shop is already connected. */
export const demoTour: TourStep[] = [
  {
    id: 'shopify-connected',
    route: '/app/start',
    title: 'Shopify, connected',
    body: 'Sellers connect their store in one click. This demo store is already connected.',
  },
  {
    id: 'risk-scores',
    route: '/app',
    title: 'Orders and scores',
    body: 'Imported orders land here with a risk score. Green is quiet. Red is worth a second look.',
  },
  {
    id: 'risk-reasons',
    route: '/app/queue',
    title: 'Why this one is risky',
    body: 'Each order shows the reasons and the action those reasons chose.',
  },
  {
    id: 'next-action',
    route: '/app/queue',
    title: 'Reason, then action',
    body: 'Address gaps ask for a landmark. Risky cash on delivery gets a prepaid link. Quiet orders confirm themselves.',
  },
  {
    id: 'whatsapp-card',
    route: '/app/start',
    title: 'WhatsApp, ready',
    body: "Already configured with Meta's test number.",
  },
  {
    id: 'approve-send',
    route: '/app/queue',
    title: 'Approve and send',
    body: 'In this demo, messages stay on our test phone. Call the buyer opens in the browser unless the number is allowlisted.',
  },
  {
    id: 'impact',
    route: '/app',
    title: 'Impact',
    body: 'Rupees kept from going back, plus prepaid conversions, address fixes, and confirmations.',
  },
];
