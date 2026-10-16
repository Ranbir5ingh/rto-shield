'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, ShieldCheck, ScanLine, MessageCircle } from 'lucide-react';
import { DemoButton } from './DemoButton';
import { SiteHeader } from './SiteHeader';
import { useMarketingMotion } from './useMarketingMotion';

const ticker = ['₹150 per return', 'Score 0–100', 'Low · Medium · High', 'Phone stays in the shop', '₹499 / month', 'No card checkout'];

const faqs = [
  ['Does this charge ₹499?', 'The price is a suggestion for a hosted shop. This open-source build does not take a card.'],
  ['What leaves the shop?', 'Phone numbers are not sent to TabPFN, Gemma, SerpApi, or ElevenLabs. Addresses go to the scoring service, then to Gemma only if you configure it.'],
  ['What if I have no model key?', 'Scoring still runs. The dashboard says when the result is scikit-learn or a rules prior.'],
];

const BAND = ['LOW', 'MED', 'HIGH'] as const;

function LiveScan() {
  const [orders, setOrders] = useState<{ id: string; value: number; score: number }[]>([]);

  useEffect(() => {
    let n = 1040;
    const tick = () => {
      n += 1;
      const value = 499 + Math.floor(Math.random() * 4200);
      const score = 5 + Math.floor(Math.random() * 94);
      setOrders((prev) => [{ id: `S${n}`, value, score }, ...prev].slice(0, 5));
    };
    tick();
    const t = window.setInterval(tick, 2200);
    return () => window.clearInterval(t);
  }, []);

  const bandOf = (s: number) => (s >= 65 ? 2 : s >= 40 ? 1 : 0);
  const bandColor = ['text-low', 'text-warn', 'text-signal'];

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
        <span className="flex items-center gap-2.5 font-mono text-xs tracking-[0.18em] text-muted">
          <span className="live-dot" /> LIVE SCAN
        </span>
        <span className="font-mono text-xs text-gold">TABPFN · IN-CONTEXT</span>
      </div>
      <ul className="divide-y divide-white/6">
        {orders.map((o) => (
          <li key={o.id} className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="font-mono text-sm text-ink">
                {o.id} <span className="text-muted">· ₹{o.value.toLocaleString('en-IN')} COD</span>
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className={`font-mono text-xs font-bold tracking-widest ${bandColor[bandOf(o.score)]}`}>
                {BAND[bandOf(o.score)]}
              </span>
              <span className="font-display text-2xl font-bold tabular-nums">{o.score}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="border-t border-white/8 px-6 py-3 font-mono text-[11px] text-muted">
        Simulated feed — your shop scores its own real orders.
      </p>
    </div>
  );
}

function ScoreDemo() {
  const [value, setValue] = useState(1599);
  const [cod, setCod] = useState(true);
  const [tier, setTier] = useState(1);
  const [history, setHistory] = useState(0);

  const score = useMemo(() => {
    let s = 18 + Math.min(30, value / 120) + (cod ? 22 : 0) + tier * 9 + [14, 4, -8][history];
    return Math.max(1, Math.min(99, Math.round(s)));
  }, [value, cod, tier, history]);

  const band = score >= 65 ? 'HIGH' : score >= 40 ? 'MED' : 'LOW';
  const color = score >= 65 ? 'text-signal' : score >= 40 ? 'text-warn' : 'text-low';

  const seg = (active: boolean, activeCls: string) =>
    `rounded-full border px-5 py-2.5 font-mono text-xs font-bold tracking-widest transition ${
      active ? activeCls : 'border-white/12 text-muted hover:border-white/30 hover:text-ink'
    }`;

  return (
    <div className="card spotlight p-7 sm:p-10">
      <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          <div>
            <div className="mb-3 flex justify-between font-mono text-xs tracking-[0.16em] text-muted">
              <span>ORDER VALUE</span>
              <span className="text-ink">₹{value.toLocaleString('en-IN')}</span>
            </div>
            <input type="range" min={299} max={9999} step={100} value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              className="w-full accent-[#e8b34a]" aria-label="Order value" />
          </div>
          <div>
            <p className="mb-3 font-mono text-xs tracking-[0.16em] text-muted">PAYMENT</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setCod(true)} className={seg(cod, 'border-gold bg-gold/15 text-gold')}>COD</button>
              <button type="button" onClick={() => setCod(false)} className={seg(!cod, 'border-gold bg-gold/15 text-gold')}>PREPAID</button>
            </div>
          </div>
          <div>
            <p className="mb-3 font-mono text-xs tracking-[0.16em] text-muted">PINCODE</p>
            <div className="flex gap-3">
              {['Metro', 'Town', 'Remote'].map((l, i) => (
                <button key={l} type="button" onClick={() => setTier(i)} className={seg(tier === i, 'border-gold bg-gold/15 text-gold')}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-3 font-mono text-xs tracking-[0.16em] text-muted">BUYER</p>
            <div className="flex flex-wrap gap-3">
              {['First order', 'Repeat buyer', 'Returned before'].map((l, i) => (
                <button key={l} type="button" onClick={() => setHistory(i)} className={seg(history === i, 'border-gold bg-gold/15 text-gold')}>{l}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/8 bg-void/60 p-8 text-center">
          <p className="font-mono text-xs tracking-[0.2em] text-muted">SCORE</p>
          <p className={`font-display text-8xl font-extrabold tabular-nums ${color}`} aria-live="polite">{score}</p>
          <p className={`risk-pill mt-4 ${color}`}>{band} risk</p>
          <p className="mt-5 text-sm leading-6 text-muted">
            {band === 'HIGH' && 'Hold the parcel. Confirm on WhatsApp first.'}
            {band === 'MED' && 'Worth a quick confirmation message.'}
            {band === 'LOW' && 'Ship it. This one looks safe.'}
          </p>
        </div>
      </div>
      <p className="mt-8 font-mono text-[11px] text-muted/70">Demo heuristic — your shop's real score learns from your own history.</p>
    </div>
  );
}

export function Landing() {
  useMarketingMotion(true);
  const loop = [...ticker, ...ticker];

  return (
    <div className="min-h-screen bg-void text-ink">
      <SiteHeader />
      <main>
        {/* HERO */}
        <section className="relative overflow-hidden">
          <div className="aurora" aria-hidden="true">
            <span className="aurora-gold drift left-[8%] top-[6%] h-[36rem] w-[36rem]" />
            <span className="aurora-ember right-[4%] top-[38%] h-[26rem] w-[26rem]" />
            <span className="aurora-ink bottom-[-10%] left-[38%] h-[30rem] w-[30rem]" />
          </div>

          <div className="relative mx-auto grid max-w-page items-center gap-14 px-5 pb-24 pt-36 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:pt-44">
            <div>
              <p data-hero-item className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-gold/40 bg-gold/10 px-4 py-2 font-mono text-[11px] tracking-[0.22em] text-gold">
                <span className="live-dot" /> COD RISK INTELLIGENCE
              </p>
              <h1 data-reveal-group className="font-display font-extrabold text-display-1">
                <span className="reveal-mask"><span className="reveal-line" data-hero-line>Every return</span></span>
                <span className="reveal-mask"><span className="reveal-line" data-hero-line>costs you <em className="accent-serif text-gold">₹150.</em></span></span>
              </h1>
              <p data-hero-item className="mt-7 max-w-md text-lg leading-8 text-ink/70">
                RTO Shield scores every cash-on-delivery order 0–100 before it ships.
                Confirm the risky ones in Hindi, Hinglish, or English — and keep the rupees.
              </p>
              <div data-hero-item className="mt-10 flex flex-wrap items-center gap-4">
                <DemoButton />
                <Link href="#how" className="btn btn-ghost">
                  See how it works <ArrowRight size={16} />
                </Link>
              </div>
              <div data-hero-item className="mt-12 flex items-center gap-8 font-mono text-xs text-muted">
                <span><strong className="font-display text-xl text-ink">0–100</strong><br />risk score</span>
                <span className="h-8 w-px bg-white/10" />
                <span><strong className="font-display text-xl text-ink">3</strong><br />risk bands</span>
                <span className="h-8 w-px bg-white/10" />
                <span><strong className="font-display text-xl text-ink">₹499</strong><br />/ month</span>
              </div>
            </div>
            <div data-hero-item>
              <LiveScan />
            </div>
          </div>
        </section>

        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {loop.map((item, i) => (
              <span key={`${item}-${i}`}>{item} <span className="text-gold">✦</span></span>
            ))}
          </div>
        </div>

        {/* THE BLEED */}
        <section id="problem" className="relative py-28 sm:py-36">
          <div className="mx-auto max-w-page px-5 sm:px-8">
            <div data-reveal-group className="max-w-3xl">
              <p className="mb-5 font-mono text-xs tracking-[0.25em] text-signal">THE BLEED</p>
              <h2 className="font-display font-extrabold text-display-2">
                <span className="reveal-mask"><span className="reveal-line">A customer ghosts.</span></span>
                <span className="reveal-mask"><span className="reveal-line">The courier rides <em className="accent-serif text-signal">back.</em></span></span>
              </h2>
            </div>
            <p data-reveal className="mt-6 max-w-xl text-lg leading-8 text-ink/70">
              You pay freight both ways and the stock gathers dust. An ordinary day:
            </p>
            <div className="mt-14 grid gap-5 sm:grid-cols-3">
              {[
                ['40', '', 'orders packed', 'text-ink', 'Ordinary Tuesday.'],
                ['8', '', 'come back', 'text-signal', 'One in five. Ghosted.'],
                ['1200', '₹', 'lost before lunch', 'text-gold', 'At ₹150 a return.'],
              ].map(([v, pre, label, color, note]) => (
                <article key={label} data-reveal className="card spotlight p-8">
                  <p className={`font-display text-6xl font-extrabold tabular-nums ${color}`}>
                    <span data-count={v} data-prefix={pre}>{pre}0</span>
                  </p>
                  <p className="mt-3 font-mono text-xs uppercase tracking-[0.18em] text-muted">{label}</p>
                  <p className="mt-2 text-sm text-ink/60">{note}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS — sticky stack */}
        <section id="how" className="relative py-28 sm:py-36">
          <div className="mx-auto max-w-page px-5 sm:px-8">
            <div data-reveal-group className="mb-16 max-w-3xl">
              <p className="mb-5 font-mono text-xs tracking-[0.25em] text-gold">HOW IT WORKS</p>
              <h2 className="font-display font-extrabold text-display-2">
                <span className="reveal-mask"><span className="reveal-line">Three moves.</span></span>
                <span className="reveal-mask"><span className="reveal-line"><em className="accent-serif text-gold">Zero</em> guesswork.</span></span>
              </h2>
            </div>

            <div className="space-y-6">
              {(
                [
                  ['01', ScanLine, 'Teach it this shop', 'text-gold', 'Upload delivered and returned orders — or open the demo shop. TabPFN trains in context on that history. A cold shop starts on a rules prior, then scikit-learn, and the screen always names which one ran.'],
                  ['02', ShieldCheck, 'Score before it ships', 'text-cyan', 'Each pending order gets 0–100, a Low, Medium, or High band, and a plain sentence saying why. Address quality is a feature. The pincode is courier context — never a verdict on a region.'],
                  ['03', MessageCircle, 'You send the message', 'text-low', 'Risky orders wait in a queue with a WhatsApp link and a draft in Hindi, Hinglish, or English. Confirmed teaches accepted. Cancelled teaches refused. Silence stays out of the next score.'],
                ] as [string, typeof ScanLine, string, string, string][]
              ).map(([n, Icon, title, color, body], i) => {
                return (
                  <article
                    key={n}
                    data-reveal
                    className="card spotlight sticky p-8 sm:p-12"
                    style={{ top: `${7 + i * 2}rem` }}
                  >
                    <div className="grid gap-8 sm:grid-cols-[auto_1fr] sm:items-start">
                      <span className={`font-display text-7xl font-extrabold ${color}`}>{n}</span>
                      <div>
                        <div className="flex items-center gap-3">
                          <Icon size={20} className={color} />
                          <h3 className="font-display text-3xl font-bold tracking-tight">{title}</h3>
                        </div>
                        <p className="mt-4 max-w-2xl text-lg leading-8 text-ink/70">{body}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* TRY THE MODEL */}
        <section id="demo" className="relative overflow-hidden py-28 sm:py-36">
          <div className="aurora" aria-hidden="true">
            <span className="aurora-gold drift right-[10%] top-[10%] h-[28rem] w-[28rem]" />
          </div>
          <div className="relative mx-auto max-w-page px-5 sm:px-8">
            <div data-reveal-group className="mb-14 max-w-3xl">
              <p className="mb-5 font-mono text-xs tracking-[0.25em] text-gold">TRY THE MODEL</p>
              <h2 className="font-display font-extrabold text-display-2">
                <span className="reveal-mask"><span className="reveal-line">Drag the levers.</span></span>
                <span className="reveal-mask"><span className="reveal-line">Watch the <em className="accent-serif text-gold">verdict</em> move.</span></span>
              </h2>
            </div>
            <div data-reveal>
              <ScoreDemo />
            </div>

            <div data-reveal className="card mt-8 grid gap-8 p-8 sm:grid-cols-[1fr_auto] sm:items-center sm:p-10">
              <div>
                <p className="font-mono text-xs tracking-[0.2em] text-gold">THE TRANSMISSION</p>
                <p className="mt-4 max-w-xl font-hindi text-xl leading-9 text-ink/90">
                  Namaste, aapka order confirm karna tha — ₹1,599 cash on delivery. Ghar pe honge kya?
                </p>
                <p className="mt-3 text-sm text-muted">Every risky order waits with a draft in Hindi, Hinglish, or English. Your phone number never leaves the shop.</p>
              </div>
              <Link href="/signup" className="btn btn-electric whitespace-nowrap">
                Open a shop <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="relative py-28 sm:py-36">
          <div className="mx-auto max-w-page px-5 sm:px-8">
            <div className="card spotlight relative mx-auto max-w-2xl overflow-hidden p-10 text-center sm:p-14">
              <div className="aurora" aria-hidden="true">
                <span className="aurora-gold left-1/2 top-[-40%] h-[24rem] w-[24rem] -translate-x-1/2" />
              </div>
              <div data-reveal-group className="relative">
                <p className="mb-4 font-mono text-xs tracking-[0.25em] text-gold">ONE PLAN</p>
                <p className="reveal-mask"><span className="reveal-line font-display text-7xl font-extrabold">₹499<span className="font-sans text-2xl font-medium text-muted">/mo</span></span></p>
                <p className="mx-auto mt-6 max-w-md leading-7 text-ink/70">
                  Scoring, the confirmation queue, export, and delete. Your TabPFN, Gemma, ElevenLabs, and SerpApi keys if you want them. This build does not take a card.
                </p>
                <div className="mt-8 flex justify-center">
                  <DemoButton label="Try the demo shop" />
                </div>
              </div>
            </div>

            <div className="mx-auto mt-24 max-w-3xl">
              <h3 data-reveal className="font-display text-3xl font-bold tracking-tight">Questions</h3>
              <div className="mt-8 border-t border-white/10">
                {faqs.map(([q, a]) => (
                  <details key={q} data-reveal className="group border-b border-white/10 py-6">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold tracking-tight">
                      {q}
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-gold/50 text-xl text-gold transition group-open:rotate-45" aria-hidden="true">+</span>
                    </summary>
                    <p className="mt-3 max-w-2xl leading-7 text-ink/65">{a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative overflow-hidden border-t border-white/10">
        <div className="aurora" aria-hidden="true">
          <span className="aurora-gold drift bottom-[-30%] left-[20%] h-[26rem] w-[26rem]" />
        </div>
        <div className="relative mx-auto max-w-page px-5 py-24 sm:px-8">
          <div data-reveal-group>
            <h2 className="font-display font-extrabold text-display-1">
              <span className="reveal-mask"><span className="reveal-line">Stop the <em className="accent-serif text-gold">bleed.</em></span></span>
            </h2>
          </div>
          <div data-reveal className="mt-10 flex flex-wrap gap-4">
            <DemoButton label="Open the demo shop" />
            <Link href="/signup" className="btn btn-ghost">Create a login</Link>
          </div>
          <div className="mt-20 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-8 font-mono text-xs text-muted">
            <p>RTO SHIELD · MIT LICENSED</p>
            <div className="flex gap-6">
              <Link href="/privacy" className="transition hover:text-gold">Privacy</Link>
              <Link href="/login" className="transition hover:text-gold">Log in</Link>
              <a href="#problem" className="transition hover:text-gold">Back to top ↑</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
