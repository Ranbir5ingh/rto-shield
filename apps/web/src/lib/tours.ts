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
    body: 'Scores run from 0 to 100. Higher scores are the orders worth confirming before they ship.',
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
    body: 'Approve a risky order and the confirmation goes out on WhatsApp. Skip the ones you will ship anyway.',
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
    body: 'Each high-risk order lists the reasons behind the score.',
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
    body: 'In this demo, messages stay on our test phone.',
  },
  {
    id: 'impact',
    route: '/app',
    title: 'Impact',
    body: 'Rupees still at risk, and how many orders still need a decision.',
  },
];
