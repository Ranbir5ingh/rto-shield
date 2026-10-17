'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from './ui';
import {
  WAKE_GRACE_MS,
  WAKE_TIMEOUT_MS,
  formatElapsed,
  hostShouldGate,
  initialWake,
  loadWakeSession,
  nextWakeSession,
  probeWake,
  resetWakeHolds,
  routeNeedsApi,
  saveWakeSession,
  stepWake,
  wakeMessage,
  wakeProgress,
  type WakeSession,
  type WakeSnapshot,
} from '@/lib/wake';

const EMPTY: WakeSnapshot = { api: false, ml: false };
const EXIT_FALLBACK_MS = 700;

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function WakeScreen({
  message,
  elapsedLabel,
  progress,
  failed,
  apiUp,
  mlUp,
  leaving = false,
  onRetry,
  onExitEnd,
}: {
  message: string;
  elapsedLabel: string;
  progress: number;
  failed: boolean;
  apiUp: boolean;
  mlUp: boolean;
  leaving?: boolean;
  onRetry: () => void;
  onExitEnd?: () => void;
}) {
  const percent = Math.round(progress * 100);
  return (
    <div
      className={`wake-overlay fixed inset-0 z-[210] flex items-center justify-center px-5 ${leaving ? 'wake-overlay-leave' : 'wake-overlay-enter'}`}
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget || event.animationName !== 'wake-out') return;
        onExitEnd?.();
      }}
    >
      <div className="w-full max-w-lg">
        <p className="eyebrow text-ink">RTO Shield</p>
        <h1 className="statement mt-3 text-5xl text-ink sm:text-6xl">Getting the servers ready</h1>
        <p className="mt-4 max-w-md font-mono text-sm leading-6 text-ink/80" role="status" aria-live="polite" aria-busy={!failed}>
          {failed ? 'The servers did not wake in time.' : message}
        </p>
        <div className="sticker mt-8 bg-white p-5">
          <ul>
            <StatusLine label="API" ready={apiUp} />
            <StatusLine label="Risk model" ready={mlUp} />
          </ul>
          <div
            className="mt-2 h-3 border-2 border-ink bg-white"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Server wake-up"
          >
            <div className="h-full bg-lime motion-reduce:transition-none transition-[width] duration-500" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink/70">Elapsed {elapsedLabel}</p>
        </div>
        {failed ? (
          <div className="mt-6">
            <p className="mb-4 text-sm leading-6 text-ink/75">
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

function StatusLine({ label, ready }: { label: string; ready: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 border-t-2 border-dashed border-ink/15 py-3 first:border-t-0">
      <span className="eyebrow">{label}</span>
      <span className="inline-flex items-center font-mono text-[11px] font-bold uppercase tracking-[0.16em]">
        <span className={`mr-2 inline-block h-2.5 w-2.5 border-2 border-ink ${ready ? 'bg-lime' : 'animate-blink bg-hl motion-reduce:animate-none'}`} aria-hidden="true" />
        {ready ? 'Up' : 'Waking'}
      </span>
    </li>
  );
}

export function WakeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const needsApi = routeNeedsApi(pathname);
  const [attempt, setAttempt] = useState(0);
  const [session, setSession] = useState<WakeSession>(() => {
    const current = loadWakeSession();
    return current === 'exiting' ? saveWakeSession('done') : current;
  });
  const [snap, setSnap] = useState<WakeSnapshot>(EMPTY);
  const [elapsed, setElapsed] = useState(0);
  const [gateHost, setGateHost] = useState(false);
  const armed = useRef(false);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const commit = useCallback((next: WakeSession) => {
    setSession(saveWakeSession(next));
  }, []);

  useEffect(() => {
    setGateHost(hostShouldGate(window.location.hostname));
  }, []);

  useEffect(() => {
    if (loadWakeSession() === 'done') {
      commit('done');
      return;
    }
    let cancelled = false;
    const started = Date.now();
    const clock = setInterval(() => {
      if (!cancelled) setElapsed(Date.now() - started);
    }, 1000);
    const grace = window.setTimeout(() => {
      if (cancelled || loadWakeSession() === 'done' || loadWakeSession() === 'exiting') return;
      armed.current = true;
      const gate = routeNeedsApi(pathnameRef.current) || hostShouldGate(window.location.hostname);
      if (!gate) return;
      commit(nextWakeSession(loadWakeSession(), { type: 'show' }));
    }, WAKE_GRACE_MS);

    async function run() {
      let machine = initialWake();
      while (!cancelled) {
        const probe = await probeWake();
        if (cancelled) return;
        const stepped = stepWake(machine, probe, Date.now() - started);
        machine = stepped.machine;
        setSnap(machine.snap);
        setElapsed(machine.elapsedMs);
        if (machine.phase === 'ready') {
          clearInterval(clock);
          const current = loadWakeSession();
          commit(
            nextWakeSession(current, {
              type: 'ready',
              overlayVisible: current === 'waking' || current === 'failed',
              reducedMotion: prefersReducedMotion(),
            }),
          );
          return;
        }
        if (machine.phase === 'failed' || Date.now() - started > WAKE_TIMEOUT_MS) {
          clearInterval(clock);
          commit(nextWakeSession(loadWakeSession(), { type: 'fail' }));
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
  }, [attempt, commit]);

  useEffect(() => {
    if (!(needsApi || gateHost) || !armed.current) return;
    if (loadWakeSession() !== 'idle') return;
    commit(nextWakeSession('idle', { type: 'show' }));
  }, [needsApi, gateHost, commit]);

  useEffect(() => {
    if (session !== 'exiting') return;
    if (prefersReducedMotion()) {
      commit('done');
      return;
    }
    const timer = window.setTimeout(() => {
      if (loadWakeSession() === 'exiting') commit('done');
    }, EXIT_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [session, commit]);

  function finishExit() {
    if (loadWakeSession() !== 'exiting') return;
    commit(nextWakeSession('exiting', { type: 'exit-end' }));
  }

  function retry() {
    const next = nextWakeSession(loadWakeSession(), { type: 'retry' });
    if (next !== 'waking') return;
    setSnap(EMPTY);
    setElapsed(0);
    commit(next);
    setAttempt((value) => value + 1);
  }

  const showOverlay = session === 'waking' || session === 'exiting' || session === 'failed';
  const showPage = session === 'idle' || session === 'exiting' || session === 'done';

  return (
    <>
      <div style={{ display: showPage ? 'contents' : 'none' }}>{showPage ? children : null}</div>
      {showOverlay ? (
        <WakeScreen
          key="wake"
          message={wakeMessage(elapsed, snap.api)}
          elapsedLabel={formatElapsed(elapsed)}
          progress={wakeProgress(elapsed, snap)}
          failed={session === 'failed'}
          apiUp={snap.api}
          mlUp={snap.ml}
          leaving={session === 'exiting'}
          onRetry={retry}
          onExitEnd={finishExit}
        />
      ) : null}
    </>
  );
}
