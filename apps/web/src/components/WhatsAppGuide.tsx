'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { CopyButton } from '@/components/ui';
import {
  WHATSAPP_CALLBACK_URL,
  WHATSAPP_GUIDE_STEPS,
  guideProgress,
  type GuideProgressInput,
} from '@/lib/whatsapp-guide';

export function WhatsAppSetupGuide({
  callbackUrl,
  verifyToken,
  progress,
}: {
  callbackUrl: string;
  verifyToken: string;
  progress: GuideProgressInput;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const done = guideProgress(progress);
  const finished = WHATSAPP_GUIDE_STEPS.filter((step) => done[step.id]).length;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const nodes = [...panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, textarea, select')];
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    const earlier = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = earlier;
      previous?.focus();
    };
  }, [open]);

  return (
    <>
      <button type="button" className="btn-ghost shrink-0" onClick={() => setOpen(true)}>
        Setup guide
      </button>
      {open ? (
        <div className="fixed inset-0 z-[130] flex justify-end">
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close setup guide" onClick={() => setOpen(false)} />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative ml-auto flex h-full w-full max-w-md flex-col overflow-y-auto border-l-2 border-ink bg-paper p-6 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-inksoft">WhatsApp</p>
                <h2 id={titleId} className="mt-1 font-display text-3xl">
                  Setup guide
                </h2>
              </div>
              <button ref={closeRef} type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <p className="mt-3 font-mono text-xs text-ink/70">
              {finished} of {WHATSAPP_GUIDE_STEPS.length} done. Steps tick off when the matching field is saved.
            </p>
            <WhatsAppGuideBody
              mode="drawer"
              callbackUrl={callbackUrl || WHATSAPP_CALLBACK_URL}
              verifyToken={verifyToken}
              done={done}
            />
            <p className="mt-6 text-sm leading-6 text-ink/75">
              The same steps are on the{' '}
              <Link href="/guides/whatsapp" className="underline decoration-hl decoration-2 underline-offset-4">
                public WhatsApp guide
              </Link>
              . The verify token stays in this panel.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function WhatsAppGuideBody({
  mode,
  callbackUrl,
  verifyToken = '',
  done,
}: {
  mode: 'public' | 'drawer';
  callbackUrl: string;
  verifyToken?: string;
  done?: Partial<Record<(typeof WHATSAPP_GUIDE_STEPS)[number]['id'], boolean>>;
}) {
  const token = mode === 'drawer' ? verifyToken : '';
  return (
    <ol className={mode === 'public' ? 'mt-10 space-y-8' : 'mt-6 space-y-5'}>
      {WHATSAPP_GUIDE_STEPS.map((step, index) => {
        const complete = Boolean(done?.[step.id]);
        return (
          <li key={step.id} className={mode === 'public' ? '' : 'border-t-2 border-dashed border-ink/15 pt-4'}>
            <div className="flex items-start gap-3">
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center border-2 border-ink font-mono text-xs font-bold ${complete ? 'bg-lime' : 'bg-white'}`}
                aria-hidden="true"
              >
                {complete ? <Check size={14} /> : index + 1}
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-xl">
                  {step.title}
                  {mode === 'drawer' ? (
                    <span className="ml-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink/60">
                      {complete ? 'Done' : 'Not done yet'}
                    </span>
                  ) : null}
                </h3>
                <p className="mt-2 text-sm leading-6 text-ink/80">{step.body}</p>
                <ul className="mt-3 space-y-1">
                  {step.links.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink underline decoration-hl decoration-2 underline-offset-4"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
                {step.id === 'webhook' ? (
                  <div className="mt-3 space-y-2">
                    <p className="break-all font-mono text-xs text-ink/80">{callbackUrl}</p>
                    <CopyButton text={callbackUrl} label="Copy callback URL" />
                    {mode === 'drawer' && token ? (
                      <div className="space-y-2">
                        <p className="break-all font-mono text-xs text-ink">{token}</p>
                        <CopyButton text={token} label="Copy verify token" />
                      </div>
                    ) : null}
                    {mode === 'drawer' && !token ? (
                      <p className="text-sm leading-6 text-ink/70">The shop owner can copy the verify token here after logging in.</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
