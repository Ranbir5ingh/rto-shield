'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function Template({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cancel = false;
    void import('gsap').then(({ gsap }) => {
      if (cancel || !ref.current) return;
      gsap.fromTo(ref.current, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' });
    });
    return () => {
      cancel = true;
    };
  }, [pathname]);

  return <div ref={ref}>{children}</div>;
}
