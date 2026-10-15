'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from './ui';
import {
  WAKE_GRACE_MS,
  WAKE_TIMEOUT_MS,
  formatElapsed,
  probeWake,
  routeNeedsApi,
  wakeDelayMs,
  wakeMessage,
  wakeProgress,
  type WakeSnapshot,
} from '@/lib/wake';

const EMPTY: WakeSnapshot = { api: false, ml: false };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function WakeScreen({
  message,
  elapsedLabel,
  progress,
  failed,
  onRetry,
}: {
  message: string;
  elapsedLabel: string;
  progress: number;
  failed: boolean;
  onRetry: () => void;
}) {
  const percent = Math.round(progress * 100);
  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-16">
      <div className="panel w-full max-w-md p-8">
        <p className="font-deva text-sm text-ink/60">आरटीओ शील्ड</p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-saffron">Free hosting</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">RTO Shield</h1>
        <div className="mt-4" role="status" aria-live="polite" aria-busy={!failed}>
          <p className="text-lg leading-7 text-ink/80">{failed ? 'The servers did not wake in time.' : message}</p>
        </div>
        <div
          className="mt-6 h-2 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={failed ? percent : percent}
          aria-label="Server wake-up"
        >
          <div
            className="h-full rounded-full bg-saffron motion-reduce:transition-none transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-3 text-sm tabular-nums text-ink/60">Elapsed {elapsedLabel}</p>
        {failed ? (
          <div className="mt-6">
            <p className="mb-4 text-sm leading-6 text-ink/70">
              The API or the risk model stayed quiet. Free servers nap after 15 minutes, and a cold start can take
              about a minute. Nothing was sent to a buyer.
            </p>
            <Button type="button" onClick={onRetry} autoFocus>
              Try again
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function WakeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const needsApi = routeNeedsApi(pathname);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<'checking' | 'ready' | 'failed'>('checking');
  const [snap, setSnap] = useState<WakeSnapshot>(EMPTY);
  const [elapsed, setElapsed] = useState(0);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    setPhase('checking');
    setSnap(EMPTY);
    setElapsed(0);
    setArmed(false);
    const grace = setTimeout(() => {
      if (!cancelled) setArmed(true);
    }, WAKE_GRACE_MS);
    const clock = setInterval(() => {
      if (!cancelled) setElapsed(Date.now() - started);
    }, 1000);

    async function run() {
      let n = 0;
      while (!cancelled) {
        if (Date.now() - started > WAKE_TIMEOUT_MS) {
          clearInterval(clock);
          setPhase('failed');
          return;
        }
        const next = await probeWake();
        if (cancelled) return;
        setSnap(next);
        setElapsed(Date.now() - started);
        if (next.api && next.ml) {
          clearInterval(clock);
          setPhase('ready');
          return;
        }
        await sleep(wakeDelayMs(n));
        n += 1;
      }
    }

    void run();
    return () => {
      cancelled = true;
      clearTimeout(grace);
      clearInterval(clock);
    };
  }, [attempt]);

  const block = needsApi && phase !== 'ready' && (phase === 'failed' || armed);
  if (!block) return children;

  return (
    <WakeScreen
      message={wakeMessage(elapsed, snap.api)}
      elapsedLabel={formatElapsed(elapsed)}
      progress={wakeProgress(elapsed, snap)}
      failed={phase === 'failed'}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}
