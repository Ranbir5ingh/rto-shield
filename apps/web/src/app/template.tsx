'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function Template({ children }: { children: React.ReactNode }) {
  const page = useRef<HTMLDivElement>(null);
  const curtain = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const node = page.current;
    const veil = curtain.current;
    if (!node || !veil) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      veil.style.display = 'none';
      return;
    }
    let cancel = false;
    const failsafe = window.setTimeout(() => {
      if (curtain.current) curtain.current.style.display = 'none';
    }, 1800);
    void import('gsap').then(({ gsap }) => {
      if (cancel || !page.current || !curtain.current) return;
      gsap.set(curtain.current, { display: 'block', scaleY: 1 });
      gsap.fromTo(page.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, delay: 0.18, ease: 'power2.out' });
      gsap.to(curtain.current, {
        scaleY: 0,
        duration: 0.9,
        ease: 'expo.inOut',
        onComplete: () => {
          window.clearTimeout(failsafe);
          if (curtain.current) curtain.current.style.display = 'none';
        },
      });
    });
    return () => {
      cancel = true;
      window.clearTimeout(failsafe);
    };
  }, [pathname]);

  return (
    <>
      <div ref={curtain} className="page-curtain" aria-hidden="true" />
      <div ref={page} className="page-transition">
        {children}
      </div>
    </>
  );
}
