'use client';

import { useEffect } from 'react';

export function useMarketingMotion(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let stopped = false;
    let destroy = () => undefined;

    void (async () => {
      const [{ default: Lenis }, gsapMod, scrollMod] = await Promise.all([
        import('lenis'),
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (stopped) return;
      const gsap = gsapMod.gsap;
      const { ScrollTrigger } = scrollMod;
      gsap.registerPlugin(ScrollTrigger);
      const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      const ticker = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(ticker);
      gsap.ticker.lagSmoothing(0);

      gsap.from('[data-hero-item]', {
        y: 28,
        duration: 0.9,
        stagger: 0.08,
        ease: 'back.out(1.4)',
      });

      document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((node) => {
        gsap.from(node, {
          y: 36,
          autoAlpha: 0,
          duration: 0.8,
          ease: 'back.out(1.3)',
          scrollTrigger: { trigger: node, start: 'top 88%' },
        });
      });

      document.querySelectorAll<HTMLElement>('[data-tick]').forEach((node) => {
        const target = Number(node.dataset.tick || '0');
        const prefix = node.dataset.prefix || '';
        const suffix = node.dataset.suffix || '';
        const state = { value: 0 };
        gsap.to(state, {
          value: target,
          duration: 1.1,
          ease: 'power2.out',
          scrollTrigger: { trigger: node, start: 'top 85%' },
          onUpdate: () => {
            node.textContent = `${prefix}${Math.round(state.value).toLocaleString('en-IN')}${suffix}`;
          },
        });
      });

      const cleanups: Array<() => void> = [];
      document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((node) => {
        const xTo = gsap.quickTo(node, 'x', { duration: 0.35, ease: 'power3.out' });
        const yTo = gsap.quickTo(node, 'y', { duration: 0.35, ease: 'power3.out' });
        const move = (event: PointerEvent) => {
          const rect = node.getBoundingClientRect();
          xTo((event.clientX - (rect.left + rect.width / 2)) * 0.18);
          yTo((event.clientY - (rect.top + rect.height / 2)) * 0.28);
        };
        const leave = () => {
          xTo(0);
          yTo(0);
        };
        node.addEventListener('pointermove', move);
        node.addEventListener('pointerleave', leave);
        cleanups.push(() => {
          node.removeEventListener('pointermove', move);
          node.removeEventListener('pointerleave', leave);
        });
      });

      destroy = () => {
        cleanups.forEach((fn) => fn());
        ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
        gsap.ticker.remove(ticker);
        lenis.destroy();
      };
    })();

    return () => {
      stopped = true;
      destroy();
    };
  }, [enabled]);
}
