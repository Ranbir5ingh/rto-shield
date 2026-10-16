'use client';

import { useMemo, useState } from 'react';

/** Heuristic demo only — the real score comes from the shop's own history. */
function demoScore(value: number, cod: boolean, tier: number, history: number): number {
  let s = 18;
  s += Math.min(30, value / 120);
  if (cod) s += 22;
  s += tier * 9;
  s += [14, 4, -8][history] ?? 0;
  return Math.max(1, Math.min(99, Math.round(s)));
}

const bandOf = (s: number) => (s >= 65 ? 'HIGH' : s >= 40 ? 'MED' : 'LOW');
const bandColor = (s: number) => (s >= 65 ? 'text-danger' : s >= 40 ? 'text-warn' : 'text-lime');

export function RiskArcade() {
  const [value, setValue] = useState(1599);
  const [cod, setCod] = useState(true);
  const [tier, setTier] = useState(1);
  const [history, setHistory] = useState(0);

  const score = useMemo(() => demoScore(value, cod, tier, history), [value, cod, tier, history]);
  const band = bandOf(score);

  return (
    <div className="px-cut border-2 border-lime bg-panel shadow-px">
      <div className="flex items-center justify-between border-b-2 border-lime bg-void px-5 py-3">
        <span className="font-display text-lg font-bold text-lime">RISK SCANNER</span>
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 bg-pink" />
          <span className="h-2.5 w-2.5 bg-cyan" />
          <span className="h-2.5 w-2.5 bg-yellow" />
        </span>
      </div>

      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-7">
          <div>
            <div className="mb-2 flex justify-between font-mono text-xs font-bold uppercase tracking-widest text-muted">
              <span>Order value</span>
              <span className="text-ink">₹{value.toLocaleString('en-IN')}</span>
            </div>
            <input
              type="range"
              min={299}
              max={9999}
              step={100}
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              className="w-full accent-[#b4ff39]"
              aria-label="Order value"
            />
          </div>

          <div>
            <p className="mb-2 font-mono text-xs font-bold uppercase tracking-widest text-muted">Payment</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                [true, 'COD'],
                [false, 'Prepaid'],
              ].map(([v, label]) => (
                <button
                  key={label as string}
                  type="button"
                  onClick={() => setCod(v as boolean)}
                  className={`px-cut-sm border-2 px-4 py-3 font-display text-base font-bold transition ${
                    cod === v ? 'border-lime bg-lime text-void' : 'border-line bg-void text-muted hover:border-lime hover:text-ink'
                  }`}
                >
                  {label as string}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-xs font-bold uppercase tracking-widest text-muted">Pincode tier</p>
            <div className="grid grid-cols-3 gap-3">
              {['Metro', 'Town', 'Remote'].map((label, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setTier(i)}
                  className={`px-cut-sm border-2 px-4 py-3 font-display text-base font-bold transition ${
                    tier === i ? 'border-cyan bg-cyan text-void' : 'border-line bg-void text-muted hover:border-cyan hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-xs font-bold uppercase tracking-widest text-muted">Buyer history</p>
            <div className="grid grid-cols-3 gap-3">
              {['First order', 'Repeat buyer', 'Returned before'].map((label, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setHistory(i)}
                  className={`px-cut-sm border-2 px-3 py-3 font-display text-sm font-bold transition ${
                    history === i ? 'border-pink bg-pink text-void' : 'border-line bg-void text-muted hover:border-pink hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center border-2 border-dashed border-line bg-void p-6 text-center">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted">Score</p>
          <p className={`font-display text-8xl font-bold tabular-nums ${bandColor(score)}`} aria-live="polite">
            {score}
          </p>
          <p className={`risk-pill mt-3 ${bandColor(score)}`}>{band} risk</p>
          <p className="mt-4 font-mono text-xs leading-5 text-muted">
            {band === 'HIGH' && 'Hold the parcel. Confirm on WhatsApp first.'}
            {band === 'MED' && 'Worth a quick confirmation message.'}
            {band === 'LOW' && 'Ship it. This one looks safe.'}
          </p>
          <p className="mt-4 font-mono text-[10px] leading-4 text-muted/70">
            Demo heuristic. Your shop's real score learns from your own history.
          </p>
        </div>
      </div>
    </div>
  );
}
