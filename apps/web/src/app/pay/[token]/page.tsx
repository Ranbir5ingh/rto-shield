import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Pay · RTO Shield' };

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const safe = /^[A-Za-z0-9_-]{16,80}$/.test(token);
  const target = safe ? await loadPay(token) : { url: '', discountPct: 0 };
  const discount = Number(target.discountPct) || 0;
  const url = target.url.startsWith('https://') && !target.url.includes('/pay/') ? target.url : '';

  return (
    <main className="min-h-dvh bg-paper px-4 py-16 text-ink">
      <article className="mx-auto max-w-md border-2 border-ink bg-paper p-6 shadow-[6px_6px_0_0_#1B1712]">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]">RTO Shield</p>
        <h1 className="mt-3 font-display text-4xl font-black uppercase tracking-tight">Pay this order</h1>
        {discount > 0 ? (
          <p className="mt-4 border-2 border-ink bg-lime px-4 py-3 font-display text-2xl font-black">{discount}% off when you pay now.</p>
        ) : (
          <p className="mt-4 text-[15px] leading-7">Pay now and this cash-on-delivery order is replaced.</p>
        )}
        {url ? (
          <>
            <a className="mt-6 inline-flex border-2 border-ink bg-lime px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.12em] shadow-[3px_3px_0_0_#1B1712]" href={url}>
              Continue to checkout
            </a>
            <script dangerouslySetInnerHTML={{ __html: `setTimeout(function(){location.assign(${JSON.stringify(url)})},1600)` }} />
          </>
        ) : (
          <p className="mt-6 text-[15px] leading-7">This demo link has no live invoice.</p>
        )}
      </article>
    </main>
  );
}

async function loadPay(token: string) {
  const api = process.env.API_URL || 'http://127.0.0.1:4000';
  try {
    const response = await fetch(`${api}/api/pay/${encodeURIComponent(token)}`, { cache: 'no-store' });
    if (!response.ok) return { url: '', discountPct: 0 };
    const body = (await response.json()) as { url?: unknown; discountPct?: unknown };
    return {
      url: typeof body.url === 'string' ? body.url : '',
      discountPct: typeof body.discountPct === 'number' ? body.discountPct : 0,
    };
  } catch {
    return { url: '', discountPct: 0 };
  }
}
