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
      const { ScrollTrigger } = scrollMod;
      const { SplitText } = splitMod;
      gsap.registerPlugin(ScrollTrigger, SplitText);
      if (document.fonts?.ready) await document.fonts.ready;
      if (stopped) return;

      const lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
      const onScroll = () => ScrollTrigger.update();
      lenis.on('scroll', onScroll);
      const ticker = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(ticker);
      gsap.ticker.lagSmoothing(0);

      const nav = document.querySelector<HTMLElement>('[data-nav]');
      let last = 0;
      const onLenis = (event: { scroll: number }) => {
        if (!nav || nav.dataset.open === 'true') return;
        const scroll = event.scroll;
        nav.classList.toggle('is-solid', scroll > 12);
        if (scroll < 64) nav.classList.remove('is-hidden');
        else if (scroll > last + 6) nav.classList.add('is-hidden');
        else if (scroll < last - 6) nav.classList.remove('is-hidden');
        last = scroll;
      };
      lenis.on('scroll', onLenis);

      const splits: Array<{ revert: () => void }> = [];
      document.querySelectorAll<HTMLElement>('[data-split]').forEach((node) => {
        const split = new SplitText(node, { type: 'lines', mask: 'lines', linesClass: 'split-line' });
        splits.push(split);
        const hero = node.hasAttribute('data-hero');
        gsap.from(split.lines, {
          yPercent: 112,
          duration: 1.15,
          stagger: 0.07,
          ease: 'power4.out',
          delay: hero ? 0.12 : 0,
          scrollTrigger: hero ? undefined : { trigger: node, start: 'top 86%' },
        });
      });

      gsap.from('[data-rise]', {
        y: 28,
        autoAlpha: 0,
        duration: 1.05,
        stagger: 0.09,
        delay: 0.42,
        ease: 'power3.out',
      });

      document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((node) => {
        gsap.from(node, {
          y: 40,
          autoAlpha: 0,
          duration: 1.05,
          ease: 'power3.out',
          scrollTrigger: { trigger: node, start: 'top 84%' },
        });
      });

      document.querySelectorAll<HTMLElement>('[data-clip]').forEach((node) => {
        const media = node.querySelector<HTMLElement>('[data-clip-media]') || node;
        gsap.from(node, {
          clipPath: 'inset(12% 12% 12% 12% round 32px)',
          duration: 1.35,
          ease: 'expo.out',
          scrollTrigger: { trigger: node, start: 'top 82%' },
        });
        gsap.from(media, {
          scale: 1.12,
          duration: 1.5,
          ease: 'expo.out',
          scrollTrigger: { trigger: node, start: 'top 82%' },
        });
      });

      document.querySelectorAll<HTMLElement>('[data-parallax]').forEach((node) => {
        gsap.to(node, {
          yPercent: -8,
          ease: 'none',
          scrollTrigger: { trigger: node, start: 'top bottom', end: 'bottom top', scrub: true },
        });
      });

      gsap.to('[data-float]', {
        y: -14,
        duration: 2.6,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        stagger: 0.2,
      });

      const cleanups: Array<() => void> = [];
      document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((node) => {
        const xTo = gsap.quickTo(node, 'x', { duration: 0.45, ease: 'power3.out' });
        const yTo = gsap.quickTo(node, 'y', { duration: 0.45, ease: 'power3.out' });
        const move = (event: PointerEvent) => {
          const rect = node.getBoundingClientRect();
          xTo((event.clientX - (rect.left + rect.width / 2)) * 0.28);
          yTo((event.clientY - (rect.top + rect.height / 2)) * 0.4);
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

      const mm = gsap.matchMedia();
      mm.add('(min-width: 1024px)', () => {
        const story = document.querySelector<HTMLElement>('[data-story]');
        if (!story) return;
        const frames = Array.from(story.querySelectorAll<HTMLElement>('[data-frame]'));
        const steps = Array.from(story.querySelectorAll<HTMLElement>('[data-step]'));
        if (frames.length < 2) return;
        gsap.set(frames.slice(1), { autoAlpha: 0, y: 36 });
        gsap.set(steps.slice(1), { autoAlpha: 0.4 });
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: story,
            start: 'top top',
            end: '+=170%',
            pin: true,
            scrub: 0.65,
            anticipatePin: 1,
          },
        });
        frames.forEach((frame, index) => {
          if (index === 0) return;
          timeline.to(frames[index - 1], { autoAlpha: 0, duration: 0.22, ease: 'power2.in' }, index);
          timeline.fromTo(frame, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.28, ease: 'power2.out' }, index + 0.18);
          if (steps[index - 1]) timeline.to(steps[index - 1], { autoAlpha: 0.35, duration: 0.28 }, index);
          if (steps[index]) timeline.to(steps[index], { autoAlpha: 1, duration: 0.28 }, index + 0.12);
        });
      });

      destroy = () => {
        cleanups.forEach((fn) => fn());
        mm.revert();
        splits.forEach((split) => split.revert());
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
