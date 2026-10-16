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
      // Hero entrance: char-split blur-to-sharp reveal + scanline sweep.
      document.querySelectorAll<HTMLElement>('[data-hero-line]').forEach((line) => {
        const text = line.textContent || '';
        line.setAttribute('aria-label', text);
        line.innerHTML = '';
        [...text].forEach((ch) => {
          const s = document.createElement('span');
          s.className = 'hero-char';
          s.setAttribute('aria-hidden', 'true');
          s.textContent = ch === ' ' ? '\u00A0' : ch;
          line.appendChild(s);
        });
      });
      gsap.set('.hero-char', { yPercent: 120, rotate: 5, filter: 'blur(10px)' });
      const heroTl = gsap.timeline({ delay: 0.15 });
      heroTl
        .to('.hero-char', {
          yPercent: 0,
          rotate: 0,
          filter: 'blur(0px)',
          duration: 1.2,
          stagger: 0.035,
          ease: 'power4.out',
        })
        .fromTo(
          '[data-hero-scan]',
          { left: '0%', autoAlpha: 0 },
          { left: '100%', autoAlpha: 1, duration: 1.4, ease: 'power3.inOut' },
          0.3
        )
        .to('[data-hero-scan]', { autoAlpha: 0, duration: 0.4 }, '-=0.3')
        .from(
          '[data-hero-item]',
          { y: 28, autoAlpha: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out' },
          '-=1.1'
        )
        .fromTo(
          '[data-hero-starburst]',
          { scale: 3.2, rotation: 24, autoAlpha: 0 },
          { scale: 1, rotation: -10, autoAlpha: 1, duration: 0.7, ease: 'back.out(1.4)' },
          '-=0.7'
        );

      // Scramble labels: mono text resolves from noise.
      const GLYPHS = '!<>-_\\/[]{}=+*^?#';
      gsap.utils.toArray<HTMLElement>('[data-scramble]').forEach((node) => {
        const original = node.textContent || '';
        ScrollTrigger.create({
          trigger: node,
          start: 'top 90%',
          once: true,
          onEnter: () => {
            const frames = 22;
            let frame = 0;
            const revealAt = (i: number) => Math.floor((i / Math.max(original.length, 1)) * frames);
            const tick = () => {
              frame++;
              let out = '';
              for (let i = 0; i < original.length; i++) {
                const ch = original[i];
                if (ch === ' ' || ch === '/') {
                  out += ch;
                  continue;
                }
                out += frame >= revealAt(i) ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
              }
              node.textContent = out;
              if (frame < frames) requestAnimationFrame(tick);
              else node.textContent = original;
            };
            tick();
          },
        });
      });

      // Scrubbed word-fill statements.
      gsap.utils.toArray<HTMLElement>('[data-scrub-words]').forEach((node) => {
        const words: HTMLElement[] = [];
        const split = (parent: Node) => {
          [...parent.childNodes].forEach((child) => {
            if (child.nodeType === Node.TEXT_NODE) {
              const frag = document.createDocumentFragment();
              (child.textContent || '').split(/(\s+)/).forEach((part) => {
                if (!part) return;
                if (/^\s+$/.test(part)) {
                  frag.appendChild(document.createTextNode(' '));
                  return;
                }
                const w = document.createElement('span');
                w.className = 'scrub-word';
                w.textContent = part;
                frag.appendChild(w);
                words.push(w);
              });
              parent.replaceChild(frag, child);
            } else if (child.nodeType === Node.ELEMENT_NODE && child.nodeName !== 'BR') {
              split(child);
            }
          });
        };
        split(node);
        gsap.fromTo(
          words,
          { opacity: 0.12 },
          {
            opacity: 1,
            stagger: 0.05,
            ease: 'none',
            scrollTrigger: { trigger: node, start: 'top 82%', end: 'bottom 45%', scrub: 0.6 },
          }
        );
      });

      // Scanline wipe chapter.
      gsap.utils.toArray<HTMLElement>('[data-wipe]').forEach((wipe) => {
        const over = wipe.querySelector('[data-wipe-over]');
        const scan = wipe.querySelector('[data-wipe-scan]');
        const flags = wipe.querySelectorAll('[data-wipe-flag]');
        if (!over) return;
        gsap.set(over, { clipPath: 'inset(0 0 0 100%)' });
        gsap.set(scan, { left: '100%' });
        gsap.set(flags, { scale: 0.5, autoAlpha: 0 });
        const tl = gsap.timeline({
          scrollTrigger: { trigger: wipe, start: 'top 78%', end: 'bottom 40%', scrub: 1 },
        });
        tl.to(over, { clipPath: 'inset(0 0 0 0%)', ease: 'none', duration: 1 }, 0);
        if (scan) tl.to(scan, { left: '0%', ease: 'none', duration: 1 }, 0);
        if (flags.length)
          tl.to(flags, { scale: 1, autoAlpha: 1, stagger: 0.09, ease: 'back.out(2.2)', duration: 0.35 }, 0.55);
      });

      // Magnetic CTAs (fine pointers only).
      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        gsap.utils.toArray<HTMLElement>('[data-magnetic]').forEach((el) => {
          el.addEventListener('mousemove', (e) => {
            const r = el.getBoundingClientRect();
            const x = e.clientX - (r.left + r.width / 2);
            const y = e.clientY - (r.top + r.height / 2);
            gsap.to(el, { x: x * 0.28, y: y * 0.28, duration: 0.4, ease: 'power3.out' });
          });
          el.addEventListener('mouseleave', () => {
            gsap.to(el, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.35)' });
          });
        });
      }

      // Velocity-reactive marquees.
      const marqueeTweens: gsap.core.Tween[] = [];
      gsap.utils.toArray<HTMLElement>('[data-velocity-marquee]').forEach((track) => {
        marqueeTweens.push(gsap.to(track, { xPercent: -50, duration: 22, ease: 'none', repeat: -1 }));
      });
      if (marqueeTweens.length) {
        let cool: ReturnType<typeof setTimeout>;
        ScrollTrigger.create({
          onUpdate: (self) => {
            const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 2500, 5);
            marqueeTweens.forEach((t) => gsap.to(t, { timeScale: boost, duration: 0.25, overwrite: 'auto' }));
            clearTimeout(cool);
            cool = setTimeout(() => {
              marqueeTweens.forEach((t) => gsap.to(t, { timeScale: 1, duration: 0.9, overwrite: 'auto' }));
            }, 140);
          },
        });
      }

      // Grouped masked line reveals on scroll.
      gsap.utils.toArray<HTMLElement>('[data-reveal-group]').forEach((group) => {
        const lines = group.querySelectorAll('.reveal-line');
        gsap.set(lines, { yPercent: 115 });
        gsap.to(lines, {
          yPercent: 0,
          duration: 1,
          stagger: 0.1,
          ease: 'power4.out',
          scrollTrigger: { trigger: group, start: 'top 86%' },
        });
      });

      // Standalone masked lines.
      gsap.utils.toArray<HTMLElement>('.reveal-line:not([data-reveal-group] .reveal-line)').forEach((line) => {
        if (line.closest('[data-reveal-group]') || line.hasAttribute('data-hero-line')) return;
        gsap.set(line, { yPercent: 115 });
        gsap.to(line, {
          yPercent: 0,
          duration: 1,
          ease: 'power4.out',
          scrollTrigger: { trigger: line, start: 'top 88%' },
        });
      });

      // Reveals — each section gets its own technique via data-reveal.
      // rise: classic fade-up · pop: sticker pop-in · slap: sticker slap-down
      // fan: cards fan in with alternating rotation · wipe-x: clip-path wipe
      // spin-in: rotate + scale entrance.
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((node) => {
        const kind = node.dataset.reveal || 'rise';
        const delay = Number(node.dataset.delay || '0');
        const trigger = { trigger: node, start: 'top 88%' };
        if (kind === 'pop') {
          gsap.from(node, {
            scale: 0.4,
            rotation: -8,
            autoAlpha: 0,
            duration: 0.7,
            delay,
            ease: 'back.out(1.8)',
            scrollTrigger: trigger,
          });
        } else if (kind === 'slap') {
          gsap.from(node, {
            scale: 1.7,
            rotation: gsap.utils.random(-14, 14),
            autoAlpha: 0,
            duration: 0.55,
            delay,
            ease: 'back.out(1.5)',
            scrollTrigger: trigger,
          });
        } else if (kind === 'fan') {
          gsap.from(node, {
            y: 90,
            rotation: delay % 0.24 < 0.12 ? 10 : -10,
            autoAlpha: 0,
            duration: 0.85,
            delay,
            ease: 'back.out(1.1)',
            scrollTrigger: trigger,
          });
        } else if (kind === 'wipe-x') {
          gsap.fromTo(
            node,
            { clipPath: 'inset(0 100% 0 0)' },
            {
              clipPath: 'inset(0 0% 0 0)',
              duration: 1,
              delay,
              ease: 'power3.inOut',
              scrollTrigger: trigger,
            },
          );
        } else if (kind === 'spin-in') {
          gsap.from(node, {
            scale: 0.5,
            rotation: 120,
            autoAlpha: 0,
            duration: 0.9,
            delay,
            ease: 'back.out(1.3)',
            scrollTrigger: trigger,
          });
        } else {
          gsap.from(node, {
            y: 36,
            autoAlpha: 0,
            duration: 0.9,
            delay,
            ease: 'power3.out',
            scrollTrigger: trigger,
          });
        }
      });

      // Highlighter word scrub — words get marked up one by one as you scroll.
      gsap.utils.toArray<HTMLElement>('[data-scrub="highlight"]').forEach((node) => {
        const words = node.textContent?.trim().split(/\s+/) ?? [];
        node.setAttribute('aria-label', words.join(' '));
        node.innerHTML = words.map((w) => `<span class="hlw" aria-hidden="true">${w}</span>`).join(' ');
        const spans = node.querySelectorAll('.hlw');
        gsap.to(spans, {
          backgroundSize: '100% 82%',
          ease: 'none',
          stagger: 0.12,
          scrollTrigger: { trigger: node, start: 'top 78%', end: 'bottom 45%', scrub: 0.6 },
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
