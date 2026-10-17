'use client';

import { useEffect, useId, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { TourStep } from '@/lib/tours';

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

function reducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function tourTarget(id: string) {
  if (!/^[a-z0-9-]+$/i.test(id)) return null;
  return document.querySelector<HTMLElement>(`[data-tour="${id}"]`);
}

function measure(id: string): Box | null {
  const node = tourTarget(id);
  if (!node) return null;
  const rect = node.getBoundingClientRect();
  const pad = 8;
  return {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

function cardStyle(box: Box | null): React.CSSProperties {
  const width = Math.min(352, window.innerWidth - 32);
  if (!box) {
    return { top: '18vh', left: '50%', width, transform: 'translateX(-50%)' };
  }
  let left = box.left;
  if (left + width > window.innerWidth - 16) left = window.innerWidth - width - 16;
  left = Math.max(16, left);
  const below = box.top + box.height + 14;
  const top = below + 230 < window.innerHeight ? below : Math.max(16, box.top - 230);
  return { top, left, width };
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
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const step = steps[index];

  useEffect(() => {
    if (!step || step.route === pathname) return;
    router.push(step.route);
  }, [step, pathname, router]);

  useEffect(() => {
    if (!step || step.route !== pathname) return;
    let attempts = 0;
    let timer = 0;
    let scrolled = false;
    const place = () => {
      const next = measure(step.id);
      if (!next) {
        attempts += 1;
        if (attempts < 80) {
          timer = window.setTimeout(place, 50);
          return;
        }
      } else if (!scrolled) {
        scrolled = true;
        tourTarget(step.id)?.scrollIntoView?.({
          block: 'nearest',
          inline: 'nearest',
          behavior: reducedMotion() ? 'auto' : 'smooth',
        });
      }
      setBox(next);
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [step, pathname]);

  useEffect(() => {
    const card = document.getElementById('tour-card');
    if (!card) return;
    const focusable = () => [...card.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
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
  }, [index, onFinish, steps.length]);

  if (!step) return null;
  const last = index === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[218]" data-tour-overlay="true">
      {box ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute border-2 border-ink motion-safe:transition-[top,left,width,height] motion-safe:duration-300 motion-reduce:transition-none"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            boxShadow: '0 0 0 9999px rgba(27, 23, 18, 0.62)',
          }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-ink/60" />
      )}
      <div
        id="tour-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="sticker absolute p-5 motion-safe:transition-[top,left] motion-safe:duration-300 motion-reduce:transition-none"
        style={cardStyle(box)}
      >
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-inksoft">
          Step {index + 1} of {steps.length}
        </p>
        <h2 id={titleId} className="mt-2 font-display text-2xl">
          {step.title}
        </h2>
        <p id={bodyId} className="mt-2 text-sm leading-6 text-ink/80">
          {step.body}
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
