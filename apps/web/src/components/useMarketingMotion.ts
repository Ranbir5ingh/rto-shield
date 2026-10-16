'use client';

import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export function useMarketingMotion(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    const raf = (time: number) => lenis.raf(time);
    const rafId = requestAnimationFrame(function loop(time: number) {
      raf(time);
      requestAnimationFrame(loop);
    });
    lenis.on('scroll', ScrollTrigger.update);

    const ctx = gsap.context(() => {
      // Hero entrance — staggered, after the boot overlay lifts.
      gsap.from('[data-hero-item]', {
        y: 44,
        autoAlpha: 0,
        duration: 0.9,
        stagger: 0.09,
        ease: 'power4.out',
        delay: 1.15,
      });

      // Hero background parallax.
      gsap.to('[data-hero-bg]', {
        yPercent: 14,
        ease: 'none',
        scrollTrigger: { trigger: '[data-hero-bg]', start: 'top top', end: 'bottom top', scrub: true },
      });

      // Section reveals.
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((node) => {
        gsap.from(node, {
          y: 48,
          autoAlpha: 0,
          duration: 0.85,
          ease: 'power3.out',
          scrollTrigger: { trigger: node, start: 'top 88%' },
        });
      });

      // Pixel counters.
      gsap.utils.toArray<HTMLElement>('[data-count]').forEach((node) => {
        const target = Number(node.dataset.count || '0');
        const prefix = node.dataset.prefix || '';
        const obj = { v: 0 };
        ScrollTrigger.create({
          trigger: node,
          start: 'top 88%',
          once: true,
          onEnter: () => {
            gsap.to(obj, {
              v: target,
              duration: 1.4,
              ease: 'power2.out',
              onUpdate: () => {
                node.textContent = `${prefix}${Math.round(obj.v).toLocaleString('en-IN')}`;
              },
            });
          },
        });
      });

      // Level 03 — pinned horizontal ride.
      const track = document.getElementById('level-3-track');
      const pin = document.getElementById('level-3-pin');
      if (track && pin) {
        const getX = () => -(track.scrollWidth - window.innerWidth + 48);
        gsap.to(track, {
          x: getX,
          ease: 'none',
          scrollTrigger: {
            trigger: pin,
            start: 'top top',
            end: () => `+=${track.scrollWidth - window.innerWidth + 400}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });
      }
    });

    const onRefresh = () => ScrollTrigger.refresh();
    window.addEventListener('load', onRefresh);

    return () => {
      window.removeEventListener('load', onRefresh);
      cancelAnimationFrame(rafId);
      lenis.destroy();
      ctx.revert();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, [enabled]);
}
