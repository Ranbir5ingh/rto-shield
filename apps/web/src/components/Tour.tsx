'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { autoUpdate, computePosition, flip, hide, offset, shift, size } from '@floating-ui/dom';
import type { TourStep } from '@/lib/tours';
import { cardWidthFor, resolveTourFrame, type Rect, type TourFrame } from '@/components/tour-place';
import { freshRevealMemory, restoreTourUi, revealStep, stepOnPage, type RevealMemory } from '@/components/tour-reveal';

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: string;
}

const PAD = 8;

function visible(node: HTMLElement) {
  const rect = node.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  const style = getComputedStyle(node);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

/** The first anchor that is actually on screen. Hidden copies (the desktop pane on a phone) are skipped. */
function tourTarget(id: string) {
  if (!/^[a-z0-9-]+$/i.test(id)) return null;
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`);
  for (const node of nodes) {
    if (visible(node)) return node;
  }
  return null;
}

function pageReady() {
  const nodes = document.querySelectorAll('[data-tour-ready]');
  if (!nodes.length) return true;
  return [...nodes].every((node) => node.getAttribute('data-tour-ready') === 'true');
}

function measure(node: HTMLElement): Box | null {
  const rect = node.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return null;
  const radius = getComputedStyle(node).borderRadius || '0px';
  return {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
    radius,
  };
}

function targetRect(node: HTMLElement): Rect {
  const rect = node.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function chromeInset() {
  const dock = document.querySelector('[data-dock]');
  if (!dock) return { top: 12, bottom: 12 };
  const rect = dock.getBoundingClientRect();
  if (rect.top < window.innerHeight / 2) return { top: Math.max(12, rect.bottom + 8), bottom: 12 };
  return { top: 12, bottom: Math.max(12, window.innerHeight - rect.top + 8) };
}

export function Tour({
  steps,
  onFinish,
  stepTimeoutMs = 8000,
}: {
  steps: TourStep[];
  onFinish: (reason: 'done' | 'skip') => void;
  /** How long a step may wait for its route or anchor before moving on. The card stays up the whole time. */
  stepTimeoutMs?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const titleId = useId();
  const bodyId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlocked = useRef(false);
  const revealMemory = useRef<RevealMemory>(freshRevealMemory());
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [frame, setFrame] = useState<TourFrame | null>(null);
  const [pin, setPin] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const voiceOnRef = useRef(true);
  const cleaned = useRef(false);
  voiceOnRef.current = voiceOn;
  const step = steps[index];
  const speakId = step?.narrationId || step?.id || '';

  useEffect(() => {
    const stored = window.localStorage.getItem('rto-tour-voice');
    const quiet = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setVoiceOn(stored ? stored === 'on' : !quiet);
  }, []);

  function stopVoice() {
    audioRef.current?.pause();
    audioRef.current = null;
  }

  function playVoice(id: string) {
    if (!voiceOnRef.current || !unlocked.current || !id) {
      stopVoice();
      return;
    }
    const current = audioRef.current;
    if (current && current.dataset.step === id && !current.paused) return;
    stopVoice();
    const audio = new Audio(`/api/tours/narration/${encodeURIComponent(id)}`);
    audio.dataset.step = id;
    audioRef.current = audio;
    try {
      void audio.play().catch(() => undefined);
    } catch {
      /* playback can fail before the browser returns a promise */
    }
  }

  function finish(reason: 'done' | 'skip') {
    stopVoice();
    const openedOrder = revealMemory.current.openedOrder;
    if (!cleaned.current) {
      cleaned.current = true;
      restoreTourUi(revealMemory.current);
      revealMemory.current = freshRevealMemory();
      if (openedOrder && window.matchMedia('(max-width: 1023px)').matches && window.location.pathname.startsWith('/app/orders/')) {
        router.push('/app/queue');
      }
    }
    onFinish(reason);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      finish('skip');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onFinish, router]);

  useEffect(() => {
    return () => {
      stopVoice();
      if (!cleaned.current) {
        cleaned.current = true;
        restoreTourUi(revealMemory.current);
      }
    };
  }, []);

  useEffect(() => {
    const onGesture = (event: PointerEvent) => {
      unlocked.current = true;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('#tour-card')) return;
      playVoice(speakId);
    };
    window.addEventListener('pointerdown', onGesture, { once: true });
    return () => window.removeEventListener('pointerdown', onGesture);
  }, [speakId, voiceOn]);

  useEffect(() => {
    if (!unlocked.current) return;
    playVoice(speakId);
  }, [speakId, voiceOn]);

  useEffect(() => {
    if (!step) return;

    let cancelled = false;
    let locked = false;
    let pushed = false;
    let poll = 0;
    const started = performance.now();
    const memory = revealMemory.current;

    const giveUp = () => {
      if (cancelled || locked) return;
      locked = true;
      if (index >= steps.length - 1) onFinish('done');
      else setIndex(index + 1);
    };

    const seek = () => {
      if (cancelled || locked) return;
      window.clearTimeout(poll);
      const elapsed = performance.now() - started;
      if (elapsed >= stepTimeoutMs) {
        giveUp();
        return;
      }
      const again = () => {
        const wait = Math.min(80, Math.max(0, stepTimeoutMs - (performance.now() - started)));
        poll = window.setTimeout(seek, wait);
      };
      const mobile = window.matchMedia('(max-width: 1023px)').matches;
      if (!stepOnPage(step, pathname || '', mobile)) {
        setBox(null);
        setFrame(null);
        if (!pushed) {
          const row = mobile && step.reveal?.includes('order')
            ? document.querySelector<HTMLElement>('[data-tour-row="1"]')
            : null;
          if (row) {
            pushed = true;
            memory.openedOrder = true;
            row.click();
          } else if (window.location.pathname !== step.route) {
            pushed = true;
            router.push(step.route);
          }
        }
        again();
        return;
      }
      if (!pageReady()) {
        again();
        return;
      }
      revealStep(step, mobile, memory);
      const node = tourTarget(step.id);
      const next = node ? measure(node) : null;
      if (!node || !next) {
        again();
        return;
      }
      locked = true;
      const tall = next.height > window.innerHeight * 0.7;
      node.scrollIntoView?.({
        block: tall ? 'start' : 'nearest',
        inline: 'nearest',
        behavior: 'auto',
      });
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (cancelled) return;
        const settled = measure(node);
        if (!settled) {
          locked = false;
          poll = window.setTimeout(seek, 80);
          return;
        }
        setBox(settled);
        setPin((n) => n + 1);
      }));
    };

    const observer = new MutationObserver(() => {
      if (!cancelled) seek();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-tour', 'data-tour-ready', 'class', 'style', 'aria-expanded', 'aria-selected'],
    });
    seek();

    return () => {
      cancelled = true;
      observer.disconnect();
      window.clearTimeout(poll);
    };
  }, [index, onFinish, pathname, router, step, stepTimeoutMs, steps.length]);

  useEffect(() => {
    if (!step) return;
    const mobileNow = window.matchMedia('(max-width: 1023px)').matches;
    if (!stepOnPage(step, pathname || '', mobileNow)) return;
    const node = tourTarget(step.id);
    const cardEl = cardRef.current;
    if (!node || !cardEl) return;
    let last = '';

    const place = () => {
      const next = measure(node);
      if (!next) return;
      const width = cardWidthFor(window.innerWidth);
      const inset = chromeInset();
      const boundary = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
      const apply = (nextFrame: TourFrame) => {
        const key = `${nextFrame.mode}:${Math.round(next.top)}:${Math.round(next.left)}:${Math.round(nextFrame.top)}:${Math.round(nextFrame.left)}:${Math.round(nextFrame.maxHeight)}`;
        if (key === last) return;
        last = key;
        setBox(next);
        setFrame(nextFrame);
      };
      const finish = (placed: { x: number; y: number } | null, referenceHidden: boolean) => {
        const rect = cardEl.getBoundingClientRect();
        apply(resolveTourFrame({
          viewport: { width: window.innerWidth, height: window.innerHeight },
          inset,
          target: targetRect(node),
          card: { width, height: Math.max(rect.height, cardEl.scrollHeight, 220) },
          placed,
          referenceHidden,
          mobile: window.innerWidth < 768,
        }));
      };
      void computePosition(node, cardEl, {
        strategy: 'fixed',
        placement: window.innerWidth < 768 ? 'top' : 'bottom',
        middleware: [
          offset(12),
          flip({ padding: 12, boundary, rootBoundary: 'viewport', fallbackPlacements: ['top', 'bottom', 'right', 'left'] }),
          shift({ padding: 12, boundary, rootBoundary: 'viewport', crossAxis: true }),
          size({
            padding: 12,
            boundary,
            rootBoundary: 'viewport',
            apply({ availableWidth, availableHeight, elements }) {
              const room = Math.max(0, window.innerHeight - inset.top - inset.bottom);
              const cap = Math.min(room, Math.max(0, availableHeight));
              Object.assign(elements.floating.style, {
                maxWidth: `${Math.min(width, Math.max(0, availableWidth))}px`,
                maxHeight: `${cap}px`,
              });
            },
          }),
          hide({ strategy: 'referenceHidden', boundary, rootBoundary: 'viewport' }),
        ],
      }).then((pos) => {
        finish({ x: pos.x, y: pos.y }, Boolean(pos.middlewareData.hide?.referenceHidden));
      }).catch(() => {
        finish(null, false);
      });
    };

    return autoUpdate(node, cardEl, place);
  }, [index, pathname, pin, step]);

  useEffect(() => {
    const cardEl = document.getElementById('tour-card');
    if (!cardEl) return;
    const focusable = () => [...cardEl.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
    focusable()[focusable().length - 1]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        unlocked.current = true;
        if (index >= steps.length - 1) finish('done');
        else {
          const next = steps[index + 1];
          setIndex(index + 1);
          if (next) playVoice(next.narrationId || next.id);
        }
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setIndex((current) => Math.max(0, current - 1));
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = focusable();
      if (!nodes.length) return;
      const first = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        lastNode.focus();
      } else if (!event.shiftKey && document.activeElement === lastNode) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, onFinish, steps.length]);

  if (!step) return null;
  const onPage = stepOnPage(step, pathname || '', typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches);
  const spotlight = Boolean(box && frame && onPage);
  const last = index === steps.length - 1;
  const width = frame?.width ?? (typeof window === 'undefined' ? 352 : cardWidthFor(window.innerWidth));

  return (
    <div className="pointer-events-none fixed inset-0 z-[218]" data-tour-overlay="true">
      {spotlight && box ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute border-2 border-ink motion-safe:transition-[top,left,width,height] motion-safe:duration-300 motion-reduce:transition-none"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            borderRadius: box.radius,
            boxShadow: '0 0 0 9999px rgba(27, 23, 18, 0.62)',
          }}
        />
      ) : (
        <div aria-hidden="true" className="pointer-events-auto absolute inset-0 bg-ink/45" />
      )}
      <div
        ref={cardRef}
        id="tour-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-tour-mode={frame?.mode || 'pending'}
        className="sticker pointer-events-auto fixed flex flex-col overflow-hidden p-0 opacity-100"
        style={{
          top: frame?.top ?? 16,
          left: frame?.left ?? 16,
          width,
          maxHeight: frame?.maxHeight ?? 320,
        }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-2">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-inksoft">
            Step {index + 1} of {steps.length}
          </p>
          <h2 id={titleId} className="mt-2 font-display text-2xl">
            {step.title}
          </h2>
          <p id={bodyId} className="mt-2 text-sm leading-6 text-ink/80">
            {step.body}
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5" aria-hidden="true">
            {steps.map((item, dot) => (
              <span key={`${item.id}-${dot}`} className={`h-2 w-2 border border-ink ${dot === index ? 'bg-ink' : 'bg-paper'}`} />
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-t-2 border-ink px-5 py-3">
          <button type="button" className="btn-ghost" onClick={() => finish('skip')}>
            Skip
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-ghost"
              aria-pressed={!voiceOn}
              onClick={() => {
                unlocked.current = true;
                const next = !voiceOn;
                voiceOnRef.current = next;
                setVoiceOn(next);
                window.localStorage.setItem('rto-tour-voice', next ? 'on' : 'off');
                if (!next) stopVoice();
                else playVoice(speakId);
              }}
            >
              {voiceOn ? 'Mute' : 'Voice'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                unlocked.current = true;
                const nextIndex = Math.max(0, index - 1);
                const next = steps[nextIndex];
                setIndex(nextIndex);
                if (next) playVoice(next.narrationId || next.id);
              }}
              disabled={index === 0}
            >
              Back
            </button>
            <button
              type="button"
              className="btn-go"
              onClick={() => {
                unlocked.current = true;
                if (last) {
                  stopVoice();
                  finish('done');
                  return;
                }
                const next = steps[index + 1];
                setIndex(index + 1);
                if (next) playVoice(next.narrationId || next.id);
              }}
            >
              {last ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
