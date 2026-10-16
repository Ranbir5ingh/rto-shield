'use client';

import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

/**
 * Noir Gold motion system.
 * - Masked line reveals (.reveal-line inside .reveal-mask), grouped by [data-reveal-group]
 * - Fade-up reveals [data-reveal]
 * - Counters [data-count]
 * - Parallax [data-parallax] (scrubbed yPercent)
 * - Hero timeline [data-hero-item] / [data-hero-line]
 */
export function useMarketingMotion(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    const rafId = requestAnimationFrame(function loop(time: number) {
      lenis.raf(time);
      requestAnimationFrame(loop);
    });
    lenis.on('scroll', ScrollTrigger.update);

    const ctx = gsap.context(() => {
      // Hero entrance.
      const heroTl = gsap.timeline({ delay: 0.15 });
      heroTl
        .from('[data-hero-line]', {
          yPercent: 115,
          duration: 1.1,
          stagger: 0.12,
          ease: 'power4.out',
        })
        .from(
          '[data-hero-item]',
          { y: 28, autoAlpha: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out' },
          '-=0.7'
        );

      // Grouped masked line reveals on scroll.
      gsap.utils.toArray<HTMLElement>('[data-reveal-group]').forEach((group) => {
        const lines = group.querySelectorAll('.reveal-line');
        gsap.from(lines, {
          yPercent: 115,
          duration: 1,
          stagger: 0.1,
          ease: 'power4.out',
          scrollTrigger: { trigger: group, start: 'top 86%' },
        });
      });

      // Standalone masked lines.
      gsap.utils.toArray<HTMLElement>('.reveal-line:not([data-reveal-group] .reveal-line)').forEach((line) => {
        if (line.closest('[data-reveal-group]') || line.hasAttribute('data-hero-line')) return;
        gsap.from(line, {
          yPercent: 115,
          duration: 1,
          ease: 'power4.out',
          scrollTrigger: { trigger: line, start: 'top 88%' },
        });
      });

      // Fade-up reveals.
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((node) => {
        gsap.from(node, {
          y: 36,
          autoAlpha: 0,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: node, start: 'top 88%' },
        });
      });

      // Counters.
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
              duration: 1.6,
              ease: 'power2.out',
              onUpdate: () => {
                node.textContent = `${prefix}${Math.round(obj.v).toLocaleString('en-IN')}`;
              },
            });
          },
        });
      });

      // Parallax drifts.
      gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((node) => {
        const amt = Number(node.dataset.parallax || '12');
        gsap.to(node, {
          yPercent: amt,
          ease: 'none',
          scrollTrigger: { trigger: node.closest('section') || node, start: 'top bottom', end: 'bottom top', scrub: true },
        });
      });
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
