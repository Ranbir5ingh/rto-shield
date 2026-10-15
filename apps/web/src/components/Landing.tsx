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
        <section className="bg-white">
          <div className="relative mx-auto flex min-h-[100svh] max-w-page flex-col justify-center px-5 pb-20 pt-28 sm:px-8">
            <div className="pointer-events-none absolute -left-16 top-24 h-64 w-64 rounded-full bg-[#d7dde1] blur-3xl" aria-hidden="true" />
            <p data-rise className="text-xs uppercase tracking-[0.22em] text-muted">
              Meesho · Instagram · WhatsApp · small Shopify
            </p>
            <h1 data-split data-hero className="mt-6 max-w-5xl font-medium text-display-1">
              Stop paying ₹150 for every order that comes back.
            </h1>
            <p data-rise className="mt-8 max-w-xl text-base leading-7 text-muted sm:text-lg">
              Score cash-on-delivery orders before they ship. Confirm the risky ones in Hindi, Hinglish, or English. Built for shops doing about 20 to 500 orders a day.
            </p>
            <div data-rise className="mt-10 flex flex-wrap items-center gap-3">
              <DemoButton />
              <Link href="/signup" data-magnetic className="pill pill-light">
                Create your own login
              </Link>
            </div>
          </div>
        </section>

        <div className="marquee border-white bg-white" aria-hidden="true">
          <div className="marquee-track">
            {loop.map((item, index) => (
              <span key={`${item}-${index}`}>{item}</span>
            ))}
          </div>
        </div>

        <section className="mx-auto max-w-page overflow-hidden px-5 py-16 sm:px-8 sm:py-24">
          <div className="mb-8 flex items-end justify-between gap-6" data-reveal>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted">The desk</p>
              <h2 data-split className="mt-3 max-w-xl font-medium text-display-2">
                A morning of scores, not a spreadsheet.
              </h2>
            </div>
            <p className="hidden max-w-xs text-sm leading-6 text-muted md:block">
              RTO rate, rupees still at risk, and the queue of orders worth a message before the tape gun.
            </p>
          </div>
          <div className="relative">
            <img
              src="/visuals/dashboard-stage.jpg"
              alt=""
              width={1600}
              height={900}
              className="pointer-events-none absolute -right-4 top-10 hidden w-[46%] rounded-[2rem] object-cover opacity-80 shadow-card lg:block"
            />
            <div data-clip className="panel relative w-full overflow-hidden p-3 shadow-card sm:p-5 lg:w-[86%]">
              <div data-clip-media data-parallax className="rounded-[1.4rem] bg-[#f3f5f6] p-3 sm:p-5">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    ['RTO rate', '18%', '68 returned'],
                    ['₹ saved', '12,400', 'estimate'],
                    ['High pending', '7', 'still in the queue'],
                    ['On file', '384', 'this shop only'],
                  ].map(([label, value, hint]) => (
                    <div key={label} className="rounded-2xl bg-white p-4">
                      <p className="text-[0.65rem] uppercase tracking-[0.16em] text-muted">{label}</p>
                      <p className="mt-2 text-3xl font-medium tabular-nums tracking-tight">{value}</p>
                      <p className="mt-1 text-xs text-muted">{hint}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-5">
                  <div className="rounded-2xl bg-white p-4 lg:col-span-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">RTO rate by week</p>
                    <svg viewBox="0 0 640 160" className="mt-3 h-32 w-full" role="img" aria-label="Weekly RTO rate falling from 24 to 16">
                      <path d="M20 40 L120 70 L220 55 L320 90 L420 74 L620 110" fill="none" stroke="#111" strokeWidth="2" className="chart-line" />
                    </svg>
                  </div>
                  <div className="rounded-2xl bg-white p-4 lg:col-span-2">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted">Pending risk</p>
                    <ul className="mt-4 space-y-3 text-sm">
                      {[
                        ['Low', '64%'],
                        ['Medium', '22%'],
                        ['High', '14%'],
                      ].map(([label, width]) => (
                        <li key={label}>
                          <div className="mb-1 flex justify-between">
                            <span>{label}</span>
                            <span className="tabular-nums text-muted">{width}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-line">
                            <div className="bar-fill h-1.5 rounded-full bg-ink" style={{ width }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              <div data-float className="absolute bottom-8 right-6 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white sm:right-10">
                High · 78
              </div>
            </div>
          </div>
        </section>

        <section id="method" data-story className="bg-paper">
          <div className="mx-auto grid max-w-page items-center gap-10 px-5 py-16 sm:px-8 lg:min-h-screen lg:grid-cols-[0.9fr_1.1fr] lg:py-0">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted">Method</p>
              <h2 data-split className="mt-3 max-w-md font-medium text-display-2">
                From the sheet to the tape gun.
              </h2>
              <ol className="mt-10 space-y-8">
                {steps.map((step) => (
                  <li key={step.n} data-step>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted">{step.n}</p>
                    <h3 className="mt-2 text-2xl font-medium tracking-tight">{step.title}</h3>
                    <p className="mt-2 max-w-md text-sm leading-7 text-muted">{step.body}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="relative grid gap-4 lg:min-h-[34rem]">
              <article data-frame className="panel flex min-h-[22rem] flex-col justify-between p-6 shadow-card sm:p-8 lg:absolute lg:inset-0">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">01 · History</p>
                <div>
                  <p className="font-medium text-display-2">380 orders taught.</p>
                  <p className="mt-3 max-w-sm text-sm leading-7 text-muted">
                    Delivered and returned rows stay in this shop. The next score names TabPFN, scikit-learn, or the rules prior.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-2xl bg-paper p-3">
                    <p className="text-xs text-muted">Delivered</p>
                    <p className="mt-1 text-xl font-medium tabular-nums">312</p>
                  </div>
                  <div className="rounded-2xl bg-paper p-3">
                    <p className="text-xs text-muted">Returned</p>
                    <p className="mt-1 text-xl font-medium tabular-nums">68</p>
                  </div>
                  <div className="rounded-2xl bg-paper p-3">
                    <p className="text-xs text-muted">Rate</p>
                    <p className="mt-1 text-xl font-medium tabular-nums">18%</p>
                  </div>
                </div>
              </article>
              <article data-frame className="panel min-h-[22rem] overflow-hidden shadow-card lg:absolute lg:inset-0">
                <img
                  src="/visuals/order-card.jpg"
                  alt="Order card scored High 78, with the reasons written out"
                  width={1200}
                  height={900}
                  className="h-full w-full object-cover"
                />
              </article>
              <article data-frame className="panel flex min-h-[22rem] flex-col justify-between p-6 shadow-card sm:p-8 lg:absolute lg:inset-0">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">03 · You send it</p>
                <p className="font-hindi text-lg leading-8">
                  Namaste, aapka order confirm karna tha — ₹1,599 cash on delivery. Ghar pe honge kya?
                </p>
                <p className="text-sm text-muted">WhatsApp opens with the draft. Nothing leaves until you tap.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-page gap-4 px-5 py-8 sm:px-8 lg:grid-cols-2 lg:py-16">
          <article className="panel overflow-hidden shadow-card" data-reveal>
            <div className="p-6 sm:p-8">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Example day</p>
              <p className="mt-4 font-medium text-display-2">40 COD orders. 8 come back.</p>
              <p className="mt-4 max-w-md text-sm leading-7 text-muted">
                At ₹150 reverse shipping, that is ₹1,200 before lunch. Stopping a handful covers a ₹499 month. Your dashboard uses the cost you set.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-px bg-line">
              {[
                ['40', 'Packed'],
                ['8', 'Returned'],
                ['₹1,200', 'Lost'],
              ].map(([value, label]) => (
                <div key={label} className="bg-white px-4 py-5">
                  <p className="text-2xl font-medium tabular-nums">{value}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
                </div>
              ))}
            </div>
          </article>
          <article className="panel overflow-hidden shadow-card" data-clip>
            <img
              data-clip-media
              src="/visuals/order-card.jpg"
              alt="Close view of a high-risk cash-on-delivery order"
              width={1200}
              height={900}
              className="aspect-[4/3] w-full object-cover"
            />
          </article>
        </section>

        <section id="privacy-note" className="mx-auto max-w-page px-5 py-16 sm:px-8 sm:py-24">
          <h2 className="max-w-xl font-medium text-display-2" data-split>
            Open models, on purpose.
          </h2>
          <ul className="mt-10 divide-y divide-black/10 border-y border-black/10">
            {[
              ['01', 'The phone stays in the shop', 'It is encrypted at rest and masked in lists. It is not sent to TabPFN, Gemma, SerpApi, or ElevenLabs.'],
              ['02', 'Gemma reads the address, not the buyer', 'Ollama on your machine is the privacy-max path. AI Studio is the hosted open-weight option. No key means local rules.'],
              ['03', 'A pincode is not a verdict', 'Courier notes can sit beside an order. They are not a feature in the score, and the product will not tell you to refuse a region.'],
            ].map(([n, title, body]) => (
              <li key={n} className="row-link grid gap-2 py-7 sm:grid-cols-[4rem_16rem_1fr] sm:items-baseline" data-reveal>
                <span className="text-sm text-muted">{n}</span>
                <span className="font-medium">{title}</span>
                <span className="text-sm leading-7 text-muted">{body}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-page px-5 pb-8 sm:px-8">
          <div className="panel p-6 sm:p-10" data-reveal>
            <h2 className="font-medium text-display-2">Questions</h2>
            <div className="mt-6 divide-y divide-line">
              {faqs.map(([q, a]) => (
                <details key={q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {q}
                    <span className="text-muted transition group-open:rotate-45" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-page px-5 py-20 sm:px-8">
          <div className="flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-end">
            <div>
              <h2 data-split className="font-medium text-display-1">
                ₹499 / month
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-muted">
                The suggested price for a hosted shop: scoring, the confirmation queue, export, and delete. TabPFN, Gemma, ElevenLabs, and SerpApi keys are yours if you want them.
              </p>
            </div>
            <DemoButton />
          </div>
        </section>
      </main>
      <footer className="px-5 py-12 text-sm text-muted sm:px-8">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-4 border-t border-black/10 pt-8">
          <p>RTO Shield. MIT licensed.</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <Link href="/login" className="hover:text-ink">
              Log in
            </Link>
            <a href="#method" className="hover:text-ink">
              Back to top
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
