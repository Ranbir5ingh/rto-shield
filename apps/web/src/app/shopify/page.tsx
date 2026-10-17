import type { Metadata } from 'next';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'RTO Shield for Shopify',
  description: 'Open the RTO Shield dashboard from your Shopify admin.',
};

export default async function ShopifyAppPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string; host?: string }>;
}) {
  const params = await searchParams;
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || '';
  const shop = params.shop || '';
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-6 py-16">
      {apiKey ? <meta name="shopify-api-key" content={apiKey} /> : null}
      {apiKey ? <Script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" strategy="afterInteractive" /> : null}
      <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-inksoft">Shopify</p>
      <h1 className="mt-3 font-display text-4xl font-extrabold">RTO Shield</h1>
      <p className="mt-4 text-sm leading-7 text-ink/75">
        Scores, the confirmation queue, and WhatsApp live on the dashboard. This page is the embedded landing Shopify
        opens inside admin{shop ? ` for ${shop}` : ''}.
      </p>
      <a href="/app" className="btn-go mt-8 inline-flex w-fit">
        Open the dashboard
      </a>
    </main>
  );
}
