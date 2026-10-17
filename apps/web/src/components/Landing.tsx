'use client';

import Link from 'next/link';
import { inr } from '@/lib/format';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { DemoButton } from '@/components/DemoButton';
import { LogoMark } from '@/components/Logo';
import { OrderRain } from '@/components/OrderRain';
import { SiteHeader } from '@/components/SiteHeader';
import { DoodleArrow, DoodleStar, Eyebrow, Flag, LabelChip, Tape } from '@/components/ui';
import { useMarketingMotion } from '@/components/useMarketingMotion';
import gsap from 'gsap';

/** Jagged starburst sticker with centered content. */
function Starburst({ className = '', children }: { className?: string; children: React.ReactNode }) {
  const pts = Array.from({ length: 36 }, (_, i) => {
    const a = (i / 36) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 49 : 39;
    return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  return (
    <div className={`relative ${className}`} aria-hidden="true">
      <svg viewBox="0 0 100 100" className="burst-wiggle h-full w-full">
        <polygon points={pts} fill="#FF4D8D" stroke="#1B1712" strokeWidth="2.2" strokeLinejoin="round" />
      </svg>
      <div className="absolute inset-0 grid place-items-center p-[22%] text-center">{children}</div>
    </div>
  );
}

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
          {items.map(([n, title, body, bg, tilt], i) => (
            <div key={n} data-reveal="fan" data-delay={(i * 0.12).toFixed(2)} className={`sticker sticker-hover relative ${tilt} p-8`}>
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
  const stampRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const firstBand = useRef(true);

  let score = 18;
  if (pay === 'cod') score += 22;
  if (pin === 'town') score += 12;
  if (pin === 'remote') score += 20;
  if (buyer === 'first') score += 14;
  if (buyer === 'rto') score += 30;
  if (value > 3000) score += 8;
  score = Math.max(3, Math.min(97, score));
  const band = score >= 65 ? 'High' : score >= 40 ? 'Medium' : 'Low';

  // Stamp slam: every time the verdict band changes, a rubber stamp slams down.
  useEffect(() => {
    if (firstBand.current) {
      firstBand.current = false;
      if (stampRef.current) gsap.set(stampRef.current, { rotation: -12 });
      return;
    }
    if (!stampRef.current) return;
    gsap
      .timeline()
      .fromTo(
        stampRef.current,
        { scale: 2.6, rotation: -26, autoAlpha: 0 },
        { scale: 1, rotation: -12, autoAlpha: 1, duration: 0.3, ease: 'power4.in' }
      )
      .to(stampRef.current, { scale: 1.08, duration: 0.1, ease: 'power2.out' })
      .to(stampRef.current, { scale: 1, duration: 0.16, ease: 'power2.inOut' });
    if (cardRef.current) {
      gsap.fromTo(cardRef.current, { x: 0 }, { x: 5, duration: 0.05, repeat: 3, yoyo: true, clearProps: 'x' });
    }
  }, [band]);

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

        <div ref={cardRef} data-reveal className="sticker relative mt-16 grid lg:grid-cols-[1fr_320px]">
          <Tape className="-top-3 left-12 rotate-3" lime />
          <Tape className="-top-3 right-12 -rotate-2" pink />
          <div className="space-y-10 p-8 sm:p-12">
            <div>
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em]">Order value</p>
                <p className="bg-hl border-2 border-ink px-3 py-1 font-mono text-sm font-bold tabular-nums" suppressHydrationWarning>
                  {inr(value)}
                </p>
              </div>
              <input
                type="range"
                min={299}
                max={9999}
                step={100}
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className="lever mt-5"
                data-cursor="drag"
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
          <div className="relative flex flex-col items-center justify-center overflow-hidden border-t-2 border-dashed border-ink/20 bg-paperdeep/60 p-8 sm:p-12 lg:border-l lg:border-t-0">
            <div className="pointer-events-none absolute inset-x-0 top-8 z-10 flex justify-center">
              <div ref={stampRef} className="stamp px-5 py-2">
                <span className="font-display text-2xl font-black uppercase tracking-tight">
                  {band === 'High' ? 'High risk' : band === 'Medium' ? 'Medium' : 'Ship it'}
                </span>
              </div>
            </div>
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
          <div data-reveal="pop" className="sticker relative -rotate-1 p-8 sm:p-10">
            <Tape className="-top-3 left-10 rotate-6" sky />
            <p className="font-mono text-xs font-bold uppercase tracking-[0.22em]">The queue</p>
            <div className="mt-6">
              {[
                ['S1047 · ₹1,299', 'RTO RISK'],
                ['S1049 · ₹4,599', 'FAKE ADDRESS'],
                ['S1052 · ₹2,799', 'GHOST BUYER'],
              ].map(([id, flag], i) => (
                <div key={id} data-reveal="slap" data-delay={(i * 0.1).toFixed(2)} className="datarow">
                  <span className="font-bold">{id}</span>
                  <Flag tone="red">{flag}</Flag>
                </div>
              ))}
            </div>
            <p className="mt-8 font-mono text-xs leading-6 text-inksoft">
              Medium and High orders wait here. One tap opens WhatsApp with the draft ready.
            </p>
          </div>
          <div data-reveal="pop" data-delay="0.15" className="sticker relative rotate-1 bg-lime/25 p-8 sm:p-10">
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
        <div data-reveal="pop" className="sticker sticker-hover relative mt-16 grid lg:grid-cols-[1fr_auto] lg:items-center">
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
            <DemoButton className="btn-go" label="Try the demo" />
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
            <div key={q} data-open={open === i ? '1' : '0'} className="faq-item sticker-sm mb-4">
              <button
                type="button"
                onClick={() => setOpen(open === i ? -1 : i)}
                className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left"
                aria-expanded={open === i}
              >
                <span className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">{q}</span>
                <span className="faq-icon grid h-10 w-10 shrink-0 place-items-center border-2 border-ink bg-white">
                  <Plus size={16} />
                </span>
              </button>
              <div className="faq-a">
                <div>
                  <p className="faq-inner max-w-3xl px-6 pb-6 text-[15px] leading-7 text-inksoft">{a}</p>
                </div>
              </div>
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
    if (!el || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const layers = Array.from(el.querySelectorAll<HTMLElement>('[data-depth]')).map((n) => ({
      x: gsap.quickTo(n, 'x', { duration: 0.7, ease: 'power2.out' }),
      y: gsap.quickTo(n, 'y', { duration: 0.7, ease: 'power2.out' }),
      depth: parseFloat(n.dataset.depth || '0'),
    }));
    const card = el.querySelector<HTMLElement>('[data-tilt]');
    if (card) gsap.set(card, { transformPerspective: 900 });
    const rX = card ? gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power2.out' }) : null;
    const rY = card ? gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power2.out' }) : null;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      layers.forEach((l) => {
        l.x(nx * l.depth);
        l.y(ny * l.depth);
      });
      if (card && rX && rY) {
        const cr = card.getBoundingClientRect();
        const cx = (e.clientX - cr.left) / cr.width - 0.5;
        const cy = (e.clientY - cr.top) / cr.height - 0.5;
        rX(-cy * 12);
        rY(cx * 14);
      }
    };
    const onLeave = () => {
      layers.forEach((l) => {
        l.x(0);
        l.y(0);
      });
      rX?.(0);
      rY?.(0);
    };
    el.addEventListener('mousemove', onMove, { passive: true });
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div className="paper-grain relative bg-paper text-ink">
      <SiteHeader />
      <OrderRain columns={9} />

      {/* HERO */}
      <section ref={heroRef} className="relative flex min-h-screen flex-col justify-end overflow-hidden pb-16 pt-36">
        <div data-hero-scan className="pointer-events-none absolute inset-y-0 w-[3px] bg-risk opacity-0 shadow-[0_0_32px_4px_rgba(255,59,48,0.5)]" aria-hidden="true" />

        {/* parallax doodle layers (outer = parallax, inner = idle float) */}
        <div data-depth="40" className="absolute right-[9%] top-24 hidden sm:block" aria-hidden="true">
          <img src="/doodles/doodle-star.png" alt="" className="doodle floaty w-12" style={{ '--rot': '12deg' } as React.CSSProperties} />
        </div>
        <div data-depth="24" className="absolute left-[3%] top-[36%] hidden sm:block" aria-hidden="true">
          <img src="/doodles/doodle-arrow-curve.png" alt="" className="doodle floaty w-24 sm:w-32" style={{ '--rot': '-8deg' } as React.CSSProperties} />
        </div>
        <div data-depth="52" className="absolute bottom-[38%] right-[3%] hidden md:block" aria-hidden="true">
          <img src="/doodles/doodle-lightning.png" alt="" className="doodle floaty w-10" style={{ '--rot': '6deg' } as React.CSSProperties} />
        </div>
        <div data-depth="18" className="absolute bottom-28 left-[44%] hidden lg:block" aria-hidden="true">
          <img src="/doodles/doodle-spiral.png" alt="" className="doodle floaty w-16 opacity-70" />
        </div>
        <div data-depth="30" className="absolute right-[1%] top-[46%] hidden xl:block" aria-hidden="true">
          <img src="/doodles/shield-mascot.png" alt="/Shield mascot" className="doodle floaty w-44" style={{ '--rot': '4deg' } as React.CSSProperties} />
        </div>

        {/* starburst slam */}
        <div data-hero-starburst className="absolute left-[52%] top-28 z-10 hidden w-40 md:block lg:left-[56%] lg:w-48" aria-hidden="true">
          <Starburst>
            <span className="hand text-xl leading-tight text-white lg:text-2xl">most RTO is predictable!</span>
          </Starburst>
        </div>

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
                <DemoButton className="btn-go" label="Try the demo" />
                <a data-magnetic data-cursor="view" href="#gap" className="btn-ghost">
                  See how it works <ArrowRight size={14} />
                </a>
              </div>
              <p data-hero-item className="hand mt-6 -rotate-2 text-2xl text-inksoft">
                psst — drag the levers below, it's fun →
              </p>
            </div>
            <div data-hero-item className="rotate-2">
              <div data-tilt data-cursor="view" className="sticker relative">
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

      <section className="relative">
        <div className="mx-auto max-w-page px-5 py-24 sm:px-8 sm:py-32">
          <p data-scrub="highlight" className="statement max-w-5xl text-[clamp(2.2rem,6vw,5.5rem)]">
            Predict returns before they happen. Score every order, confirm the risky ones, ship the rest with proof.
          </p>
          <p className="hand mt-8 rotate-[-2deg] text-2xl text-inksoft">watch the words get marked up as you scroll ↓</p>
        </div>
      </section>

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
              <Link href="/guides/whatsapp" className="font-mono text-[11px] uppercase tracking-[0.22em] text-paper/60 transition hover:text-paper">WhatsApp guide</Link>
              <Link href="/privacy" className="font-mono text-[11px] uppercase tracking-[0.22em] text-paper/60 transition hover:text-paper">Privacy</Link>
              <Link href="/terms" className="font-mono text-[11px] uppercase tracking-[0.22em] text-paper/60 transition hover:text-paper">Terms</Link>
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
