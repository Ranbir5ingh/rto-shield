'use client';

import { useEffect } from 'react';

export function useMarketingMotion(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let stopped = false;
    let destroy = () => undefined;

    void (async () => {
      const [{ default: Lenis }, gsapMod, scrollMod, splitMod] = await Promise.all([
        import('lenis'),
        import('gsap'),
        import('gsap/ScrollTrigger'),
        import('gsap/SplitText'),
      ]);
      if (stopped) return;
      const gsap = gsapMod.gsap;
      gsap.registerPlugin(scrollMod.ScrollTrigger, splitMod.SplitText);
      const lenis = new Lenis({ autoRaf: true, lerp: 0.12 });
      lenis.on('scroll', scrollMod.ScrollTrigger.update);
      const splits: Array<{ revert: () => void }> = [];
      document.querySelectorAll<HTMLElement>('[data-split]').forEach((node) => {
        const split = new splitMod.SplitText(node, { type: 'lines,words', mask: 'lines' });
        splits.push(split);
        gsap.from(split.words, { yPercent: 110, duration: 0.9, stagger: 0.028, ease: 'power3.out' });
      });
      document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((node) => {
        gsap.from(node, {
          y: 32,
          autoAlpha: 0,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: { trigger: node, start: 'top 86%' },
        });
      });
      const story = document.querySelector<HTMLElement>('[data-story]');
      const frames = story ? Array.from(story.querySelectorAll<HTMLElement>('[data-frame]')) : [];
      if (story && frames.length > 1) {
        const timeline = gsap.timeline({
          scrollTrigger: { trigger: story, start: 'top top', end: '+=160%', pin: true, scrub: 0.6 },
        });
        frames.forEach((frame, index) => {
          if (index === 0) return;
          timeline.fromTo(frame, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.4 }, index * 0.4);
          timeline.to(frames[index - 1], { autoAlpha: 0.35, duration: 0.3 }, index * 0.4);
        });
      }
      destroy = () => {
        splits.forEach((split) => split.revert());
        scrollMod.ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
        lenis.destroy();
      };
    })();

    return () => {
      stopped = true;
      destroy();
    };
  }, [enabled]);
}
