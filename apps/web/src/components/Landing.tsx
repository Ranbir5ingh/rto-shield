'use client';

import Link from 'next/link';
import { DemoButton } from './DemoButton';
import { SiteHeader } from './SiteHeader';
import { useMarketingMotion } from './useMarketingMotion';

const steps = [
  {
    n: '01',
    title: 'Teach it this shop',
    body: 'Upload delivered and returned orders, or open the demo shop. TabPFN trains in context on that history. A cold shop uses a rules prior, then scikit-learn, and the screen names which one ran.',
  },
  {
    n: '02',
    title: 'Score before the parcel leaves',
    body: 'Each pending cash-on-delivery order gets 0–100, a Low, Medium, or High band, and a plain sentence. Address quality is a feature. The pincode is courier context, never a ban and never a model input.',
  },
  {
    n: '03',
    title: 'You send the message',
    body: 'Risky orders wait with a WhatsApp link, a prepaid nudge, and a draft in Hindi, Hinglish, or English. Confirmed teaches accepted. Cancelled teaches refused. Silence stays out of the next score.',
  },
];

const ticker = ['₹150 default return cost', 'Score 0–100', 'Low · Medium · High', 'Phone stays in the shop', '₹499 / month suggested', 'No card checkout'];

const faqs = [
  ['Does this charge ₹499?', 'The price is a suggestion for a hosted shop. This open-source build does not take a card.'],
  ['What leaves the shop?', 'Phone numbers are not sent to TabPFN, Gemma, SerpApi, or ElevenLabs. Addresses go to the scoring service, then to Gemma only if you configure it.'],
  ['What if I have no model key?', 'Scoring still runs. The dashboard says when the result is scikit-learn or a rules prior.'],
];

export function Landing() {
  useMarketingMotion(true);
  const loop = [...ticker, ...ticker];

  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-page px-5 pb-10 pt-16 sm:px-8 sm:pt-24">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Meesho · Instagram · WhatsApp · small Shopify</p>
          <h1 data-split className="mt-5 max-w-4xl font-medium text-display-1">
            Stop paying ₹150 for every order that comes back.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg">
            Score cash-on-delivery orders before they ship. Confirm the risky ones in Hindi, Hinglish, or English. Built for shops doing about 20 to 500 orders a day.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <DemoButton />
            <Link href="/signup" className="pill pill-light">
              Create your own login
            </Link>
          </div>
        </section>

        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {loop.map((item, index) => (
              <span key={`${item}-${index}`}>{item}</span>
            ))}
          </div>
        </div>

        <section id="method" className="mx-auto max-w-page px-5 py-16 sm:px-8 sm:py-24">
          <div className="panel p-6 sm:p-10" data-reveal>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Method</p>
            <h2 data-split className="mt-3 max-w-2xl font-medium text-display-2">
              From the sheet to the tape gun.
            </h2>
            <ol className="mt-10 divide-y divide-line">
              {steps.map((step) => (
                <li key={step.n} className="grid gap-3 py-6 sm:grid-cols-[4rem_1fr] sm:gap-8">
                  <span className="text-sm text-muted">{step.n}</span>
                  <div>
                    <h3 className="text-xl font-medium">{step.title}</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-page gap-4 px-5 sm:px-8 lg:grid-cols-2">
          <article className="panel p-6 sm:p-8" data-reveal>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Example day</p>
            <p className="mt-4 font-medium text-display-2">40 COD orders. 8 come back.</p>
            <p className="mt-4 text-sm leading-7 text-muted">
              At ₹150 reverse shipping, that is ₹1,200 before lunch. Stopping a handful covers a ₹499 month. Your dashboard uses the cost you set.
            </p>
          </article>
          <article className="panel p-6 sm:p-8" data-reveal>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">What you see</p>
            <div className="mt-6 rounded-3xl bg-paper p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">S1042 · ₹1,599 COD</p>
                <span className="rounded-full bg-ink px-3 py-1 text-xs font-medium text-white">High · 78</span>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-muted">
                <li>Cash on delivery from a first-time buyer</li>
                <li>Address is only a landmark, with no house number</li>
                <li>Placed late at night, when buyers confirm less often</li>
              </ul>
              <p className="mt-4 text-sm">Hinglish draft, ready for WhatsApp. Nothing leaves until you tap.</p>
            </div>
          </article>
        </section>

        <section id="privacy-note" className="mx-auto max-w-page px-5 py-16 sm:px-8 sm:py-24">
          <h2 className="font-medium text-display-2" data-split>
            Open models, on purpose.
          </h2>
          <ul className="mt-8 divide-y divide-black/10 border-y border-black/10">
            {[
              ['01', 'The phone stays in the shop', 'It is encrypted at rest and masked in lists. It is not sent to TabPFN, Gemma, SerpApi, or ElevenLabs.'],
              ['02', 'Gemma reads the address, not the buyer', 'Ollama on your machine is the privacy-max path. AI Studio is the hosted open-weight option. No key means local rules.'],
              ['03', 'A pincode is not a verdict', 'Courier notes can sit beside an order. They are not a feature in the score, and the product will not tell you to refuse a region.'],
            ].map(([n, title, body]) => (
              <li key={n} className="grid gap-2 py-6 sm:grid-cols-[4rem_16rem_1fr] sm:items-baseline" data-reveal>
                <span className="text-sm text-muted">{n}</span>
                <span className="font-medium">{title}</span>
                <span className="text-sm leading-7 text-muted">{body}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-page px-5 pb-8 sm:px-8">
          <div className="panel p-6 sm:p-10">
            <h2 className="font-medium text-display-2">Questions</h2>
            <div className="mt-6 divide-y divide-line">
              {faqs.map(([q, a]) => (
                <details key={q} className="group py-4">
                  <summary className="cursor-pointer list-none font-medium">{q}</summary>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-page px-5 py-16 sm:px-8">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-medium text-display-2">₹499 / month</h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-muted">
                The suggested price for a hosted shop: scoring, the confirmation queue, export, and delete. TabPFN, Gemma, ElevenLabs, and SerpApi keys are yours if you want them.
              </p>
            </div>
            <DemoButton />
          </div>
        </section>
      </main>
      <footer className="px-5 py-10 text-sm text-muted sm:px-8">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-4">
          <p>RTO Shield. MIT licensed.</p>
          <div className="flex gap-5">
            <Link href="/privacy">Privacy</Link>
            <Link href="/login">Log in</Link>
            <a href="#method">Back to top</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
