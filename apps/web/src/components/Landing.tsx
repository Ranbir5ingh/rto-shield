'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Minus, Plus } from 'lucide-react';
import { DemoButton } from '@/components/DemoButton';
import { OrderRain } from '@/components/OrderRain';
import { SiteHeader } from '@/components/SiteHeader';
import { Eyebrow, Flag, LabelChip } from '@/components/ui';
import { useMarketingMotion } from '@/components/useMarketingMotion';

function Statement({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className="relative mx-auto max-w-page px-5 py-28 sm:px-8 sm:py-40">
      <p data-scrub-words className={`statement text-[clamp(2.4rem,7vw,6rem)] ${className}`}>
        {children}
      </p>
    </section>
  );
}

const RULES_ROWS = [
  ['S1042', '₹2,458', 'COD', '110001'],
  ['S1047', '₹1,299', 'COD', '400050'],
  ['S1049', '₹4,599', 'COD', '122018'],
  ['S1052', '₹2,799', 'COD', '400001'],
];

const SEEN_ROWS: [string, string, string, string, string][] = [
  ['S1042', '₹2,458', 'COD', '110001', 'CLEAR'],
  ['S1047', '₹1,299', 'COD', '400050', 'RTO RISK'],
  ['S1049', '₹4,599', 'COD', '122018', 'FAKE ADDRESS'],
  ['S1052', '₹2,799', 'COD', '400001', 'GHOST BUYER'],
];

