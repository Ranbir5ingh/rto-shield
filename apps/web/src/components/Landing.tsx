'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Minus, Plus } from 'lucide-react';
import { DemoButton } from '@/components/DemoButton';
import { LogoMark } from '@/components/Logo';
import { OrderRain } from '@/components/OrderRain';
import { SiteHeader } from '@/components/SiteHeader';
import { DoodleArrow, DoodleStar, Eyebrow, Flag, LabelChip, Tape } from '@/components/ui';
import { useMarketingMotion } from '@/components/useMarketingMotion';

function Statement({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className="relative mx-auto max-w-page px-5 py-24 sm:px-8 sm:py-36">
      <DoodleStar className="doodle-star absolute left-[8%] top-16 h-8 w-8 rotate-12" />
      <p data-scrub-words className={`statement text-[clamp(2.2rem,6.5vw,5.5rem)] ${className}`}>
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
      <div className={`absolute inset-0 ${isOver ? 'bg-white' : 'bg-paper'} p-8 sm:p-12`}>
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-ink">
            {isOver ? 'What RTO Shield sees' : 'What your rules see'}
          </p>
          <LabelChip>{isOver ? 'Complete view' : 'Fragmented view'}</LabelChip>
        </div>
        <div className="mt-8">
          {rows.map((row) => {
            const [id, amt, pay, pin] = row;
            const flag = row[4] as string | undefined;
            return (
              <div key={id} className="datarow">
                <span className={isOver && flag !== 'CLEAR' ? 'font-bold text-ink' : 'text-inksoft'}>
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
        <p className="mt-8 max-w-md font-mono text-xs leading-6 text-inksoft">
          {isOver
            ? 'The same four orders — with every hidden pattern surfaced before the tape gun comes out.'
            : 'Four orders. Four parcels packed. Two of them are already lost — and nothing on this screen says so.'}
        </p>
      </div>
    );
  };

  return (
    <section id="gap" className="relative">
      <div className="mx-auto max-w-page px-5 py-24 sm:px-8 sm:py-32">
        <Eyebrow data-scramble>/The problem/</Eyebrow>
        <h2 data-scrub-words className="statement mt-6 text-[clamp(2rem,5vw,4.5rem)]">
          Closing the<br />data gap.
        </h2>

        <div data-wipe className="sticker relative mt-16 h-[600px] overflow-hidden sm:h-[560px]">
          <Tape className="-top-3 left-1/2 -translate-x-1/2 rotate-2" />
          {panel('under')}
          <div data-wipe-over className="absolute inset-0">
            {panel('over')}
          </div>
          <div
            data-wipe-scan
            className="pointer-events-none absolute inset-y-0 w-[3px] bg-risk shadow-[0_0_28px_4px_rgba(255,59,48,0.5)]"
            aria-hidden="true"
          />
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-inksoft">
            Scroll — the signal scans
          </p>
        </div>
      </div>
    </section>
  );
}

function Pillars() {
  const items = [
    ['01', 'Score every order', 'Each pending order gets 0–100, a Low, Medium, or High band, and a plain sentence saying why. Address quality is a feature. The pincode is courier context — never a verdict on a region.', 'bg-hl/50', '-rotate-1'],
    ['02', 'Confirm the risky ones', 'Risky orders wait in a queue with a WhatsApp link and a draft in Hindi, Hinglish, or English. You send the message — the product never does.', 'bg-sky/40', 'rotate-1'],
    ['03', 'Ship with proof', 'Confirmed teaches accepted. Cancelled teaches refused. Silence stays out of the next score. Every outcome makes the next prediction sharper.', 'bg-lime/40', '-rotate-1'],
  ];
  return (
    <section id="chapters" className="relative">
      <div className="mx-auto max-w-page px-5 py-24 sm:px-8 sm:py-32">
        <Eyebrow data-scramble>/How it works/</Eyebrow>
        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {items.map(([n, title, body, bg, tilt]) => (
            <div key={n} data-reveal className={`sticker sticker-hover relative ${tilt} p-8`}>
              <Tape className="-top-3 left-8 -rotate-6" pink={n === '02'} sky={n === '03'} />
              <span className={`inline-block px-3 py-1 font-mono text-sm font-bold tracking-[0.2em] ${bg} border-2 border-ink`}>{n}</span>
              <h3 className="statement mt-6 text-3xl">{title}</h3>
              <p className="mt-4 text-[15px] leading-7 text-inksoft">{body}</p>
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
    className: `border-2 border-ink px-5 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.18em] transition ${
      active ? 'bg-ink text-paper shadow-sticker-sm' : 'bg-white text-inksoft hover:text-ink'
    }`,
  });

  return (
    <section id="model" className="relative">
      <div className="mx-auto max-w-page px-5 py-24 sm:px-8 sm:py-32">
        <Eyebrow data-scramble>/Try the model/</Eyebrow>
        <h2 data-scrub-words className="statement mt-6 text-[clamp(2rem,5vw,4.5rem)]">
          Drag the levers.<br />Watch the verdict move.
        </h2>

        <div data-reveal className="sticker relative mt-16 grid lg:grid-cols-[1fr_320px]">
          <Tape className="-top-3 left-12 rotate-3" lime />
          <Tape className="-top-3 right-12 -rotate-2" pink />
          <div className="space-y-10 p-8 sm:p-12">
            <div>
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em]">Order value</p>
                <p className="bg-hl border-2 border-ink px-3 py-1 font-mono text-sm font-bold tabular-nums">₹{value.toLocaleString('en-IN')}</p>
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
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em]">Payment</p>
              <div className="mt-4 flex gap-3">
                <button type="button" {...seg(pay === 'cod')} onClick={() => setPay('cod')}>COD</button>
                <button type="button" {...seg(pay === 'prepaid')} onClick={() => setPay('prepaid')}>Prepaid</button>
              </div>
            </div>
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em]">Pincode</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {(['metro', 'town', 'remote'] as const).map((p) => (
                  <button key={p} type="button" {...seg(pin === p)} onClick={() => setPin(p)}>{p}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em]">Buyer</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {(['first', 'repeat', 'rto'] as const).map((b) => (
                  <button key={b} type="button" {...seg(buyer === b)} onClick={() => setBuyer(b)}>
                    {b === 'first' ? 'First order' : b === 'repeat' ? 'Repeat buyer' : 'Returned before'}
                  </button>
                ))}
              </div>
            </div>
            <p className="font-mono text-[11px] leading-6 text-inksoft">
              ILLUSTRATIVE — YOUR SHOP'S REAL SCORE TRAINS ON YOUR OWN HISTORY.
            </p>
          </div>
          <div className="flex flex-col items-center justify-center border-t-2 border-dashed border-ink/20 bg-paperdeep/60 p-8 sm:p-12 lg:border-l lg:border-t-0">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.28em]">Score</p>
            <p
              className={`mt-4 font-display text-[7rem] font-black tabular-nums leading-none ${
                band === 'High' ? 'text-risk' : band === 'Medium' ? 'text-ink' : 'text-ink'
              }`}
            >
              {score}
            </p>
            <div className="mt-5">
              {band === 'High' ? <Flag tone="red">High risk</Flag> : band === 'Medium' ? <Flag tone="banana">Medium risk</Flag> : <Flag tone="go">Low risk</Flag>}
            </div>
            <p className="mt-6 text-center font-mono text-xs leading-6 text-inksoft">
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
    <section className="relative">
      <div className="mx-auto max-w-page px-5 py-24 sm:px-8 sm:py-32">
        <Eyebrow data-scramble>/The confirmation/</Eyebrow>
        <h2 data-scrub-words className="statement mt-6 max-w-4xl text-[clamp(2rem,5vw,4.5rem)]">
          You send the message. Not us.
        </h2>
        <div className="mt-16 grid gap-8 lg:grid-cols-2">
          <div data-reveal className="sticker relative -rotate-1 p-8 sm:p-10">
            <Tape className="-top-3 left-10 rotate-6" sky />
            <p className="font-mono text-xs font-bold uppercase tracking-[0.22em]">The queue</p>
            <div className="mt-6">
              {[
                ['S1047 · ₹1,299', 'RTO RISK'],
                ['S1049 · ₹4,599', 'FAKE ADDRESS'],
                ['S1052 · ₹2,799', 'GHOST BUYER'],
              ].map(([id, flag]) => (
                <div key={id} className="datarow">
                  <span className="font-bold">{id}</span>
                  <Flag tone="red">{flag}</Flag>
                </div>
              ))}
            </div>
            <p className="mt-8 font-mono text-xs leading-6 text-inksoft">
              Medium and High orders wait here. One tap opens WhatsApp with the draft ready.
            </p>
          </div>
          <div data-reveal className="sticker relative rotate-1 bg-lime/25 p-8 sm:p-10">
            <Tape className="-top-3 right-10 -rotate-3" pink />
            <p className="font-mono text-xs font-bold uppercase tracking-[0.22em]">The draft — Hindi</p>
            <p className="mt-6 font-dev text-lg leading-8">
              नमस्ते! आपका ऑर्डर S1047 (₹1,299, COD) कन्फर्म करने के लिए मैसेज कर रहे हैं। कृपया YES लिखकर भेजें ताकि हम आज ही डिस्पैच कर सकें।
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <span className="label-chip">Hindi</span>
              <span className="label-chip">Hinglish</span>
              <span className="label-chip">English</span>
            </div>
            <p className="mt-8 font-mono text-xs leading-6 text-inksoft">
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
    <section id="pricing" className="relative">
      <div className="mx-auto max-w-page px-5 py-24 sm:px-8 sm:py-32">
        <Eyebrow data-scramble>/Pricing/</Eyebrow>
        <h2 data-scrub-words className="statement mt-6 text-[clamp(2rem,5vw,4.5rem)]">
          One plan.<br />No fine print.
        </h2>
        <div data-reveal className="sticker sticker-hover relative mt-16 grid lg:grid-cols-[1fr_auto] lg:items-center">
          <Tape className="-top-3 left-1/4 -rotate-2" />
          <Tape className="-top-3 right-1/4 rotate-3" pink />
          <div className="p-8 sm:p-12">
            <p className="font-display text-7xl font-black tabular-nums tracking-tight sm:text-8xl">
              <span className="hl">₹499</span><span className="text-2xl font-bold text-inksoft">/mo</span>
            </p>
            <p className="mt-6 max-w-xl text-[15px] leading-7 text-inksoft">
              Scoring, the confirmation queue, export, and delete. Your TabPFN, Gemma, ElevenLabs, and SerpApi keys if you want them. This build does not take a card.
            </p>
          </div>
          <div className="border-t-2 border-dashed border-ink/20 p-8 sm:p-12 lg:border-l lg:border-t-0">
            <DemoButton className="btn-go" label="Open the demo shop" />
          </div>
        </div>
        <p data-reveal className="hand mt-8 rotate-[-2deg] text-2xl text-inksoft">
          that's less than 4 returns. just saying →
        </p>
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
    <section id="faq" className="relative">
      <div className="mx-auto max-w-page px-5 py-24 sm:px-8 sm:py-32">
        <Eyebrow data-scramble>/FAQ/</Eyebrow>
        <h2 data-scrub-words className="statement mt-6 text-[clamp(2rem,5vw,4.5rem)]">Questions.</h2>
        <div data-reveal className="mt-12">
          {FAQS.map(([q, a], i) => (
            <div key={q} className={`sticker-sm mb-4 ${open === i ? '' : ''}`}>
              <button
                type="button"
                onClick={() => setOpen(open === i ? -1 : i)}
                className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left"
                aria-expanded={open === i}
              >
                <span className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">{q}</span>
                <span className="grid h-10 w-10 shrink-0 place-items-center border-2 border-ink bg-hl">
                  {open === i ? <Minus size={16} /> : <Plus size={16} />}
                </span>
              </button>
              {open === i && <p className="max-w-3xl px-6 pb-6 text-[15px] leading-7 text-inksoft">{a}</p>}
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
    <div className="relative -rotate-1 overflow-hidden border-y-2 border-ink bg-ink py-4" aria-hidden="true">
      <div className="marquee-track gap-12" data-velocity-marquee>
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-12 whitespace-nowrap font-mono text-[11px] font-bold uppercase tracking-[0.24em] text-paper">
            {t} <span className="text-hotpink">●</span>
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
    <div className="paper-grain relative bg-paper text-ink">
      <SiteHeader />
      <OrderRain columns={9} />

      {/* HERO */}
      <section ref={heroRef} className="relative flex min-h-screen flex-col justify-end overflow-hidden pb-16 pt-36">
        <div data-hero-scan className="pointer-events-none absolute inset-y-0 w-[3px] bg-risk opacity-0 shadow-[0_0_32px_4px_rgba(255,59,48,0.5)]" aria-hidden="true" />
        <DoodleStar className="doodle-star absolute right-[12%] top-28 h-10 w-10 rotate-12" />
        <DoodleStar className="absolute left-[6%] top-[42%] h-6 w-6 -rotate-12 text-sky" />
        <div className="relative mx-auto w-full max-w-page px-5 sm:px-8">
          <p data-hero-item data-scramble className="font-mono text-sm font-bold tracking-[0.1em]">/Introducing/</p>
          <h1 className="wordmark mt-6 text-[clamp(4rem,14vw,13rem)]" aria-label="RTO Shield">
            <span className="reveal-mask"><span data-hero-line className="reveal-line">RTO</span></span>
            <span className="reveal-mask"><span data-hero-line className="reveal-line"><span className="hl">SHIELD</span></span></span>
          </h1>
          <div data-hero-item className="mt-8 flex flex-wrap gap-3">
            <LabelChip>COD risk intelligence</LabelChip>
            <LabelChip>Built for Bharat</LabelChip>
          </div>
          <div className="mt-12 grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
            <div>
              <p data-hero-item className="font-display text-3xl font-black tracking-tight sm:text-4xl">
                The complete <span className="hl-pink hl">COD Risk Score.</span>
              </p>
              <p data-hero-item className="mt-5 max-w-xl text-lg leading-8 text-inksoft">
                80% of COD losses come from orders your rules can't see.{' '}
                <strong className="text-ink">RTO Shield reads all of it</strong> — every order, every address,
                every pattern — turning checkout data into a ship-or-stop insight.
              </p>
              <div data-hero-item className="mt-8 flex flex-wrap gap-4">
                <DemoButton className="btn-go" label="Open the demo shop" />
                <a data-magnetic href="#gap" className="btn-ghost">
                  See how it works <ArrowRight size={14} />
                </a>
              </div>
              <p data-hero-item className="hand mt-6 -rotate-2 text-2xl text-inksoft">
                psst — drag the levers below, it's fun →
              </p>
            </div>
            <div data-hero-item className="sticker relative rotate-2">
              <Tape className="-top-3 left-10 -rotate-6" />
              <Tape className="-top-3 right-10 rotate-3" pink />
              <div className="flex items-center justify-between border-b-2 border-dashed border-ink/20 px-5 py-3.5">
                <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em]">
                  <span className="live-dot" /> Live scan
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-inksoft">Simulated</span>
              </div>
              <LiveScan />
            </div>
          </div>
        </div>
        <DoodleArrow className="absolute bottom-24 right-[8%] hidden w-24 lg:block" />
      </section>

      <Ticker />

      <Statement>
        An unscored order<br />is a <span className="hl">gamble.</span>
      </Statement>

      <DataGap />

      <Statement>
        The signal is<br />in the <span className="hl-pink hl">patterns.</span>
      </Statement>

      <Pillars />

      <Statement>
        Predict returns<br />before they <span className="hl-lime hl">happen.</span>
      </Statement>

      <TryModel />
      <WhatsAppChapter />
      <Pricing />
      <Faq />

      {/* FOOTER */}
      <footer className="torn-t relative bg-ink text-paper">
        <div className="overflow-hidden py-10" aria-hidden="true">
          <div className="marquee-track" data-velocity-marquee>
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} className="wordmark whitespace-nowrap pr-16 text-[clamp(4rem,10vw,9rem)] text-paper/10">
                RTO SHIELD
              </span>
            ))}
          </div>
        </div>
        <div className="mx-auto max-w-page px-5 pb-12 sm:px-8">
          <div className="flex items-center gap-4">
            <LogoMark size={44} ink="#FAF6EE" pulse="#A3E635" />
            <p className="statement text-3xl text-paper sm:text-4xl">Stop the bleed.</p>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-6 border-t border-paper/20 pt-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-paper/60">
              The complete COD Risk Score · Built for Bharat
            </p>
            <div className="flex gap-8">
              <Link href="/login" className="font-mono text-[11px] uppercase tracking-[0.22em] text-paper/60 transition hover:text-paper">Log in</Link>
              <Link href="/privacy" className="font-mono text-[11px] uppercase tracking-[0.22em] text-paper/60 transition hover:text-paper">Privacy</Link>
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
    <div key={tick} className="px-2 py-2">
      {rows.map(([id, band, score, tone]) => (
        <div key={id} className="datarow !border-ink/10 px-3">
          <span className="font-bold">{id}</span>
          <span className="flex items-center gap-3">
            <Flag tone={tone as 'red' | 'banana' | 'go'}>{band}</Flag>
            <span className="font-display text-xl font-black tabular-nums">{score}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
