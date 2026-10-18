import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';

export default function TermsPage() {
  return (
    <div>
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-5 pb-28 pt-16 sm:px-8 md:pb-16 md:pt-32">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">Terms</p>
        <h1 className="mt-3 font-display font-medium text-display-2">How the shop uses RTO Shield</h1>
        <div className="mt-8 space-y-5 text-base leading-7 text-ink/80">
          <p>
            RTO Shield scores orders you upload. A score is an estimate for your shop, not a promise that an order will
            or will not return, and not a judgment on a buyer or a place.
          </p>
          <p>
            Autopilot can message the buyer and place a call. WhatsApp goes out from RTO Shield’s number, with the
            shop’s name on the template, unless the shop turns on its own number. A score is not a promise, and
            cancelling or shipping stays the shop’s decision. Exceptions is where a stopped order gets one extra call.
          </p>
          <p>
            The suggested price is ₹499 a month. This build does not take a card. Demo shops are filled with synthetic
            orders, not real buyers.
          </p>
          <p>
            You can export or delete your orders from Settings. Phone numbers stay in your shop and are not sent to the
            scoring vendors. See the <Link href="/privacy" className="underline">privacy note</Link> for what leaves the
            account.
          </p>
        </div>
      </div>
    </div>
  );
}
