'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from './ui';
import {
  WAKE_GRACE_MS,
  WAKE_TIMEOUT_MS,
  formatElapsed,
  hostShouldGate,
  initialWake,
  probeWake,
  resetWakeHolds,
  routeNeedsApi,
  stepWake,
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
  leaving = false,
  onRetry,
}: {
  message: string;
  elapsedLabel: string;
  progress: number;
  failed: boolean;
  leaving?: boolean;
  onRetry: () => void;
}) {
  const percent = Math.round(progress * 100);
  return (
    <div className={`wake-screen fixed inset-0 z-[70] flex items-center justify-center bg-canvas px-6 ${leaving ? 'is-leaving' : ''}`}>
      <div className="w-full max-w-lg">
        <p className="text-xs uppercase tracking-[0.22em] text-muted">RTO Shield</p>
        <h1 className="mt-4 font-display font-medium text-display-2">Getting the servers ready</h1>
        <div className="mt-6" role="status" aria-live="polite" aria-busy={!failed}>
          <p className="text-base leading-7 text-muted">{failed ? 'The servers did not wake in time.' : message}</p>
        </div>
        <div
          className="mt-8 h-px bg-line"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Server wake-up"
        >
          <div
            className="h-px bg-accent motion-reduce:transition-none transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-3 text-xs uppercase tracking-[0.16em] text-muted">Elapsed {elapsedLabel}</p>
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
  const [shown, setShown] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [gateHost, setGateHost] = useState(false);

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
      let machine = initialWake();
      while (!cancelled) {
        const probe = await probeWake();
        if (cancelled) return;
        const stepped = stepWake(machine, probe, Date.now() - started);
        machine = stepped.machine;
        setSnap(machine.snap);
        setElapsed(machine.elapsedMs);
        setPhase(machine.phase);
        if (machine.phase !== 'checking') {
          clearInterval(clock);
          return;
        }
        if (Date.now() - started > WAKE_TIMEOUT_MS) {
          clearInterval(clock);
          setPhase('failed');
          return;
        }
        await sleep(stepped.waitMs);
      }
    }

    void run();
    return () => {
      cancelled = true;
      clearTimeout(grace);
      clearInterval(clock);
      resetWakeHolds();
    };
  }, [attempt]);

  useEffect(() => {
    setGateHost(hostShouldGate(window.location.hostname));
  }, []);

  const block = (needsApi || gateHost) && phase !== 'ready' && (phase === 'failed' || armed);

  useEffect(() => {
    if (block) {
      setShown(true);
      setLeaving(false);
      return;
    }
    if (!shown) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(false);
      return;
    }
    setLeaving(true);
    const timer = window.setTimeout(() => {
      setShown(false);
      setLeaving(false);
    }, 720);
    return () => window.clearTimeout(timer);
  }, [block, shown]);

  const screen = (
    <WakeScreen
      message={wakeMessage(elapsed, snap.api)}
      elapsedLabel={formatElapsed(elapsed)}
      progress={wakeProgress(elapsed, snap)}
      failed={phase === 'failed'}
      leaving={leaving}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );

  if (!shown) return children;
  if (block && !leaving) return screen;
  return (
    <>
      {children}
      {screen}
    </>
  );
}
