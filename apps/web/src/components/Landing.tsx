'use client';

import Link from 'next/link';
import { Shield, MessageCircle, ScanLine, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { DemoButton } from './DemoButton';
import { SiteHeader } from './SiteHeader';
import { useMarketingMotion } from './useMarketingMotion';

const ticker = ['₹150 default return cost', 'Score 0–100', 'Low · Medium · High', 'Phone stays in the shop', '₹499 / month', 'No card checkout'];

const faqs = [
  ['Does this charge ₹499?', 'The price is a suggestion for a hosted shop. This open-source build does not take a card.'],
  ['What leaves the shop?', 'Phone numbers are not sent to TabPFN, Gemma, SerpApi, or ElevenLabs. Addresses go to the scoring service, then to Gemma only if you configure it.'],
  ['What if I have no model key?', 'Scoring still runs. The dashboard says when the result is scikit-learn or a rules prior.'],
];

function Wave({ fill, className = '' }: { fill: string; className?: string }) {
  return (
    <svg viewBox="0 0 1440 70" preserveAspectRatio="none" className={`block h-[36px] w-full sm:h-[64px] ${className}`} aria-hidden="true">
      <path d="M0,38 C180,66 360,10 540,28 C720,46 900,8 1080,30 C1260,52 1350,24 1440,36 L1440,70 L0,70 Z" fill={fill} />
    </svg>
  );
}

export function Landing() {
  useMarketingMotion(true);
  const loop = [...ticker, ...ticker];

  return (
    <div className="min-h-screen bg-canvas">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden">
          <div className="aurora" aria-hidden="true">
            <span className="aurora-pink left-[-10%] top-[-10%] h-[34rem] w-[34rem] opacity-70" />
            <span className="aurora-sky right-[-8%] top-[10%] h-[30rem] w-[30rem] opacity-70" />
            <span className="aurora-butter left-[30%] top-[45%] h-[22rem] w-[26rem] opacity-60" />
          </div>
          <div className="relative mx-auto grid max-w-page items-center gap-12 px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[1.02fr_0.98fr] lg:pt-28">
            <div>
              <p data-hero-item>
                <span className="inline-flex items-center gap-2 rounded-full bg-electric px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                  <Sparkles size={13} /> Cash on delivery · before the tape gun
                </span>
              </p>
              <h1 data-hero-item className="mt-6 max-w-xl font-display text-display-1">
                Stop paying ₹150 for orders that come back.
              </h1>
              <p data-hero-item className="mt-6 max-w-md text-lg leading-8 text-ink/70">
                Score every pending COD order from 0 to 100. Confirm the risky ones in Hindi, Hinglish, or English. Built for shops doing about 20 to 500 orders a day.
              </p>
              <div data-hero-item className="mt-9 flex flex-wrap items-center gap-4">
                <DemoButton />
                <Link href="/signup" className="btn btn-ghost">
                  Create a login <ArrowRight size={16} />
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

        <section id="product" className="mx-auto max-w-page px-5 py-24 sm:px-8">
          <div className="mb-10" data-reveal>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-electric">Product</p>
            <h2 className="mt-3 max-w-2xl font-display text-display-2">A desk that shows the risk before the parcel leaves.</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-6">
            <article className="card spotlight p-6 md:col-span-4" data-reveal>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Live score</p>
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-electric/10">
                  <ScanLine size={18} className="text-electric" />
                </span>
              </div>
              <p className="mt-4 font-display text-7xl text-electric">78</p>
              <p className="mt-3 text-sm font-semibold">S1042 · ₹1,599 COD · <span className="text-high">High</span></p>
              <ul className="mt-6 space-y-2.5 text-[15px] text-ink/70">
                <li className="flex gap-2"><span className="text-electric">●</span> First-time buyer, cash on delivery</li>
                <li className="flex gap-2"><span className="text-electric">●</span> Address is a landmark, with no house number</li>
                <li className="flex gap-2"><span className="text-electric">●</span> Placed late, when buyers confirm less often</li>
              </ul>
            </article>
            <article className="card spotlight flex flex-col justify-between bg-ink p-6 text-paper md:col-span-2" data-reveal>
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10">
                <MessageCircle size={18} className="text-pastel-butter" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-paper/60">You send it</p>
                <p className="mt-3 font-hindi text-[15px] leading-7">Namaste, aapka order confirm karna tha — ₹1,599 cash on delivery. Ghar pe honge kya?</p>
              </div>
            </article>
            <article className="card spotlight p-6 md:col-span-2" data-reveal>
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-low/10">
                <Shield size={18} className="text-low" />
              </span>
              <h3 className="mt-5 font-display text-2xl">Three bands, written out</h3>
              <p className="mt-2 text-[15px] leading-7 text-ink/70">Low can ship. Medium and High wait in the queue. Colour is never the only signal.</p>
            </article>
            <article className="card spotlight p-6 md:col-span-2" data-reveal>
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-electric/10">
                <Lock size={18} className="text-electric" />
              </span>
              <h3 className="mt-5 font-display text-2xl">The phone stays</h3>
              <p className="mt-2 text-[15px] leading-7 text-ink/70">Encrypted at rest, masked in lists, never sent to TabPFN, Gemma, SerpApi, or ElevenLabs.</p>
            </article>
            <article className="card spotlight p-6 md:col-span-2" data-reveal>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Fairness</p>
              <h3 className="mt-5 font-display text-2xl">A pincode is not a verdict</h3>
              <p className="mt-2 text-[15px] leading-7 text-ink/70">Courier notes can sit beside an order. They are not a model feature, and the product will not tell you to refuse a region.</p>
            </article>
          </div>
        </section>

        <Wave fill="#1e1efa" />
        <section id="method" className="bg-electric text-white">
          <div className="mx-auto grid max-w-page gap-10 px-5 py-20 sm:px-8 lg:grid-cols-3">
            {[
              ['01', 'Teach it this shop', 'Upload delivered and returned orders, or open the demo shop. TabPFN trains in context on that history. A cold shop uses a rules prior, then scikit-learn, and the screen names which one ran.'],
              ['02', 'Score before it ships', 'Each pending order gets 0–100, a Low, Medium, or High band, and a plain sentence. Address quality is a feature. The pincode is courier context.'],
              ['03', 'You send the message', 'Risky orders wait with a WhatsApp link and a draft in Hindi, Hinglish, or English. Confirmed teaches accepted. Cancelled teaches refused. Silence stays out of the next score.'],
            ].map(([n, title, body]) => (
              <article key={n} data-reveal className="rounded-3xl border-2 border-white/25 bg-white/10 p-6 backdrop-blur-sm">
                <p className="font-mono text-sm font-bold text-pastel-butter">{n}</p>
                <h3 className="mt-3 font-display text-3xl">{title}</h3>
                <p className="mt-3 text-[15px] leading-7 text-white/85">{body}</p>
              </article>
            ))}
          </div>
        </section>
        <Wave fill="#1e1efa" className="rotate-180" />

        <section className="mx-auto max-w-page px-5 py-24 sm:px-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-electric">Example day</p>
          <h2 className="mt-3 max-w-xl font-display text-display-2">40 COD orders. 8 come back.</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {[
              ['40', '', 'Packed', 'bg-pastel-mint'],
              ['8', '', 'Returned', 'bg-pastel-pink'],
              ['1200', '₹', 'Lost at ₹150 each', 'bg-pastel-butter'],
            ].map(([value, prefix, label, bg]) => (
              <article key={label} className={`card ${bg} p-6`} data-reveal>
                <p className="font-display text-6xl" data-tick={value} data-prefix={prefix}>
                  {prefix}
                  {Number(value).toLocaleString('en-IN')}
                </p>
                <p className="mt-3 text-sm font-semibold text-ink/70">{label}</p>
              </article>
            ))}
          </div>
          <p className="mt-8 max-w-xl text-[15px] leading-8 text-ink/70">
            At ₹150 reverse shipping, that is ₹1,200 before lunch. Stopping a handful covers a ₹499 month. Your dashboard uses the cost you set.
          </p>
        </section>

        <section id="pricing" className="mx-auto max-w-page px-5 pb-24 sm:px-8">
          <div className="card flex flex-col items-start justify-between gap-8 overflow-hidden p-8 sm:flex-row sm:items-center sm:p-12" data-reveal>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-electric">Suggested price</p>
              <h2 className="mt-3 font-display text-display-1">₹499<span className="font-sans text-2xl font-semibold text-muted">/mo</span></h2>
              <p className="mt-4 max-w-md text-[15px] leading-8 text-ink/70">
                Scoring, the confirmation queue, export, and delete. TabPFN, Gemma, ElevenLabs, and SerpApi keys are yours if you want them. This build does not take a card.
              </p>
            </div>
            <div className="shrink-0">
              <DemoButton label="Try the demo shop" />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-page px-5 pb-24 sm:px-8">
          <h2 className="font-display text-display-2">Questions</h2>
          <div className="mt-8 divide-y-2 divide-ink/10 border-y-2 border-ink">
            {faqs.map(([q, a]) => (
              <details key={q} className="group py-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                  {q}
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-electric text-xl text-white transition group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-3 max-w-2xl text-[15px] leading-8 text-ink/70">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className="border-t-2 border-ink bg-ink px-5 py-10 text-sm text-paper/70 sm:px-8">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-4">
          <p className="font-semibold text-paper">RTO Shield. MIT licensed.</p>
          <div className="flex gap-6 font-semibold">
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/login" className="hover:text-white">Log in</Link>
            <a href="#product" className="hover:text-white">Back to top</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ProductFrame() {
  return (
    <div data-hero-item className="relative">
      <div className="floaty absolute -right-3 -top-5 z-10 rotate-6 rounded-2xl bg-high px-4 py-2 text-sm font-bold text-white shadow-card" aria-hidden="true">
        HIGH RISK
      </div>
      <div className="card relative overflow-hidden p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Asha Studio · Today</span>
          <span className="rounded-full bg-low/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-low">Model · TabPFN</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            ['RTO', '18%', 'bg-pastel-pink'],
            ['Saved', '₹12.4k', 'bg-pastel-mint'],
            ['Queue', '7', 'bg-pastel-butter'],
          ].map(([label, value, bg]) => (
            <div key={label} className={`rounded-2xl ${bg} p-4`}>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink/60">{label}</p>
              <p className="mt-1 font-display text-2xl">{value}</p>
            </div>
          ))}
        </div>
        <svg viewBox="0 0 320 90" className="mt-5 h-24 w-full" role="img" aria-label="Weekly RTO rate trending down">
          <path d="M8 20 L70 38 L130 30 L190 55 L250 46 L312 68" fill="none" stroke="#1e1efa" strokeWidth="3" strokeLinecap="round" pathLength="1" className="chart-line" />
        </svg>
        <div className="mt-3 space-y-2">
          {[
            ['S1042', 'High', '78', 'text-high'],
            ['S1048', 'Low', '22', 'text-low'],
            ['S1051', 'Medium', '51', 'text-mid'],
          ].map(([id, band, score, color]) => (
            <div key={id} className="flex items-center justify-between rounded-2xl bg-canvas px-4 py-3 text-sm">
              <span className="font-mono text-xs font-semibold text-muted">{id}</span>
              <span className={`font-bold ${color}`}>{band}</span>
              <span className="font-display text-xl">{score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
