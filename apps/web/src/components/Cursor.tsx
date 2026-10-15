'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function Cursor() {
  const pathname = usePathname() || '/';

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const marketing = !pathname.startsWith('/app');
    if (!fine || reduce || !marketing) return;

    const root = document.documentElement;
    root.classList.add('has-cursor');
    const dot = document.createElement('div');
    dot.className = 'cursor-dot';
    dot.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('span');
    dot.appendChild(inner);
    document.body.appendChild(dot);

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let cx = x;
    let cy = y;
    let frame = 0;

    const onMove = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      const hot = (event.target as HTMLElement | null)?.closest('a, button, summary, [data-magnetic]');
      dot.classList.toggle('is-hot', Boolean(hot));
    };

    const loop = () => {
      cx += (x - cx) * 0.38;
      cy += (y - cy) * 0.38;
      dot.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
      frame = requestAnimationFrame(loop);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      dot.remove();
      root.classList.remove('has-cursor');
    };
  }, [pathname]);

  return null;
}
