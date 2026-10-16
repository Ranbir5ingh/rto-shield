'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ShieldCheck, ScanLine, MessageCircle, PiggyBank, ChevronDown } from 'lucide-react';
import { DemoButton } from './DemoButton';
import { SiteHeader } from './SiteHeader';
import { RiskArcade } from './RiskArcade';
import { useMarketingMotion } from './useMarketingMotion';

const ticker = ['SCORE 0–100', 'LOW · MED · HIGH', 'PHONE STAYS IN THE SHOP', '₹499 / MONTH', 'NO CARD CHECKOUT', 'CONFIRM ON WHATSAPP'];

const faqs = [
  ['Does this charge ₹499?', 'The price is a suggestion for a hosted shop. This open-source build does not take a card.'],
  ['What leaves the shop?', 'Phone numbers are not sent to TabPFN, Gemma, SerpApi, or ElevenLabs. Addresses go to the scoring service, then to Gemma only if you configure it.'],
  ['What if I have no model key?', 'Scoring still runs. The dashboard says when the result is scikit-learn or a rules prior.'],
];

export function Landing() {
  useMarketingMotion(true);
  const [booted, setBooted] = useState(false);
  const loop = [...ticker, ...ticker];

  useEffect(() => {
    const t = window.setTimeout(() => setBooted(true), 1100);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-void text-ink">
      {!booted && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-void">
          <p className="font-display text-2xl font-bold text-lime">RTO▲SHIELD</p>
          <div className="h-4 w-64 border-2 border-lime">
            <div className="boot-bar h-full bg-lime" />
          </div>
          <p className="px-blink font-mono text-xs tracking-widest text-muted">LOADING…</p>
        </div>
      )}

      <SiteHeader />

      <main>
        {/* HERO */}
        <section className="relative flex min-h-svh items-center overflow-hidden">
          <div className="absolute inset-0" data-hero-bg aria-hidden="true">
            <img
              src="/assets/pixel/hero-market.webp"
              alt=""
              className="h-[115%] w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-void/70 via-void/35 to-void" />
          </div>

          <div className="relative mx-auto w-full max-w-page px-4 pb-24 pt-32 sm:px-6">
            <p data-hero-item className="mb-6 inline-block border-2 border-lime bg-void/80 px-4 py-2 font-mono text-xs font-bold tracking-[0.2em] text-lime">
              A BOSS FIGHT FOR COD SELLERS
            </p>
            <h1 className="font-display font-bold text-display-1">
              <span data-hero-item className="block">EVERY RETURN</span>
              <span data-hero-item className="block text-lime">STEALS ₹150.</span>
            </h1>
            <p data-hero-item className="mt-6 max-w-xl text-lg leading-8 text-ink/80">
              RTO Shield scores every cash-on-delivery order 0–100 before you ship.
              Confirm the risky ones on WhatsApp. Keep the rupees.
            </p>
            <div data-hero-item className="mt-10 flex flex-wrap items-center gap-5">
              <DemoButton />
              <Link href="#level-3" className="btn btn-ghost">
                HOW IT PLAYS
              </Link>
            </div>
            <div data-hero-item className="mt-14 flex items-center gap-3 font-mono text-xs tracking-widest text-muted">
              <ChevronDown size={16} className="animate-bounce text-lime" />
              <span className="px-blink">SCROLL TO PLAY</span>
            </div>
          </div>
        </section>

        {/* MARQUEE */}
        <div className="marquee -rotate-1 scale-[1.02]" aria-hidden="true">
          <div className="marquee-track">
            {loop.map((item, i) => (
              <span key={`${item}-${i}`}>★ {item}</span>
            ))}
          </div>
        </div>

        {/* LEVEL 01 */}
        <section id="level-1" className="px-grid relative py-28 sm:py-36">
          <div className="mx-auto grid max-w-page items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <p data-reveal className="font-mono text-sm font-bold tracking-[0.25em] text-pink">LEVEL 01</p>
              <h2 data-reveal className="mt-4 font-display font-bold text-display-2">
                MEET THE BOSS:<br />THE COMEBACK PARCEL
              </h2>
              <p data-reveal className="mt-6 max-w-md text-lg leading-8 text-ink/75">
                A customer ghosts. The courier rides back. You pay both ways and
                the stock gathers dust. An average day looks like this:
              </p>
              <div className="mt-10 grid grid-cols-3 gap-4">
                {[
                  ['40', '', 'packed', 'text-ink'],
                  ['8', '', 'come back', 'text-danger'],
                  ['1200', '₹', 'lost', 'text-lime'],
                ].map(([v, pre, label, color]) => (
                  <div key={label} data-reveal className="px-cut border-2 border-line bg-panel p-4 text-center shadow-px sm:p-6">
                    <p className={`font-display text-4xl font-bold tabular-nums sm:text-5xl ${color}`}>
                      <span data-count={v} data-prefix={pre}>{pre}0</span>
                    </p>
                    <p className="mt-2 font-mono text-xs uppercase tracking-widest text-muted">{label}</p>
                  </div>
                ))}
              </div>
              <p data-reveal className="mt-8 max-w-md leading-7 text-ink/70">
                ₹1,200 gone before lunch — at ₹150 reverse shipping a pop. Stopping
                a handful of bad ships covers the whole month.
              </p>
            </div>
            <div data-reveal className="relative">
              <img
                src="/assets/pixel/mascot-keeper.webp"
                alt="Your shopkeeper, ready to fight returns"
                className="floaty mx-auto w-full max-w-sm"
              />
              <p className="mt-4 text-center font-mono text-xs tracking-widest text-muted">
                YOUR SHOPKEEPER · LVL 99 · EQUIPPED
              </p>
            </div>
          </div>
        </section>

        {/* LEVEL 02 */}
        <section id="level-2" className="relative border-y-2 border-line bg-panel/40 py-28 sm:py-36">
          <div className="mx-auto max-w-page px-4 sm:px-6">
            <p data-reveal className="font-mono text-sm font-bold tracking-[0.25em] text-cyan">LEVEL 02</p>
            <h2 data-reveal className="mt-4 max-w-3xl font-display font-bold text-display-2">
              THE SCANNER DECIDES<br />BEFORE THE TAPE GUN
            </h2>
            <p data-reveal className="mt-6 max-w-xl text-lg leading-8 text-ink/75">
              Drag the levers. This is the same 0–100 logic your dashboard runs —
              value, payment mode, pincode, buyer history. Try to break it:
            </p>
            <div data-reveal className="mt-12 grid items-start gap-10 lg:grid-cols-[1fr_360px]">
              <RiskArcade />
              <div>
                <img
                  src="/assets/pixel/arcade-scanner.webp"
                  alt="The RTO Shield risk scanner arcade cabinet"
                  className="w-full"
                />
                <p className="mt-4 text-center font-mono text-xs tracking-widest text-muted">
                  INSERT COIN TO CONTINUE
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* LEVEL 03 — horizontal */}
        <section id="level-3" className="relative overflow-hidden">
          <div id="level-3-pin" className="flex min-h-svh flex-col justify-center py-24">
            <div className="mx-auto w-full max-w-page px-4 sm:px-6">
              <p className="font-mono text-sm font-bold tracking-[0.25em] text-yellow">LEVEL 03</p>
              <h2 className="mt-4 font-display font-bold text-display-2">HOW IT PLAYS</h2>
            </div>
            <div id="level-3-track" className="mt-12 flex gap-6 px-4 sm:px-6">
              {(
                [
                  [ScanLine, 'DETECT', 'text-lime', 'border-lime', 'Your history teaches the machine. Upload delivered + returned orders — TabPFN learns this shop\u2019s patterns in context. No history? A rules prior holds the fort.'],
                  [ShieldCheck, 'SCORE', 'text-cyan', 'border-cyan', 'Every pending order gets 0–100, a LOW / MED / HIGH band, and one plain sentence. Address quality is a feature. The pincode is courier context, never a verdict.'],
                  [MessageCircle, 'ACT', 'text-pink', 'border-pink', 'Risky orders wait in the queue with a WhatsApp draft in Hindi, Hinglish, or English. You press send — one tap, your words.'],
                  [PiggyBank, 'SAVE', 'text-yellow', 'border-yellow', 'Confirmed teaches accepted. Cancelled teaches refused. Every outcome sharpens the next score. The dashboard counts the rupees you kept.'],
                ] as [typeof ScanLine, string, string, string, string][]
              ).map(([Icon, title, color, border, body], i) => {
                return (
                  <article key={title} className={`px-cut w-[82vw] shrink-0 border-2 bg-panel p-8 shadow-px sm:w-[420px] ${border}`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-mono text-sm font-bold ${color}`}>0{i + 1}</span>
                      <Icon size={28} className={color} />
                    </div>
                    <h3 className="mt-8 font-display text-3xl font-bold">{title}</h3>
                    <p className="mt-4 leading-7 text-ink/75">{body}</p>
                  </article>
                );
              })}
            </div>
            <p className="mx-auto mt-10 w-full max-w-page px-4 font-mono text-xs tracking-widest text-muted sm:px-6">
              KEEP SCROLLING — THE CARDS SLIDE <span className="text-lime">→</span>
            </p>
          </div>
        </section>

        {/* LEVEL 04 */}
        <section className="border-t-2 border-line bg-panel/40 py-28 sm:py-36">
          <div className="mx-auto grid max-w-page items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <p data-reveal className="font-mono text-sm font-bold tracking-[0.25em] text-pink">LEVEL 04</p>
              <h2 data-reveal className="mt-4 font-display font-bold text-display-2">
                YOU SEND THE<br />TRANSMISSION
              </h2>
              <p data-reveal className="mt-6 max-w-md text-lg leading-8 text-ink/75">
                Every risky order waits with a draft in your buyer's language.
                Fairness is built in: a pincode is never a verdict, and the phone
                number never leaves your shop.
              </p>
              <div data-reveal className="mt-8 flex flex-wrap gap-4">
                <Link href="/signup" className="btn btn-primary">▶ OPEN A SHOP</Link>
              </div>
            </div>
            <div data-reveal className="px-cut mx-auto w-full max-w-md border-2 border-pink bg-void p-6 shadow-px">
              <p className="font-mono text-xs font-bold tracking-widest text-pink">WHATSAPP DRAFT · AUTO-READY</p>
              <p className="mt-4 border-l-4 border-lime bg-panel p-4 font-hindi text-lg leading-8">
                Namaste, aapka order confirm karna tha — ₹1,599 cash on delivery. Ghar pe honge kya?
              </p>
              <div className="mt-4 flex gap-3">
                <span className="risk-pill text-lime">Hindi</span>
                <span className="risk-pill text-cyan">Hinglish</span>
                <span className="risk-pill text-yellow">English</span>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL BOSS */}
        <section id="final" className="px-grid relative py-28 sm:py-36">
          <div className="mx-auto max-w-page px-4 text-center sm:px-6">
            <p data-reveal className="font-mono text-sm font-bold tracking-[0.25em] text-danger">FINAL BOSS</p>
            <h2 data-reveal className="mx-auto mt-4 max-w-3xl font-display font-bold text-display-1">
              INSERT COIN
            </h2>
            <div data-reveal className="px-cut mx-auto mt-12 max-w-lg border-2 border-yellow bg-panel p-10 shadow-px">
              <p className="font-mono text-xs font-bold tracking-widest text-muted">SUGGESTED PRICE</p>
              <p className="mt-4 font-display text-7xl font-bold text-yellow">₹499<span className="font-sans text-2xl text-muted">/mo</span></p>
              <p className="mx-auto mt-6 max-w-sm leading-7 text-ink/70">
                Scoring, the confirmation queue, export, delete. Your TabPFN,
                Gemma, ElevenLabs, SerpApi keys if you want them. This build
                does not take a card.
              </p>
              <div className="mt-8">
                <DemoButton label="▶ TRY THE DEMO SHOP" />
              </div>
            </div>

            <div className="mx-auto mt-20 max-w-3xl text-left">
              <h3 data-reveal className="font-display text-2xl font-bold">QUESTIONS FROM THE CROWD</h3>
              <div className="mt-6 border-t-2 border-line">
                {faqs.map(([q, a]) => (
                  <details key={q} data-reveal className="group border-b-2 border-line py-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-xl font-bold">
                      {q}
                      <span className="px-cut-sm grid h-9 w-9 shrink-0 place-items-center border-2 border-lime text-lg text-lime transition group-open:rotate-45" aria-hidden="true">+</span>
                    </summary>
                    <p className="mt-3 max-w-2xl leading-7 text-ink/70">{a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-lime bg-panel px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-page">
          <p className="font-display text-5xl font-bold sm:text-7xl">
            GAME OVER<span className="text-lime">?</span>
          </p>
          <p className="mt-4 max-w-md text-lg text-ink/70">Nah. Thanks for playing — now go save some rupees.</p>
          <div className="mt-8">
            <Link href="/signup" className="btn btn-primary !text-lg">▶ PRESS START</Link>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t-2 border-line pt-8 font-mono text-sm text-muted">
            <p>RTO SHIELD · MIT LICENSED</p>
            <div className="flex gap-6">
              <Link href="/privacy" className="transition hover:text-lime">PRIVACY</Link>
              <Link href="/login" className="transition hover:text-lime">LOG IN</Link>
              <a href="#level-1" className="transition hover:text-lime">BACK TO TOP ↑</a>
            </div>
          </div>
        </div>
      </footer>

      <style>{`.boot-bar { animation: boot 1s steps(10) forwards; } @keyframes boot { from { width: 0; } to { width: 100%; } }`}</style>
    </div>
  );
}
