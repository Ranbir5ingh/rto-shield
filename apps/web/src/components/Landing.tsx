'use client';

import Link from 'next/link';
import { Shield, MessageCircle, ScanLine, Lock } from 'lucide-react';
import { DemoButton } from './DemoButton';
import { SiteHeader } from './SiteHeader';
import { useMarketingMotion } from './useMarketingMotion';

const ticker = ['₹150 default return cost', 'Score 0–100', 'Low · Medium · High', 'Phone stays in the shop', '₹499 / month', 'No card checkout'];

const faqs = [
  ['Does this charge ₹499?', 'The price is a suggestion for a hosted shop. This open-source build does not take a card.'],
  ['What leaves the shop?', 'Phone numbers are not sent to TabPFN, Gemma, SerpApi, or ElevenLabs. Addresses go to the scoring service, then to Gemma only if you configure it.'],
  ['What if I have no model key?', 'Scoring still runs. The dashboard says when the result is scikit-learn or a rules prior.'],
];

export function Landing() {
  useMarketingMotion(true);
  const loop = [...ticker, ...ticker];

  return (
    <div className="min-h-screen bg-canvas">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden">
          <div className="ledger-rules pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="pointer-events-none absolute left-1/2 top-0 h-[28rem] w-[40rem] -translate-x-1/2 rounded-full bg-accent/[0.07] blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-page items-end gap-12 px-5 pb-16 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:pt-28">
            <div>
              <p data-hero-item className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
                Cash on delivery · before the tape gun
              </p>
              <h1 data-hero-item className="mt-4 max-w-xl font-display font-medium text-display-1">
                Stop paying ₹150 for orders that come back.
              </h1>
              <p data-hero-item className="mt-6 max-w-md text-base leading-7 text-muted">
                Score every pending COD order from 0 to 100. Confirm the risky ones in Hindi, Hinglish, or English. Built for shops doing about 20 to 500 orders a day.
              </p>
              <div data-hero-item className="mt-8 flex flex-wrap items-center gap-3">
                <DemoButton />
                <Link href="/signup" className="btn btn-ghost">
                  Create a login
                </Link>
              </div>
            </div>
            <ProductFrame />
          </div>
        </section>

        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {loop.map((item, index) => (
              <span key={`${item}-${index}`}>{item}</span>
            ))}
          </div>
        </div>

        <section id="product" className="mx-auto max-w-page px-5 py-20 sm:px-8">
          <div className="mb-8 flex items-end justify-between gap-6" data-reveal>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Product</p>
              <h2 className="mt-2 max-w-lg font-display font-medium text-display-2">A desk that shows the risk before the parcel leaves.</h2>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-6">
            <article className="card spotlight p-5 md:col-span-4" data-reveal>
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Live score</p>
                <ScanLine size={16} className="text-accent" />
              </div>
              <p className="mt-6 font-mono text-6xl tracking-tight tabular-nums">
                <span className="stamp text-accent">78</span>
              </p>
              <p className="mt-2 text-sm text-muted">S1042 · ₹1,599 COD · High</p>
              <ul className="mt-6 space-y-2 text-sm text-muted">
                <li>First-time buyer, cash on delivery</li>
                <li>Address is a landmark, with no house number</li>
                <li>Placed late, when buyers confirm less often</li>
              </ul>
            </article>
            <article className="card spotlight flex flex-col justify-between p-5 md:col-span-2" data-reveal>
              <MessageCircle size={16} className="text-accent" />
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">You send it</p>
                <p className="mt-3 font-hindi text-sm leading-6">Namaste, aapka order confirm karna tha — ₹1,599 cash on delivery. Ghar pe honge kya?</p>
              </div>
            </article>
            <article className="card spotlight p-5 md:col-span-2" data-reveal>
              <Shield size={16} className="text-low" />
              <h3 className="mt-6 text-lg font-medium">Three bands, written out</h3>
              <p className="mt-2 text-sm leading-6 text-muted">Low can ship. Medium and High wait in the queue. Colour is never the only signal.</p>
            </article>
            <article className="card spotlight p-5 md:col-span-2" data-reveal>
              <Lock size={16} className="text-accent" />
              <h3 className="mt-6 text-lg font-medium">The phone stays</h3>
              <p className="mt-2 text-sm leading-6 text-muted">Encrypted at rest, masked in lists, never sent to TabPFN, Gemma, SerpApi, or ElevenLabs.</p>
            </article>
            <article className="card spotlight p-5 md:col-span-2" data-reveal>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Fairness</p>
              <h3 className="mt-6 text-lg font-medium">A pincode is not a verdict</h3>
              <p className="mt-2 text-sm leading-6 text-muted">Courier notes can sit beside an order. They are not a model feature, and the product will not tell you to refuse a region.</p>
            </article>
          </div>
        </section>

        <section id="method" className="border-y border-line">
          <div className="mx-auto grid max-w-page gap-10 px-5 py-20 sm:px-8 lg:grid-cols-3">
            {[
              ['01', 'Teach it this shop', 'Upload delivered and returned orders, or open the demo shop. TabPFN trains in context on that history. A cold shop uses a rules prior, then scikit-learn, and the screen names which one ran.'],
              ['02', 'Score before it ships', 'Each pending order gets 0–100, a Low, Medium, or High band, and a plain sentence. Address quality is a feature. The pincode is courier context.'],
              ['03', 'You send the message', 'Risky orders wait with a WhatsApp link and a draft in Hindi, Hinglish, or English. Confirmed teaches accepted. Cancelled teaches refused. Silence stays out of the next score.'],
            ].map(([n, title, body]) => (
              <article key={n} data-reveal>
                <p className="font-mono text-xs text-accent">{n}</p>
                <h3 className="mt-3 text-xl font-medium tracking-tight">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-page px-5 py-20 sm:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Example day</p>
          <h2 className="mt-2 max-w-xl font-display font-medium text-display-2">40 COD orders. 8 come back.</h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ['40', '', 'Packed'],
              ['8', '', 'Returned'],
              ['1200', '₹', 'Lost at ₹150 each'],
            ].map(([value, prefix, label]) => (
              <article key={label} className="card p-5" data-reveal>
                <p className="font-mono text-4xl tracking-tight" data-tick={value} data-prefix={prefix}>
                  {prefix}
                  {Number(value).toLocaleString('en-IN')}
                </p>
                <p className="mt-2 text-sm text-muted">{label}</p>
              </article>
            ))}
          </div>
          <p className="mt-6 max-w-xl text-sm leading-7 text-muted">
            At ₹150 reverse shipping, that is ₹1,200 before lunch. Stopping a handful covers a ₹499 month. Your dashboard uses the cost you set.
          </p>
        </section>

        <section id="pricing" className="mx-auto max-w-page px-5 pb-20 sm:px-8">
          <div className="card flex flex-col items-start justify-between gap-8 p-6 sm:flex-row sm:items-end sm:p-10" data-reveal>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Suggested price</p>
              <h2 className="mt-2 font-display font-medium text-display-1">₹499<span className="text-2xl text-muted">/mo</span></h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-muted">
                Scoring, the confirmation queue, export, and delete. TabPFN, Gemma, ElevenLabs, and SerpApi keys are yours if you want them. This build does not take a card.
              </p>
            </div>
            <DemoButton label="Try the demo shop" />
          </div>
        </section>

        <section className="mx-auto max-w-page px-5 pb-20 sm:px-8">
          <h2 className="font-display font-medium text-display-2">Questions</h2>
          <div className="mt-6 divide-y divide-line border-y border-line">
            {faqs.map(([q, a]) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {q}
                  <span className="text-muted transition group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t border-line px-5 py-8 text-sm text-muted sm:px-8">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-4">
          <p>RTO Shield. MIT licensed.</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/login" className="hover:text-ink">Log in</Link>
            <a href="#product" className="hover:text-ink">Back to top</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ProductFrame() {
  return (
    <div data-hero-item className="card relative overflow-hidden p-4 shadow-card sm:p-5">
      <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
        <span className="text-[11px] uppercase tracking-[0.16em] text-muted">Asha Studio · Ledger</span>
        <span className="stamp font-mono text-xs font-semibold uppercase tracking-wide text-high">High · 78</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          ['RTO', '18%'],
          ['Saved', '₹12.4k'],
          ['Queue', '7'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-raised p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
            <p className="mt-1 font-mono text-xl tracking-tight tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <svg viewBox="0 0 320 90" className="mt-4 h-24 w-full" role="img" aria-label="Weekly RTO rate trending down">
        <path d="M8 20 L70 38 L130 30 L190 55 L250 46 L312 68" fill="none" stroke="#c0392b" strokeWidth="2" pathLength="1" className="chart-line" />
      </svg>
      <div className="mt-2 divide-y divide-line border-t border-line">
        {[
          ['S1042', 'High', '78'],
          ['S1048', 'Low', '22'],
          ['S1051', 'Medium', '51'],
        ].map(([id, band, score]) => (
          <div key={id} className="flex items-center justify-between px-1 py-2.5 text-sm">
            <span className="font-mono text-xs text-muted">{id}</span>
            <span className={band === 'High' ? 'text-high' : band === 'Medium' ? 'text-mid' : 'text-low'}>{band}</span>
            <span className="font-mono tabular-nums">{score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
