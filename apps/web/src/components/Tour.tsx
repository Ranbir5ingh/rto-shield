'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { autoUpdate, computePosition, flip, hide, offset, shift, size } from '@floating-ui/dom';
import type { TourStep } from '@/lib/tours';
import { cardWidthFor, resolveTourFrame, type Rect, type TourFrame } from '@/components/tour-place';

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: string;
}

const PAD = 8;
const SEEK_MS = 4500;
const DATA_MS = 12000;

function tourTarget(id: string) {
  if (!/^[a-z0-9-]+$/i.test(id)) return null;
  return document.querySelector<HTMLElement>(`[data-tour="${id}"]`);
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
}: {
  steps: TourStep[];
  onFinish: (reason: 'done' | 'skip') => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const titleId = useId();
  const bodyId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [frame, setFrame] = useState<TourFrame | null>(null);
  const [shown, setShown] = useState(0);
  const [pin, setPin] = useState(0);
  const skipped = useRef(new Set<number>());
  const step = steps[index];

  const skipStep = useCallback(() => {
    if (skipped.current.has(index)) {
      onFinish('done');
      return;
    }
    skipped.current.add(index);
    if (index >= steps.length - 1) onFinish('done');
    else setIndex(index + 1);
  }, [index, onFinish, steps.length]);

  useEffect(() => {
    if (!step) return;
    if (step.route !== pathname) {
      setBox(null);
      setFrame(null);
      router.push(step.route);
      return;
    }

    let cancelled = false;
    let scrolled = false;
    let locked = false;
    let poll = 0;
    const started = performance.now();

    const seek = () => {
      if (cancelled || locked) return;
      const elapsed = performance.now() - started;
      if (!pageReady()) {
        if (elapsed > DATA_MS) {
          skipStep();
          return;
        }
        poll = window.setTimeout(seek, 80);
        return;
      }
      const node = tourTarget(step.id);
      const next = node ? measure(node) : null;
      if (!next) {
        if (elapsed > SEEK_MS) {
          skipStep();
          return;
        }
        poll = window.setTimeout(seek, 80);
        return;
      }
      if (!scrolled) {
        scrolled = true;
        const tall = next.height > window.innerHeight * 0.7;
        node?.scrollIntoView?.({
          block: tall ? 'start' : 'nearest',
          inline: 'nearest',
          behavior: 'auto',
        });
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (cancelled || locked) return;
          const settled = node ? measure(node) : null;
          if (!settled) {
            scrolled = false;
            poll = window.setTimeout(seek, 80);
            return;
          }
          locked = true;
          setBox(settled);
          setShown(index);
          setPin((n) => n + 1);
        }));
        return;
      }
      locked = true;
      setBox(next);
      setShown(index);
      setPin((n) => n + 1);
    };

    const observer = new MutationObserver(() => {
      if (!cancelled) seek();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-tour', 'data-tour-ready', 'class', 'style'],
    });
    seek();

    return () => {
      cancelled = true;
      observer.disconnect();
      window.clearTimeout(poll);
    };
  }, [index, pathname, router, skipStep, step]);

  useEffect(() => {
    if (!step || shown !== index || step.route !== pathname) return;
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
  }, [index, pathname, pin, shown, step]);

  useEffect(() => {
    if (!frame || shown !== index) return;
    const cardEl = document.getElementById('tour-card');
    if (!cardEl) return;
    const focusable = () => [...cardEl.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
    focusable()[focusable().length - 1]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onFinish('skip');
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (index >= steps.length - 1) onFinish('done');
        else setIndex(index + 1);
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
  }, [frame, index, onFinish, shown, steps.length]);

  if (!step) return null;
  const onPage = step.route === pathname;
  const ready = Boolean(box && frame && onPage && shown === index);
  const copy = steps[shown] || step;
  const last = index === steps.length - 1;
  const width = frame?.width ?? (typeof window === 'undefined' ? 352 : cardWidthFor(window.innerWidth));

  return (
    <div className="pointer-events-none fixed inset-0 z-[218]" data-tour-overlay="true">
      {box && onPage ? (
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
        <div aria-hidden="true" className="absolute inset-0 bg-ink/25" />
      )}
      <div
        ref={cardRef}
        id="tour-card"
        role="dialog"
        aria-modal="true"
        aria-hidden={ready ? undefined : true}
        inert={ready ? undefined : true}
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-tour-mode={frame?.mode || 'pending'}
        className={`sticker pointer-events-auto fixed flex flex-col overflow-hidden p-0 motion-safe:transition-opacity motion-safe:duration-150 motion-reduce:transition-none ${
          ready ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{
          top: frame?.top ?? 16,
          left: frame?.left ?? 16,
          width,
          maxHeight: frame?.maxHeight ?? 320,
          visibility: ready ? 'visible' : 'hidden',
        }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-2">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-inksoft">
            Step {index + 1} of {steps.length}
          </p>
          <h2 id={titleId} className="mt-2 font-display text-2xl">
            {copy.title}
          </h2>
          <p id={bodyId} className="mt-2 text-sm leading-6 text-ink/80">
            {copy.body}
          </p>
          <div className="mt-4 flex gap-1.5" aria-hidden="true">
            {steps.map((item, dot) => (
              <span key={`${item.id}-${dot}`} className={`h-2 w-2 border border-ink ${dot === index ? 'bg-ink' : 'bg-paper'}`} />
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-t-2 border-ink px-5 py-3">
          <button type="button" className="btn-ghost" onClick={() => onFinish('skip')}>
            Skip
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => setIndex((current) => Math.max(0, current - 1))} disabled={index === 0}>
              Back
            </button>
            <button
              type="button"
              className="btn-go"
              onClick={() => {
                if (last) onFinish('done');
                else setIndex((current) => current + 1);
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
