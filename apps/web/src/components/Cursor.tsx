'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Hand-drawn custom cursor: an ink dot plus a dashed, slowly-spinning
 * ring that lerps behind it. Morphs on interactive targets —
 * grows on links/buttons, shows a label on [data-cursor="drag"|"view"],
 * and squashes on press. Desktop fine-pointers only.
 */
export function Cursor() {
  const [on, setOn] = useState(false);
  const dot = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) setOn(true);
  }, []);

  useEffect(() => {
    if (!on) return;
    document.documentElement.classList.add('fine-pointer');
    const d = dot.current;
    const w = wrap.current;
    const l = label.current;
    if (!d || !w || !l) return;

    let mx = -100;
    let my = -100;
    let x = -100;
    let y = -100;
    let s = 1;
    let ts = 1;
    let press = 1;
    let raf = 0;

    const move = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };
    const over = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest?.(
        '[data-cursor], a, button, [role="button"], .lever, input[type="range"]',
      ) as HTMLElement | null;
      const v = el?.dataset?.cursor;
      ts = v === 'drag' ? 2.1 : v === 'view' ? 2.3 : el ? 1.55 : 1;
      const txt = v === 'drag' ? 'DRAG' : v === 'view' ? 'OPEN' : '';
      if (l.textContent !== txt) l.textContent = txt;
      w.dataset.hot = el ? '1' : '';
      w.dataset.view = v === 'view' || v === 'drag' ? '1' : '';
    };
    const down = () => {
      press = 0.78;
    };
    const up = () => {
      press = 1;
    };
    const tick = () => {
      x += (mx - x) * 0.22;
      y += (my - y) * 0.22;
      s += (ts - s) * 0.16;
      d.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%) scale(${press})`;
      w.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${(s * press).toFixed(3)})`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', move, { passive: true });
    window.addEventListener('mouseover', over, { passive: true });
    window.addEventListener('mousedown', down);
    window.addEventListener('mouseup', up);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseover', over);
      window.removeEventListener('mousedown', down);
      window.removeEventListener('mouseup', up);
      document.documentElement.classList.remove('fine-pointer');
    };
  }, [on]);

  if (!on) return null;
  return createPortal(
    <>
      <div ref={dot} className="cur-dot" aria-hidden="true" />
      <div ref={wrap} className="cur-wrap" aria-hidden="true">
        <svg viewBox="0 0 48 48" className="cur-svg">
          <circle cx="24" cy="24" r="19" className="cur-ring" />
        </svg>
        <span ref={label} className="cur-label" />
      </div>
    </>,
    document.body,
  );
}