function DataGap() {
  const panel = (variant: 'under' | 'over') => {
    const isOver = variant === 'over';
    const rows = isOver ? SEEN_ROWS : RULES_ROWS;
    return (
      <div className={`absolute inset-0 ${isOver ? 'bg-panel' : 'bg-black'} p-8 sm:p-12`}>
        <div className="flex items-center justify-between">
          <p className={`font-mono text-xs font-medium uppercase tracking-[0.22em] ${isOver ? 'text-white' : 'text-muted'}`}>
            {isOver ? 'What RTO Shield sees' : 'What your rules see'}
          </p>
          <LabelChip>{isOver ? 'Complete view' : 'Fragmented view'}</LabelChip>
        </div>
        <div className="mt-8">
          {rows.map((row) => {
            const [id, amt, pay, pin] = row;
            const flag = row[4] as string | undefined;
            return (
              <div key={id} className={`datarow ${isOver ? '' : 'text-muted'}`}>
                <span className={isOver && flag !== 'CLEAR' ? 'text-white' : 'text-muted'}>
                  {id} · {amt} · {pay} · {pin}
                </span>
                {isOver ? (
                  flag === 'CLEAR' ? (
                    <span data-wipe-flag className="inline-block"><Flag tone="go">Clear</Flag></span>
                  ) : (
                    <span data-wipe-flag className="inline-block"><Flag tone="red">{flag}</Flag></span>
                  )
                ) : (
                  <Flag tone="ghost">—</Flag>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-8 max-w-md font-mono text-xs leading-6 text-muted">
          {isOver
            ? 'The same four orders — with every hidden pattern surfaced before the tape gun comes out.'
            : 'Four orders. Four parcels packed. Two of them are already lost — and nothing on this screen says so.'}
        </p>
      </div>
    );
  };

  return (
    <section id="gap" className="relative border-t border-line">
      <div className="mx-auto max-w-page px-5 py-24 sm:px-8 sm:py-32">
        <Eyebrow data-scramble>/The problem/</Eyebrow>
        <h2 data-scrub-words className="statement mt-6 text-[clamp(2rem,5vw,4.5rem)]">
          Closing the<br />data gap.
        </h2>

        <div data-wipe className="relative mt-16 h-[600px] overflow-hidden border border-line sm:h-[560px]">
          {panel('under')}
          <div data-wipe-over className="absolute inset-0">
            {panel('over')}
          </div>
          <div
            data-wipe-scan
            className="pointer-events-none absolute inset-y-0 w-[2px] bg-go shadow-[0_0_28px_3px_rgba(0,230,118,0.65)]"
            aria-hidden="true"
          />
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.32em] text-muted">
            Scroll — the signal scans
          </p>
        </div>
      </div>
    </section>
  );
}

function Pillars() {
  const items = [
    ['01', 'Score every order', 'Each pending order gets 0–100, a Low, Medium, or High band, and a plain sentence saying why. Address quality is a feature. The pincode is courier context — never a verdict on a region.'],
    ['02', 'Confirm the risky ones', 'Risky orders wait in a queue with a WhatsApp link and a draft in Hindi, Hinglish, or English. You send the message — the product never does.'],
    ['03', 'Ship with proof', 'Confirmed teaches accepted. Cancelled teaches refused. Silence stays out of the next score. Every outcome makes the next prediction sharper.'],
  ];
  return (
    <section id="chapters" className="relative border-t border-line">
      <div className="mx-auto max-w-page px-5 py-24 sm:px-8 sm:py-32">
        <Eyebrow data-scramble>/How it works/</Eyebrow>
        <div className="mt-12">
          {items.map(([n, title, body]) => (
            <div key={n} data-reveal className="faq-item grid gap-4 py-10 sm:grid-cols-[120px_1fr_1.4fr] sm:items-baseline">
              <span className="font-mono text-sm font-medium tracking-[0.2em] text-signal">{n}</span>
              <h3 className="statement text-3xl sm:text-4xl">{title}</h3>
              <p className="max-w-xl text-[15px] leading-7 text-muted">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TryModel() {
  const [value, setValue] = useState(1599);
  const [pay, setPay] = useState<'cod' | 'prepaid'>('cod');
  const [pin, setPin] = useState<'metro' | 'town' | 'remote'>('town');
  const [buyer, setBuyer] = useState<'first' | 'repeat' | 'rto'>('first');

  let score = 18;
  if (pay === 'cod') score += 22;
  if (pin === 'town') score += 12;
  if (pin === 'remote') score += 20;
  if (buyer === 'first') score += 14;
  if (buyer === 'rto') score += 30;
  if (value > 3000) score += 8;
  score = Math.max(3, Math.min(97, score));
  const band = score >= 65 ? 'High' : score >= 40 ? 'Medium' : 'Low';

  const seg = (active: boolean) => ({
    className: `px-5 py-3 font-mono text-[11px] uppercase tracking-[0.18em] transition ${
      active ? 'bg-white text-black' : 'text-muted shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)] hover:text-white'
    }`,
  });

  return (
    <section id="model" className="relative border-t border-line">
      <div className="mx-auto max-w-page px-5 py-24 sm:px-8 sm:py-32">
        <Eyebrow data-scramble>/Try the model/</Eyebrow>
        <h2 data-reveal className="statement mt-6 text-[clamp(2rem,5vw,4.5rem)]">
          Drag the levers.<br />Watch the verdict move.
        </h2>

        <div data-reveal className="panel mt-16 grid lg:grid-cols-[1fr_320px]">
          <div className="space-y-10 p-8 sm:p-12">
            <div>
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">Order value</p>
                <p className="font-mono text-sm tabular-nums">₹{value.toLocaleString('en-IN')}</p>
              </div>
              <input
                type="range"
                min={299}
                max={9999}
                step={100}
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className="lever mt-5"
                aria-label="Order value"
              />
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">Payment</p>
              <div className="mt-4 flex gap-3">
                <button type="button" {...seg(pay === 'cod')} onClick={() => setPay('cod')}>COD</button>
                <button type="button" {...seg(pay === 'prepaid')} onClick={() => setPay('prepaid')}>Prepaid</button>
              </div>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">Pincode</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {(['metro', 'town', 'remote'] as const).map((p) => (
                  <button key={p} type="button" {...seg(pin === p)} onClick={() => setPin(p)}>{p}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">Buyer</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {(['first', 'repeat', 'rto'] as const).map((b) => (
                  <button key={b} type="button" {...seg(buyer === b)} onClick={() => setBuyer(b)}>
                    {b === 'first' ? 'First order' : b === 'repeat' ? 'Repeat buyer' : 'Returned before'}
                  </button>
                ))}
              </div>
            </div>
            <p className="font-mono text-[11px] leading-6 text-muted/70">
              ILLUSTRATIVE — YOUR SHOP'S REAL SCORE TRAINS ON YOUR OWN HISTORY.
            </p>
          </div>
          <div className="flex flex-col items-center justify-center border-t border-line p-8 sm:p-12 lg:border-l lg:border-t-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">Score</p>
            <p
              className={`mt-4 font-display text-[7rem] font-black tabular-nums leading-none ${
                band === 'High' ? 'text-signal count-glow' : band === 'Medium' ? 'text-banana' : 'text-go'
              }`}
            >
              {score}
            </p>
            <div className="mt-5">
              {band === 'High' ? <Flag tone="red">High risk</Flag> : band === 'Medium' ? <Flag tone="banana">Medium risk</Flag> : <Flag tone="go">Low risk</Flag>}
            </div>
            <p className="mt-6 text-center font-mono text-xs leading-6 text-muted">
              {band === 'High' ? 'Hold the parcel. Confirm on WhatsApp first.' : band === 'Medium' ? 'Worth a message before it ships.' : 'Ship it. This one looks clean.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhatsAppChapter() {
  return (
    <section className="relative border-t border-line">
      <div className="mx-auto max-w-page px-5 py-24 sm:px-8 sm:py-32">
        <Eyebrow data-scramble>/The confirmation/</Eyebrow>
        <h2 data-reveal className="statement mt-6 max-w-4xl text-[clamp(2rem,5vw,4.5rem)]">
          You send the message. Not us.
        </h2>
        <div className="mt-16 grid gap-px bg-line lg:grid-cols-2">
          <div data-reveal className="bg-black p-8 sm:p-12">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">The queue</p>
            <div className="mt-6">
              {[
                ['S1047 · ₹1,299', 'RTO RISK', 'red'],
                ['S1049 · ₹4,599', 'FAKE ADDRESS', 'red'],
                ['S1052 · ₹2,799', 'GHOST BUYER', 'red'],
              ].map(([id, flag]) => (
                <div key={id} className="datarow">
                  <span>{id}</span>
                  <Flag tone="red">{flag}</Flag>
                </div>
              ))}
            </div>
            <p className="mt-8 font-mono text-xs leading-6 text-muted">
              Medium and High orders wait here. One tap opens WhatsApp with the draft ready.
            </p>
          </div>
          <div data-reveal className="bg-panel p-8 sm:p-12">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">The draft — Hindi</p>
            <p className="mt-6 font-dev text-lg leading-8 text-white/90">
              नमस्ते! आपका ऑर्डर S1047 (₹1,299, COD) कन्फर्म करने के लिए मैसेज कर रहे हैं। कृपया YES लिखकर भेजें ताकि हम आज ही डिस्पैच कर सकें।
            </p>
            <div className="mt-8 flex gap-3">
              <span className="label-chip">Hindi</span>
              <span className="label-chip">Hinglish</span>
              <span className="label-chip">English</span>
            </div>
            <p className="mt-8 font-mono text-xs leading-6 text-muted">
              Gemma drafts it when configured; clean local templates cover you until then. The phone number never leaves the shop.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="relative border-t border-line">
      <div className="mx-auto max-w-page px-5 py-24 sm:px-8 sm:py-32">
        <Eyebrow data-scramble>/Pricing/</Eyebrow>
        <h2 data-reveal className="statement mt-6 text-[clamp(2rem,5vw,4.5rem)]">
          One plan.<br />No fine print.
        </h2>
        <div data-reveal className="panel mt-16 grid lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="p-8 sm:p-12">
            <p className="font-display text-7xl font-black tabular-nums tracking-tight sm:text-8xl">
              ₹499<span className="text-2xl font-bold text-muted">/mo</span>
            </p>
            <p className="mt-6 max-w-xl text-[15px] leading-7 text-muted">
              Scoring, the confirmation queue, export, and delete. Your TabPFN, Gemma, ElevenLabs, and SerpApi keys if you want them. This build does not take a card.
            </p>
          </div>
          <div className="border-t border-line p-8 sm:p-12 lg:border-l lg:border-t-0">
            <DemoButton className="btn-go" label="Open the demo shop" />
          </div>
        </div>
      </div>
    </section>
  );
}

const FAQS: [string, string][] = [
  ['Does this charge ₹499?', 'No. The plan is the suggested price; this build takes no card and runs the full product.'],
  ['What leaves the shop?', 'Nothing you don\u2019t choose. Scores compute from your orders; only the pincode and address text you submit go to the scoring service, and you can delete everything any time.'],
  ['How does it learn my shop?', 'Upload delivered and returned orders, or open the demo shop. TabPFN trains in context on that history; a cold shop starts on a rules prior, then scikit-learn, and the screen always names which one ran.'],
  ['Is the pincode the verdict?', 'No. Pincode and address quality are features, not verdicts — courier context, never a judgment on a region or its people.'],
];

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="relative border-t border-line">
      <div className="mx-auto max-w-page px-5 py-24 sm:px-8 sm:py-32">
        <Eyebrow data-scramble>/FAQ/</Eyebrow>
        <h2 data-reveal className="statement mt-6 text-[clamp(2rem,5vw,4.5rem)]">Questions.</h2>
        <div data-reveal className="mt-12">
          {FAQS.map(([q, a], i) => (
            <div key={q} className="faq-item">
              <button
                type="button"
                onClick={() => setOpen(open === i ? -1 : i)}
                className="flex w-full items-center justify-between gap-6 py-6 text-left"
                aria-expanded={open === i}
              >
                <span className="font-display text-xl font-bold tracking-tight sm:text-2xl">{q}</span>
                <span className="grid h-10 w-10 shrink-0 place-items-center border border-line text-white">
                  {open === i ? <Minus size={16} /> : <Plus size={16} />}
                </span>
              </button>
              {open === i && <p className="max-w-3xl pb-8 text-[15px] leading-7 text-muted">{a}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Ticker() {
  const items = ['SCORE 0–100', 'LOW · MEDIUM · HIGH', '₹150 PER RETURN', 'PHONE STAYS IN THE SHOP', '₹499 / MONTH', 'NO CARD CHECKOUT'];
  const row = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-line py-4" aria-hidden="true">
      <div className="marquee-track gap-12" data-velocity-marquee>
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-12 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.24em] text-muted">
            {t} <span className="text-signal">●</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Landing() {
  useMarketingMotion(true);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width - 0.5) * 20}px`);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <div className="relative bg-black text-white">
      <SiteHeader />
      <OrderRain columns={9} />

      {/* HERO */}
      <section ref={heroRef} className="relative flex min-h-screen flex-col justify-end overflow-hidden pb-16 pt-36">
        <div data-hero-scan className="pointer-events-none absolute inset-y-0 w-[2px] bg-go opacity-0 shadow-[0_0_32px_4px_rgba(0,230,118,0.55)]" aria-hidden="true" />
        <div className="relative mx-auto w-full max-w-page px-5 sm:px-8">
          <p data-hero-item data-scramble className="font-mono text-sm tracking-[0.1em] text-white">/Introducing/</p>
          <h1 className="wordmark mt-6 text-[clamp(4.5rem,15vw,14rem)]" aria-label="RTO Shield">
            <span className="reveal-mask"><span data-hero-line className="reveal-line">RTO</span></span>
            <span className="reveal-mask"><span data-hero-line className="reveal-line">SHIELD</span></span>
          </h1>
          <div data-hero-item className="mt-8 flex flex-wrap gap-3">
            <LabelChip>COD risk intelligence</LabelChip>
            <LabelChip>Built for Bharat</LabelChip>
          </div>
          <div className="mt-12 grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
            <div>
              <p data-hero-item className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                The complete COD Risk Score.
              </p>
              <p data-hero-item className="mt-5 max-w-xl text-lg leading-8 text-muted">
                80% of COD losses come from orders your rules can't see.{' '}
                <strong className="text-white">RTO Shield reads all of it</strong> — every order, every address,
                every pattern — turning checkout data into a ship-or-stop insight.
              </p>
              <div data-hero-item className="mt-8 flex flex-wrap gap-4">
                <DemoButton className="btn-go" label="Open the demo shop" />
                <a data-magnetic href="#gap" className="btn-ghost">
                  See how it works <ArrowRight size={14} />
                </a>
              </div>
            </div>
            <div data-hero-item className="panel">
              <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
                  <span className="live-dot" /> Live scan
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Simulated</span>
              </div>
              <LiveScan />
            </div>
          </div>
        </div>
      </section>

      <Ticker />

      <Statement>
        An unscored order<br />is a <span className="text-signal">gamble.</span>
      </Statement>

      <DataGap />

      <Statement>
        The signal is<br />in the <span className="text-signal">patterns.</span>
      </Statement>

      <Pillars />

      <Statement>
        Predict returns<br />before they <span className="text-signal">happen.</span>
      </Statement>

      <TryModel />
      <WhatsAppChapter />
      <Pricing />
      <Faq />

      {/* FOOTER */}
      <footer className="relative border-t border-line">
        <div className="overflow-hidden py-10" aria-hidden="true">
          <div className="marquee-track" data-velocity-marquee>
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} className="wordmark whitespace-nowrap pr-16 text-[clamp(4rem,10vw,9rem)] text-white/[0.07]">
                RTO SHIELD
              </span>
            ))}
          </div>
        </div>
        <div className="mx-auto max-w-page px-5 pb-12 sm:px-8">
          <p className="statement text-3xl sm:text-4xl">Stop the bleed.</p>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-6 border-t border-line pt-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
              The complete COD Risk Score · Built for Bharat
            </p>
            <div className="flex gap-8">
              <Link href="/login" className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted transition hover:text-white">Log in</Link>
              <Link href="/privacy" className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted transition hover:text-white">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function LiveScan() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 2600);
    return () => window.clearInterval(id);
  }, []);
  const feed = [
    ['S1042', 'LOW', '12', 'go'],
    ['S1047', 'HIGH', '78', 'red'],
    ['S1049', 'HIGH', '84', 'red'],
    ['S1051', 'MED', '51', 'banana'],
    ['S1055', 'LOW', '22', 'go'],
  ] as const;
  const rows = [0, 1, 2].map((i) => feed[(tick + i) % feed.length]);
  return (
    <div key={tick}>
      {rows.map(([id, band, score, tone]) => (
        <div key={id} className="datarow !px-5">
          <span className="text-white/80">{id}</span>
          <span className="flex items-center gap-4">
            <Flag tone={tone as 'red' | 'banana' | 'go'}>{band}</Flag>
            <span className="font-display text-xl font-extrabold tabular-nums">{score}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
