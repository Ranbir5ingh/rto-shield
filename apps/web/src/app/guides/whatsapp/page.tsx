import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { WhatsAppGuideBody } from '@/components/WhatsAppGuide';
import { WHATSAPP_CALLBACK_URL, WHATSAPP_GUIDE_STEPS } from '@/lib/whatsapp-guide';

const title = 'Connect WhatsApp to RTO Shield';
const description =
  'A seller guide for the WhatsApp Cloud API: create a Meta app, add a number, make a permanent token, set the webhook, and get the order template approved.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: 'https://www.rtoshield.tech/guides/whatsapp' },
  openGraph: {
    title,
    description,
    url: 'https://www.rtoshield.tech/guides/whatsapp',
    type: 'article',
  },
};

export default function WhatsAppGuidePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: title,
    description,
    step: WHATSAPP_GUIDE_STEPS.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.title,
      text: step.body,
      url: step.links[0]?.href,
    })),
  };
  return (
    <div>
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-5 pb-16 pt-28 sm:px-8">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">Guide</p>
        <h1 className="mt-3 font-display text-display-2">Connect WhatsApp without a developer on the call</h1>
        <p className="mt-4 text-base leading-7 text-ink/80">
          RTO Shield sends order confirmations through your own WhatsApp Cloud API number. Work through these steps once.
          After you log in, Settings ticks each one off as you save it.
        </p>
        <WhatsAppGuideBody mode="public" callbackUrl={WHATSAPP_CALLBACK_URL} />
        <p className="mt-10 text-sm leading-7 text-ink/80">
          The verify token is shown only after you log in, in Settings, inside Setup guide. This page never prints it.
          <Link href="/login" className="underline">Log in</Link>, open Settings, and choose Test connection once the fields are saved.
        </p>
      </article>
    </div>
  );
}
