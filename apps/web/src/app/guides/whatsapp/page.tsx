import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { WhatsAppGuideBody } from '@/components/WhatsAppGuide';
import { WHATSAPP_CALLBACK_URL, WHATSAPP_GUIDE_STEPS } from '@/lib/whatsapp-guide';

const title = 'Optional: use your own WhatsApp number';
const description =
  'RTO Shield sends from its own number. This guide is the optional setup for a shop that wants buyers to see its number.';

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
      <article className="mx-auto max-w-3xl px-5 pb-28 pt-16 sm:px-8 md:pb-16 md:pt-32">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">Guide</p>
        <h1 className="mt-3 font-display text-[clamp(1.8rem,6vw,3rem)] font-black uppercase leading-[0.95]">Your own number is optional</h1>
        <p className="mt-4 text-base leading-7 text-ink/80">
          Confirmations already go out from RTO Shield&apos;s number. Skip this page unless buyers should see the shop&apos;s number.
          After you log in, Settings ticks each step off as you save it.
        </p>
        <WhatsAppGuideBody mode="public" callbackUrl={WHATSAPP_CALLBACK_URL} />
        <p className="mt-10 text-sm leading-7 text-ink/80">
          The verify token stays hidden until you log in and confirm your password in Settings. This page never prints it.
          <Link href="/login" className="underline">Log in</Link>, open Settings, and choose Test connection once the fields are saved.
        </p>
      </article>
    </div>
  );
}
