'use client';

import Link from 'next/link';
import { DemoButton } from './DemoButton';
import { useMarketingMotion } from './useMarketingMotion';

const chapters = [
  {
    kicker: '01 · Teach',
    title: 'The shop’s own history, not a national average.',
    body: 'Upload delivered and returned orders, or open the demo shop. TabPFN trains in context on this ledger. A cold shop falls back to a rules prior, then to scikit-learn, and the screen names which one ran.',
  },
  {
    kicker: '02 · Score',
    title: 'A number a packer can act on before the parcel leaves.',
    body: 'Each pending COD order gets 0–100, a Low, Medium, or High band, and a plain sentence. Address quality is a feature. The pincode is courier context, never a ban and never a model input.',
  },
  {
    kicker: '03 · Confirm',
    title: 'You send the message. Nothing is auto-fired.',
    body: 'High and medium orders wait in a queue with a WhatsApp link, a prepaid nudge, and a Hindi script. Confirmed teaches “accepted”. Cancelled teaches “refused”. Silence is left out of the next score.',
  },
];

export function Landing() {
  useMarketingMotion(true);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-page items-center justify-between px-5 py-4">
          <Link href="/" className="leading-none">
            <span className="block font-display text-2xl tracking-tight">RTO Shield</span>
            <span className="font-deva text-sm text-ink/70">आरटीओ शील्ड</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <a href="#story" className="hidden sm:inline">
              How it works
            </a>
            <Link href="/privacy" className="hidden sm:inline">
              Privacy
            </Link>
            <Link href="/login">Log in</Link>
            <Link href="/signup" className="rounded-full bg-navy px-4 py-2 text-white">
              Start a shop
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-page items-end gap-12 px-5 pb-20 pt-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-saffron">Meesho · Instagram · WhatsApp · small Shopify</p>
            <h1 data-split className="mt-4 font-display text-display-1 text-ink">
              Stop paying ₹150 for every order that comes back.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-ink/80">
              Score cash-on-delivery orders before they leave the packing table. Confirm the risky ones in Hindi, Hinglish, or English. Built for shops doing about 20 to 500 orders a day.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <DemoButton />
              <Link href="/signup" className="rounded-full border border-line bg-card px-5 py-3 text-sm font-semibold">
                Create your own login
              </Link>
            </div>
            <p className="mt-4 max-w-md text-sm text-ink/60">
              The demo shop is synthetic, isolated, and already scored. Suggested price ₹499/month. This build does not charge a card.
            </p>
          </div>
          <aside className="panel p-6" data-reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/50">A day at Asha Studio · example</p>
            <p className="mt-3 font-display text-4xl leading-tight">40 COD orders. 8 come back.</p>
            <p className="mt-3 text-ink/75">
              At ₹150 reverse shipping, that is ₹1,200 before lunch. Stopping a handful covers a ₹499 month. Your dashboard uses the cost you set.
            </p>
            <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
              {[
                ['₹150', 'default / RTO'],
                ['0–100', 'risk score'],
                ['0 keys', 'to start'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl bg-paper px-2 py-3">
                  <dt className="font-display text-2xl">{value}</dt>
                  <dd className="mt-1 text-xs text-ink/60">{label}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </section>

        <section id="story" data-story className="border-y border-line bg-navy text-paper">
          <div className="mx-auto grid min-h-[80vh] max-w-page items-center gap-10 px-5 py-16 lg:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-paper/60">One parcel, three decisions</p>
              <h2 className="mt-3 font-display text-display-2">From the sheet to the tape gun.</h2>
            </div>
            <div className="relative min-h-[280px]">
              {chapters.map((chapter, index) => (
                <article
                  key={chapter.kicker}
                  data-frame
                  className={`rounded-3xl border border-white/10 bg-white/5 p-6 ${index === 0 ? 'relative' : 'absolute inset-0 opacity-0'}`}
                >
                  <p className="text-xs uppercase tracking-[0.16em] text-saffron">{chapter.kicker}</p>
                  <h3 className="mt-3 font-display text-3xl leading-tight">{chapter.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-paper/80">{chapter.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-page gap-10 px-5 py-20 lg:grid-cols-2">
          <div data-reveal>
            <h2 className="font-display text-display-2">Open models, on purpose.</h2>
            <ul className="mt-6 space-y-5 text-sm leading-7 text-ink/80">
              <li>
                <strong className="text-ink">The phone stays in the shop.</strong> It is encrypted at rest and masked in lists. It is not sent to TabPFN, Gemma, SerpApi, or ElevenLabs.
              </li>
              <li>
                <strong className="text-ink">Gemma reads the address, not the buyer.</strong> Ollama on your machine is the privacy-max path. AI Studio is the hosted open-weight option. No key means local rules.
              </li>
              <li>
                <strong className="text-ink">A pincode is not a verdict.</strong> Courier notes can sit beside an order. They are not a feature in the score, and the product will not tell you to refuse a region.
              </li>
            </ul>
          </div>
          <div className="panel bg-navy p-6 text-paper" data-reveal>
            <p className="text-xs uppercase tracking-[0.16em] text-paper/60">What the packer sees</p>
            <div className="mt-4 rounded-2xl bg-white/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">S1042 · ₹1,599 COD</p>
                <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-semibold">High · 78</span>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-paper/85">
                <li>Cash on delivery from a first-time buyer</li>
                <li>Address is only a landmark, with no house number</li>
                <li>Placed late at night, when buyers confirm less often</li>
              </ul>
              <p className="mt-4 text-sm text-paper/70">Hinglish draft, ready for WhatsApp. Nothing leaves until you tap.</p>
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-page px-5 pb-20">
          <div className="panel flex flex-col justify-between gap-6 p-8 md:flex-row md:items-center" data-reveal>
            <div>
              <h2 className="font-display text-display-2">₹499 / month</h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-ink/75">
                The suggested price for a hosted shop: scoring, the confirmation queue, export, and delete. TabPFN, Gemma, ElevenLabs, and SerpApi keys are yours if you want them. They are not required, and they are not resold here.
              </p>
            </div>
            <DemoButton />
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-5 py-8 text-sm text-ink/60">
        <div className="mx-auto flex max-w-page flex-wrap justify-between gap-3">
          <p>RTO Shield. MIT licensed. Open-source AI for COD sellers.</p>
          <Link href="/privacy">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
