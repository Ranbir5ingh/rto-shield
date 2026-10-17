'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';
import type { TourStep } from '@/lib/tours';

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: string;
}

interface CardPos {
  top: number;
  left: number;
  transform: string;
}

const PAD = 8;
const SEEK_MS = 4500;
const DATA_MS = 12000;

function reducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

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

function cardWidth() {
  return Math.min(352, window.innerWidth - 24);
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
  const [card, setCard] = useState<CardPos | null>(null);
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
      setCard(null);
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
        node?.scrollIntoView?.({
          block: 'center',
          inline: 'nearest',
          behavior: reducedMotion() ? 'auto' : 'smooth',
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
      const rect = node.getBoundingClientRect();
      const huge = rect.width * rect.height > window.innerWidth * window.innerHeight * 0.55;
      const width = cardWidth();
      const apply = (pos: CardPos) => {
        const key = `${Math.round(next.top)}:${Math.round(next.left)}:${Math.round(next.width)}:${Math.round(next.height)}:${Math.round(pos.top)}:${Math.round(pos.left)}:${pos.transform}`;
        if (key === last) return;
        last = key;
        setBox(next);
        setCard(pos);
      };
      if (huge) {
        apply({ top: window.innerHeight / 2, left: window.innerWidth / 2, transform: 'translate(-50%, -50%)' });
        return;
      }
      void computePosition(node, cardEl, {
        strategy: 'fixed',
        placement: 'bottom',
        middleware: [offset(16), flip({ padding: 12 }), shift({ padding: 12 })],
      }).then((pos) => {
        const cardRect = cardEl.getBoundingClientRect();
        const overlaps = !(
          pos.x + width <= rect.left - 8
          || pos.x >= rect.right + 8
          || pos.y + cardRect.height <= rect.top - 8
          || pos.y >= rect.bottom + 8
        );
        apply(overlaps
          ? { top: window.innerHeight / 2, left: window.innerWidth / 2, transform: 'translate(-50%, -50%)' }
          : { top: pos.y, left: pos.x, transform: 'none' });
      }).catch(() => {
        apply({ top: window.innerHeight / 2, left: window.innerWidth / 2, transform: 'translate(-50%, -50%)' });
      });
    };

    return autoUpdate(node, cardEl, place);
  }, [index, pathname, pin, shown, step]);

  useEffect(() => {
    if (!card || shown !== index) return;
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
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [card, index, onFinish, shown, steps.length]);

  if (!step) return null;
  const onPage = step.route === pathname;
  const ready = Boolean(box && card && onPage && shown === index);
  const copy = steps[shown] || step;
  const last = index === steps.length - 1;
  const width = typeof window === 'undefined' ? 352 : cardWidth();

  return (
    <div className="fixed inset-0 z-[218]" data-tour-overlay="true">
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
        className={`sticker absolute p-5 motion-safe:transition-[top,left,opacity] motion-safe:duration-300 motion-reduce:transition-none ${
          ready ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{
          top: card?.top ?? -9999,
          left: card?.left ?? 16,
          width,
          transform: card?.transform ?? 'none',
        }}
      >
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
        <div className="mt-4 flex items-center justify-between gap-2">
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
