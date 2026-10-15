import Link from 'next/link';

const steps = [
  {
    n: '01',
    title: 'Teach it your shop',
    body: 'Upload past orders with a delivered or RTO outcome. Shopify export, a Meesho-style sheet, or the generic template. Or press “try with sample data” and skip the spreadsheet.',
  },
  {
    n: '02',
    title: 'Score today’s COD',
    body: 'Each pending order gets a score from 0 to 100, a Low / Medium / High band, and a sentence a packer can act on. Address quality from Gemma is a feature. The pincode is not.',
  },
  {
    n: '03',
    title: 'Confirm before you ship',
    body: 'High and medium orders land in a queue with a WhatsApp click-to-chat link, a prepaid nudge, and a Hindi voice script. You send it. Nothing is auto-messaged. The reply feeds the next score.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <Link href="/" className="font-display text-2xl tracking-tight">
          RTO Shield
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium">
          <a href="#pricing" className="hidden sm:inline">
            Pricing
          </a>
          <Link href="/privacy" className="hidden sm:inline">
            Privacy
          </Link>
          <Link href="/login">Log in</Link>
          <Link href="/signup" className="rounded-full bg-navy px-4 py-2 text-white">
            Start
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-end gap-10 px-5 pb-16 pt-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-saffron">
              For Meesho, Instagram, WhatsApp, and small Shopify sellers
            </p>
            <h1 className="font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
              Stop paying ₹150 for every order that comes back.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-ink/80">
              RTO Shield scores cash-on-delivery orders before they leave the packing table, then gives you a
              confirmation in Hindi, Hinglish, or English. Built for shops doing about 20 to 500 orders a day.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="rounded-full bg-saffron px-5 py-3 font-semibold text-white">
                Try it on sample orders
              </Link>
              <a href="#how" className="rounded-full border border-line bg-white px-5 py-3 font-semibold">
                See the three steps
              </a>
            </div>
            <p className="mt-4 text-sm text-ink/60">Suggested price ₹499/month. This open-source build does not charge a card.</p>
          </div>
          <aside className="rounded-3xl border border-line bg-card p-6 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink/50">Example, not a promise</p>
            <p className="mt-3 font-display text-3xl leading-tight">40 COD orders a day. 8 come back.</p>
            <p className="mt-3 text-ink/75">
              At ₹150 reverse shipping, that is ₹1,200 a day. Stopping a handful of those pays for ₹499 many times
              over. Your number lives on the dashboard, using the cost you set.
            </p>
            <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
              {[
                ['₹150', 'default cost / RTO'],
                ['0–100', 'risk score'],
                ['0 keys', 'required to start'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl bg-paper px-2 py-3">
                  <dt className="font-display text-2xl">{value}</dt>
                  <dd className="mt-1 text-xs text-ink/60">{label}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </section>

        <section id="how" className="border-y border-line bg-white/70">
          <div className="mx-auto grid max-w-6xl gap-6 px-5 py-14 md:grid-cols-3">
            {steps.map((step) => (
              <article key={step.n}>
                <p className="font-display text-3xl text-saffron">{step.n}</p>
                <h2 className="mt-2 font-display text-2xl">{step.title}</h2>
                <p className="mt-3 text-sm leading-6 text-ink/75">{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-4xl">Why the models are open</h2>
            <ul className="mt-6 space-y-4 text-sm leading-6 text-ink/80">
              <li>
                <strong className="text-ink">Buyer data stays yours.</strong> Phone numbers never go to TabPFN, Gemma,
                SerpApi, or ElevenLabs. Addresses are scored by Gemma only if you opt in, and Ollama on your own
                machine is the privacy-max path.
              </li>
              <li>
                <strong className="text-ink">No per-order model bill on the default path.</strong> With no API keys the
                scorer is scikit-learn on your history, running locally. TabPFN and Gemini are optional upgrades.
              </li>
              <li>
                <strong className="text-ink">Small data is the point.</strong> TabPFN trains in-context on this shop’s
                orders, which is the right shape when you have hundreds of rows, not millions.
              </li>
              <li>
                <strong className="text-ink">A pincode is not a ban.</strong> Courier context can be shown for a PIN.
                It is not a model feature, and the product will not tell you to refuse a region.
              </li>
            </ul>
          </div>
          <div className="rounded-3xl bg-navy p-6 text-paper">
            <p className="text-xs uppercase tracking-[0.16em] text-paper/60">What the packer sees</p>
            <div className="mt-4 rounded-2xl bg-white/10 p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">S1042 · ₹1,599 COD</p>
                <span className="rounded-full bg-[#9f2d2d] px-2 py-0.5 text-xs font-semibold">High · 78</span>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-paper/85">
                <li>Cash on delivery from a first-time buyer</li>
                <li>Address is only a landmark, with no house number</li>
                <li>Placed late at night, when buyers confirm less often</li>
              </ul>
              <p className="mt-4 text-sm text-paper/70">WhatsApp draft in Hinglish, ready to open. Nothing is sent until you tap.</p>
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-5 pb-16">
          <div className="rounded-3xl border border-line bg-card p-8 shadow-card md:flex md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-4xl">₹499 / month</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-ink/75">
                The suggested price for a hosted shop: scoring, the confirmation queue, export, and delete. Hosted
                TabPFN, AI Studio, ElevenLabs, and SerpApi keys are yours if you want them — they are not required,
                and they are not resold here. Billing is not wired in this open-source build.
              </p>
            </div>
            <Link href="/signup" className="mt-6 inline-block rounded-full bg-navy px-5 py-3 font-semibold text-white md:mt-0">
              Create a shop login
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-5 py-8 text-sm text-ink/60">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3">
          <p>RTO Shield. MIT licensed. Open-source AI for COD sellers.</p>
          <Link href="/privacy">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
