'use client';

import { useEffect } from 'react';

export interface PincodeView {
  pincode: string;
  region: string | null;
  locality: string | null;
  state: string | null;
  snippets: Array<{ title: string; snippet?: string }>;
  notice: string | null;
  fairness: string;
}

export type PincodeStatus = 'loading' | 'ready' | 'error';

export function PincodeCheck({ status, view }: { status: PincodeStatus; view?: PincodeView | null }) {
  useEffect(() => {
    document.getElementById('pincode-check')?.scrollIntoView({ block: 'center', behavior: 'auto' });
  }, [status, view?.pincode, view?.locality]);

  const place = [view?.locality, view?.state || view?.region].filter(Boolean).join(' · ');

  return (
    <section
      id="pincode-check"
      data-pincode-result="true"
      aria-live="polite"
      className="mt-4 border-2 border-ink bg-paper p-4 shadow-sticker-sm"
    >
      <p className="eyebrow">Check pincode</p>
      {status === 'loading' ? <p className="mt-2 text-sm leading-6">Checking this pincode…</p> : null}
      {status === 'error' ? <p className="mt-2 text-sm leading-6">This pincode did not load.</p> : null}
      {status === 'ready' && view ? (
        <div className="mt-2 space-y-2">
          <p className="font-display text-2xl font-black tracking-tight">{view.pincode}</p>
          <p className="text-sm leading-6">{place || 'Area on file.'}</p>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-inksoft">Context only. Not a score and not a ban.</p>
          {view.notice ? <p className="text-sm leading-6 text-ink/70">{view.notice}</p> : null}
          {view.snippets.slice(0, 2).length ? (
            <ul className="space-y-1">
              {view.snippets.slice(0, 2).map((item) => (
                <li key={item.title} className="text-sm leading-6 text-ink/80">{item.title}</li>
              ))}
            </ul>
          ) : null}
          <p className="text-sm leading-6 text-ink/70">{view.fairness}</p>
        </div>
      ) : null}
    </section>
  );
}
