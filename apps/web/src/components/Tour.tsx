'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { autoUpdate, computePosition, flip, hide, offset, shift, size } from '@floating-ui/dom';
import { Volume2, VolumeX } from 'lucide-react';
import type { TourStep } from '@/lib/tours';
import { isTourLang, tourText, type TourLang } from '@/lib/tour-copy';
import { cardWidthFor, resolveTourFrame, type Rect, type TourFrame } from '@/components/tour-place';
import { freshRevealMemory, restoreTourUi, revealStep, stepOnPage, type RevealMemory } from '@/components/tour-reveal';

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: string;
}

const PAD = 8;
const LANG_KEY = 'rto-tour-lang';

const tourBtn =
  'inline-flex w-full min-w-0 items-center justify-center gap-0.5 overflow-hidden border-2 border-ink bg-paper px-0.5 py-2 font-mono text-[10px] font-bold uppercase leading-none tracking-[0.02em] text-ink shadow-[2px_2px_0_0_#1B1712] disabled:opacity-40';
const tourNext = `${tourBtn} bg-lime`;

function visible(node: HTMLElement) {
  const rect = node.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  const style = getComputedStyle(node);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

/** The first anchor that is actually on screen. Hidden copies (the desktop pane on a phone) are skipped. */
function tourTarget(id: string) {
  if (!/^[a-z0-9-]+$/i.test(id)) return null;
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`);
  for (const node of nodes) {
    if (visible(node)) return node;
  }
  return null;
}

function pageReady() {
  const nodes = document.querySelectorAll('[data-tour-ready]');
  if (!nodes.length) return true;
  return [...nodes].every((node) => node.getAttribute('data-tour-ready') === 'true');
}

function measure(node: HTMLElement): Box | null {
  const rect = node.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return null;
  const radius = getComputedStyle(node).borderRadius || '0px';
  return {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
    radius,
  };
}

function moved(a: Box, b: Box) {
  return Math.abs(a.top - b.top) > 1 || Math.abs(a.left - b.left) > 1 || Math.abs(a.width - b.width) > 1 || Math.abs(a.height - b.height) > 1;
}

function targetRect(node: HTMLElement): Rect {
  const rect = node.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function chromeInset() {
  const dock = document.querySelector('[data-dock]');
  if (!dock) return { top: 12, bottom: 12 };
  const rect = dock.getBoundingClientRect();
  if (rect.top < window.innerHeight / 2) return { top: Math.max(12, rect.bottom + 8), bottom: 12 };
  return { top: 12, bottom: Math.max(12, window.innerHeight - rect.top + 8) };
}

function clipSrc(id: string, lang: TourLang, blobs: Map<string, string>) {
  const blob = blobs.get(`${lang}:${id}`);
  if (blob) return blob;
  return `/api/tours/narration/${encodeURIComponent(id)}?lang=${lang}`;
}

async function prefetchClips(ids: string[], lang: TourLang, blobs: Map<string, string>) {
  await Promise.all(ids.map(async (id) => {
    const key = `${lang}:${id}`;
    if (blobs.has(key)) return;
    try {
      const response = await fetch(`/api/tours/narration/${encodeURIComponent(id)}?lang=${lang}`);
      if (response.status === 204 || !response.ok) {
        blobs.set(key, '');
        return;
      }
      const blob = await response.blob();
      if (!blob.size) {
        blobs.set(key, '');
        return;
      }
      blobs.set(key, URL.createObjectURL(blob));
    } catch {
      blobs.set(key, '');
    }
  }));
}

export function Tour({
  steps,
  onFinish,
  stepTimeoutMs = 8000,
}: {
  steps: TourStep[];
  onFinish: (reason: 'done' | 'skip') => void;
  /** How long a step may wait for its route and a stable anchor before the guide appears. */
  stepTimeoutMs?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const titleId = useId();
  const bodyId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlocked = useRef(false);
  const revealMemory = useRef<RevealMemory>(freshRevealMemory());
  const blobs = useRef(new Map<string, string>());
  const [phase, setPhase] = useState<'choose' | 'run'>('choose');
  const [lang, setLang] = useState<TourLang>('english');
  const [mobile, setMobile] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [liveTitle, setLiveTitle] = useState('');
  const [index, setIndex] = useState(0);
  const [readyId, setReadyId] = useState('');
  const [box, setBox] = useState<Box | null>(null);
  const [frame, setFrame] = useState<TourFrame | null>(null);
  const [pin, setPin] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const voiceOnRef = useRef(true);
  const langRef = useRef<TourLang>('english');
  const phaseRef = useRef<'choose' | 'run'>('choose');
  const cleaned = useRef(false);
  voiceOnRef.current = voiceOn;
  langRef.current = lang;
  phaseRef.current = phase;

  const shown = useMemo(() => {
    if (lang === 'english') return steps;
    return steps.map((step) => {
      const text = tourText(step.id, lang, mobile);
      return text ? { ...step, title: text.title, body: text.body } : step;
    });
  }, [lang, mobile, steps]);

  const step = shown[index];
  const speakId = step?.narrationId || step?.id || '';

  useEffect(() => {
    const stored = window.localStorage.getItem('rto-tour-voice');
    const quiet = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setVoiceOn(stored ? stored === 'on' : !quiet);
    const savedLang = window.localStorage.getItem(LANG_KEY);
    if (isTourLang(savedLang)) setLang(savedLang);
    const media = window.matchMedia('(max-width: 1023px)');
    const apply = () => setMobile(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    return () => {
      for (const url of blobs.current.values()) {
        if (url) URL.revokeObjectURL(url);
      }
    };
  }, []);

  function stopVoice() {
    audioRef.current?.pause();
  }

  function playVoice(id: string) {
    if (phaseRef.current !== 'run' || !voiceOnRef.current || !unlocked.current || !id) {
      stopVoice();
      return;
    }
    const language = langRef.current;
    const key = `${language}:${id}`;
    const audio = audioRef.current || new Audio();
    audioRef.current = audio;
    if (audio.dataset.step === key && !audio.paused) return;
    if (audio.dataset.step !== key) {
      audio.dataset.step = key;
      audio.src = clipSrc(id, language, blobs.current);
    }
    try {
      void audio.play()?.catch(() => undefined);
    } catch {
      /* playback can fail before the browser returns a promise */
    }
  }

  function chooseLang(next: TourLang) {
    langRef.current = next;
    setLang(next);
    window.localStorage.setItem(LANG_KEY, next);
  }

  function finish(reason: 'done' | 'skip') {
    stopVoice();
    const openedOrder = revealMemory.current.openedOrder;
    if (!cleaned.current) {
      cleaned.current = true;
      restoreTourUi(revealMemory.current);
      revealMemory.current = freshRevealMemory();
      if (openedOrder && window.matchMedia('(max-width: 1023px)').matches && window.location.pathname.startsWith('/app/orders/')) {
        router.push('/app/queue');
      }
    }
    onFinish(reason);
  }

  useEffect(() => {
    if (phase !== 'run') return;
    let cancelled = false;
    setAudioReady(false);
    const ids = shown.map((item) => item.narrationId || item.id);
    void (async () => {
      await prefetchClips(ids.slice(0, 3), lang, blobs.current);
      if (cancelled) return;
      setAudioReady(true);
      void prefetchClips(ids.slice(3), lang, blobs.current);
    })();
    return () => {
      cancelled = true;
    };
  }, [lang, phase, shown]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      finish('skip');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onFinish, router]);

  useEffect(() => {
    return () => {
      stopVoice();
      if (!cleaned.current) {
        cleaned.current = true;
        restoreTourUi(revealMemory.current);
      }
    };
  }, []);

  useEffect(() => {
    const onGesture = () => {
      unlocked.current = true;
    };
    window.addEventListener('pointerdown', onGesture, { once: true });
    return () => window.removeEventListener('pointerdown', onGesture);
  }, []);

  useEffect(() => {
    if (phase !== 'run' || !unlocked.current || !step || readyId !== step.id) return;
    playVoice(speakId);
  }, [speakId, voiceOn, lang, phase, readyId, step]);

  useEffect(() => {
    setLiveTitle('');
  }, [index, lang]);

  useEffect(() => {
    if (!step || phase !== 'run') return;

    let cancelled = false;
    let locked = false;
    let pushed = false;
    let poll = 0;
    const started = performance.now();
    const memory = revealMemory.current;
    setBox(null);
    setFrame(null);
    setReadyId('');

    const giveUp = () => {
      if (cancelled || locked) return;
      locked = true;
      if (index >= shown.length - 1) onFinish('done');
      else setIndex(index + 1);
    };

    const seek = () => {
      if (cancelled || locked) return;
      window.clearTimeout(poll);
      const elapsed = performance.now() - started;
      if (elapsed >= stepTimeoutMs) {
        giveUp();
        return;
      }
      const again = () => {
        const wait = Math.min(80, Math.max(0, stepTimeoutMs - (performance.now() - started)));
        poll = window.setTimeout(seek, wait);
      };
      const mobileNow = window.matchMedia('(max-width: 1023px)').matches;
      if (!stepOnPage(step, pathname || '', mobileNow)) {
        setBox(null);
        setFrame(null);
        if (!pushed) {
          const row = mobileNow && step.reveal?.includes('order')
            ? document.querySelector<HTMLElement>('[data-tour-row="1"]')
            : null;
          if (row) {
            pushed = true;
            memory.openedOrder = true;
            row.click();
          } else if (window.location.pathname !== step.route) {
            pushed = true;
            router.push(step.route);
          }
        }
        again();
        return;
      }
      if (!pageReady()) {
        again();
        return;
      }
      revealStep(step, mobileNow, memory);
      const node = tourTarget(step.id);
      const next = node ? measure(node) : null;
      if (!node || !next) {
        again();
        return;
      }
      if (step.titleFromAnchor) {
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (text) setLiveTitle(text);
      }
      locked = true;
      const tall = next.height > window.innerHeight * 0.7;
      node.scrollIntoView?.({
        block: tall ? 'start' : 'nearest',
        inline: 'nearest',
        behavior: 'auto',
      });
      const finish = (previous: Box | null, tries: number) => {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (cancelled) return;
          const settled = measure(node);
          if (!settled) {
            locked = false;
            poll = window.setTimeout(seek, 80);
            return;
          }
          if (!previous || (moved(previous, settled) && tries < 6)) {
            finish(settled, tries + 1);
            return;
          }
          setReadyId(step.id);
          setBox(settled);
          setPin((n) => n + 1);
        }));
      };
      finish(null, 0);
    };

    const observer = new MutationObserver(() => {
      if (!cancelled) seek();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-tour', 'data-tour-ready', 'class', 'style', 'aria-expanded', 'aria-selected'],
    });
    seek();

    return () => {
      cancelled = true;
      observer.disconnect();
      window.clearTimeout(poll);
    };
  }, [index, onFinish, pathname, phase, router, step, stepTimeoutMs, shown.length]);

  useEffect(() => {
    if (!step || phase !== 'run') return;
    const mobileNow = window.matchMedia('(max-width: 1023px)').matches;
    if (!stepOnPage(step, pathname || '', mobileNow)) return;
    const node = tourTarget(step.id);
    const cardEl = cardRef.current;
    if (!node || !cardEl) return;
    let last = '';
    let live = true;

    const place = () => {
      const next = measure(node);
      if (!next) return;
      const width = Math.min(320, cardWidthFor(window.innerWidth));
      const inset = chromeInset();
      const boundary = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
      const apply = (nextFrame: TourFrame) => {
        const key = `${nextFrame.mode}:${Math.round(next.top)}:${Math.round(next.left)}:${Math.round(nextFrame.top)}:${Math.round(nextFrame.left)}:${Math.round(nextFrame.maxHeight)}`;
        if (key === last) return;
        last = key;
        setBox(next);
        setFrame(nextFrame);
      };
      const finishPlace = (placed: { x: number; y: number } | null, referenceHidden: boolean) => {
        const rect = cardEl.getBoundingClientRect();
        apply(resolveTourFrame({
          viewport: { width: window.innerWidth, height: window.innerHeight },
          inset,
          target: targetRect(node),
          card: { width, height: Math.max(rect.height, cardEl.scrollHeight, 96) },
          placed,
          referenceHidden,
          mobile: window.innerWidth < 768,
        }));
      };
      void computePosition(node, cardEl, {
        strategy: 'fixed',
        placement: window.innerWidth < 768 ? 'top' : 'bottom',
        middleware: [
          offset(12),
          flip({ padding: 12, boundary, rootBoundary: 'viewport', fallbackPlacements: ['top', 'bottom', 'right', 'left'] }),
          shift({ padding: 12, boundary, rootBoundary: 'viewport', crossAxis: true }),
          size({
            padding: 12,
            boundary,
            rootBoundary: 'viewport',
            apply({ availableWidth, availableHeight, elements }) {
              const room = Math.max(0, window.innerHeight - inset.top - inset.bottom);
              const cap = Math.min(room, Math.max(0, availableHeight));
              Object.assign(elements.floating.style, {
                maxWidth: `${Math.min(width, Math.max(0, availableWidth))}px`,
                maxHeight: `${cap}px`,
              });
            },
          }),
          hide({ strategy: 'referenceHidden', boundary, rootBoundary: 'viewport' }),
        ],
      }).then((pos) => {
        if (!live) return;
        finishPlace({ x: pos.x, y: pos.y }, Boolean(pos.middlewareData.hide?.referenceHidden));
      }).catch(() => {
        if (!live) return;
        finishPlace(null, false);
      });
    };

    const stop = autoUpdate(node, cardEl, () => {
      if (live) place();
    });
    return () => {
      live = false;
      stop();
    };
  }, [index, pathname, phase, pin, step]);

  useEffect(() => {
    const cardEl = document.getElementById('tour-card');
    if (!cardEl) return;
    const focusable = () => [...cardEl.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
    focusable()[focusable().length - 1]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && phaseRef.current !== 'run') return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        unlocked.current = true;
        if (index >= shown.length - 1) finish('done');
        else setIndex(index + 1);
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setIndex((current) => Math.max(0, current - 1));
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = focusable();
      if (!nodes.length) return;
      const first = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        lastNode.focus();
      } else if (!event.shiftKey && document.activeElement === lastNode) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, onFinish, phase, shown.length]);

  if (!step) return null;
  const onPage = phase === 'run' && stepOnPage(step, pathname || '', typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches);
  const settled = phase === 'choose' || (readyId === step.id && Boolean(frame));
  const spotlight = Boolean(settled && box && frame && onPage);
  const last = index === shown.length - 1;
  const width = phase === 'choose'
    ? 352
    : (frame?.width ?? 320);
  const heading = (step.titleFromAnchor && liveTitle) || step.title;

  return (
    <div className="pointer-events-none fixed inset-0 z-[218]" data-tour-overlay="true">
      {spotlight && box ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute border-2 border-ink motion-safe:transition-[top,left,width,height] motion-safe:duration-300 motion-reduce:transition-none"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            borderRadius: box.radius,
            boxShadow: '0 0 0 9999px rgba(27, 23, 18, 0.62)',
          }}
        />
      ) : (
        <div aria-hidden="true" className="pointer-events-auto absolute inset-0 bg-ink/45" />
      )}
      <div
        ref={cardRef}
        id="tour-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-tour-mode={phase === 'choose' ? 'sheet' : (frame?.mode || 'pending')}
        data-tour-audio={phase === 'run' ? (audioReady ? 'ready' : 'loading') : 'idle'}
        className={`sticker fixed flex flex-col overflow-hidden p-0 ${settled ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        style={{
          top: phase === 'choose' ? 16 : (frame?.top ?? 16),
          left: phase === 'choose' ? 16 : (frame?.left ?? 16),
          width,
          maxHeight: phase === 'choose' ? 420 : (frame?.maxHeight ?? 320),
        }}
      >
        {phase === 'choose' ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-2">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-inksoft">Tour</p>
              <h2 id={titleId} className="mt-2 font-display text-2xl">Tour language</h2>
              <p id={bodyId} className="mt-2 text-sm leading-6 text-ink/80">
                English, Hindi, or Hinglish. The voice and these cards use the same language.
              </p>
              <LanguageRadios lang={lang} onChange={chooseLang} />
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-1 border-t-2 border-ink p-2">
              <button type="button" className={tourBtn} onClick={() => finish('skip')}>Skip</button>
              <button
                type="button"
                className={tourNext}
                onClick={() => {
                  unlocked.current = true;
                  phaseRef.current = 'run';
                  setPhase('run');
                }}
              >
                Start
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex min-h-0 flex-1 items-start gap-2 overflow-y-auto p-2 pb-1">
              <Robot />
              <div className="min-w-0 flex-1 border-2 border-ink bg-paper px-2 py-1.5 shadow-[2px_2px_0_0_#1B1712]">
                <h2 id={titleId} className="font-display text-sm font-black uppercase leading-tight">{heading}</h2>
                <p id={bodyId} className="mt-1 text-xs leading-5 text-ink/80">{step.body}</p>
              </div>
            </div>
            <div data-tour-footer className="grid shrink-0 grid-cols-4 gap-1 border-t-2 border-ink p-2">
              <button type="button" className={tourBtn} onClick={() => finish('skip')}>Skip</button>
              <button
                type="button"
                className={tourBtn}
                aria-pressed={!voiceOn}
                onClick={() => {
                  unlocked.current = true;
                  const next = !voiceOn;
                  voiceOnRef.current = next;
                  setVoiceOn(next);
                  window.localStorage.setItem('rto-tour-voice', next ? 'on' : 'off');
                  if (!next) stopVoice();
                }}
              >
                {voiceOn ? <Volume2 aria-hidden="true" size={12} /> : <VolumeX aria-hidden="true" size={12} />}
                {voiceOn ? 'Mute' : 'Voice'}
              </button>
              <button
                type="button"
                className={tourBtn}
                onClick={() => {
                  unlocked.current = true;
                  setIndex((current) => Math.max(0, current - 1));
                }}
                disabled={index === 0}
              >
                Back
              </button>
              <button
                type="button"
                className={tourNext}
                onClick={() => {
                  unlocked.current = true;
                  if (last) {
                    stopVoice();
                    finish('done');
                    return;
                  }
                  setIndex(index + 1);
                }}
              >
                {last ? 'Done' : 'Next'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Robot() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" className="shrink-0 border-2 border-ink bg-lime shadow-[2px_2px_0_0_#1B1712]">
      <rect x="16" y="2" width="4" height="6" fill="#1B1712" />
      <rect x="7" y="8" width="22" height="16" fill="#FAF6EE" stroke="#1B1712" strokeWidth="2" />
      <rect x="11" y="13" width="4" height="4" fill="#1B1712" />
      <rect x="21" y="13" width="4" height="4" fill="#1B1712" />
      <rect x="12" y="26" width="4" height="6" fill="#1B1712" />
      <rect x="20" y="26" width="4" height="6" fill="#1B1712" />
    </svg>
  );
}

function LanguageRadios({ lang, onChange }: { lang: TourLang; onChange: (lang: TourLang) => void }) {
  const options: Array<[TourLang, string]> = [
    ['english', 'English'],
    ['hindi', 'Hindi'],
    ['hinglish', 'Hinglish'],
  ];
  return (
    <div role="radiogroup" aria-label="Tour language" className="mt-3 grid grid-cols-3 gap-1">
      {options.map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={lang === value}
          className={`border-2 border-ink px-1 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em] ${lang === value ? 'bg-lime shadow-[2px_2px_0_0_#1B1712]' : 'bg-paper'}`}
          onClick={() => onChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
