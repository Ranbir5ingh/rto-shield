'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui';

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  pending = false,
  phase = 'in',
  onConfirm,
  onClose,
  onExitEnd,
  children,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'go';
  pending?: boolean;
  phase?: 'in' | 'out';
  onConfirm: () => void;
  onClose: () => void;
  onExitEnd?: () => void;
  children?: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>('input, button:not([disabled])');
    (focusable?.[0] || panel)?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const nodes = [...panel.querySelectorAll<HTMLElement>('button:not([disabled]), input, textarea, select')];
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
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`secret-modal fixed inset-0 z-[220] flex items-end justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4 ${phase === 'out' ? 'secret-modal-out' : 'secret-modal-in'}`}
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget || event.animationName !== 'secret-modal-out') return;
        onExitEnd?.();
      }}
    >
      <button type="button" tabIndex={-1} className="absolute inset-0 bg-ink/40" aria-label="Close dialog" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="secret-modal-card relative max-h-[min(32rem,calc(100dvh-1.5rem))] w-full max-w-md overflow-y-auto border-2 border-ink bg-paper p-5 shadow-sticker sm:p-6"
      >
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]">Confirm</p>
        <h2 id={titleId} className="mt-2 font-display text-2xl font-black uppercase leading-none tracking-tight sm:text-3xl">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-ink/75">{body}</p>
        {children ? <div className="mt-4">{children}</div> : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" tone={tone === 'danger' ? 'danger' : undefined} onClick={onConfirm} disabled={pending}>
            {pending ? 'Working…' : confirmLabel}
          </Button>
          <Button type="button" tone="ghost" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
