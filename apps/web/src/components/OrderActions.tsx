'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom';
import { Banknote, Check, MapPin, Phone, SkipForward, Volume2, X } from 'lucide-react';
import { Button } from '@/components/ui';
import type { OrderSummary } from '@/lib/types';

export function actionCopy(order: Pick<OrderSummary, 'intervention' | 'whatsappStatus'>) {
  switch (order.intervention) {
    case 'request_address':
      return { id: 'address', label: 'Ask for landmark' };
    case 'offer_prepaid':
      return { id: 'prepaid', label: 'Offer prepaid' };
    case 'hold_review':
      return { id: 'hold', label: 'Hold for review' };
    case 'auto_confirm':
      return { id: 'confirmed', label: 'Auto-confirmed' };
    default:
      return { id: 'send', label: order.whatsappStatus && order.whatsappStatus !== 'failed' ? 'WhatsApp sent' : 'Approve & send' };
  }
}

const SHEET_QUERY = '(max-width: 639px)';

export function OrderActions({
  order,
  busy,
  canSend,
  tour,
  showCallButton,
  compact,
  showHint = true,
  onPrimary,
  onOutcome,
  onPrepaid,
  onCall,
  onVoice,
  onPin,
}: {
  order: OrderSummary;
  busy?: boolean;
  canSend?: boolean;
  tour?: boolean;
  showCallButton?: boolean;
  compact?: boolean;
  showHint?: boolean;
  onPrimary: () => void;
  onOutcome: (value: 'confirmed' | 'cancelled' | 'no_response') => void;
  onPrepaid: () => void;
  onCall: () => void;
  onVoice: () => void;
  onPin: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLSpanElement>(null);
  const primary = actionCopy(order);
  const closed = order.stage === 'closed';
  const slim = compact ? '!px-4 !py-2.5 !text-[11px]' : '';

  useEffect(() => {
    const media = window.matchMedia(SHEET_QUERY);
    const apply = () => setSheet(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[data-more-menu]')) return;
      if (target instanceof Element && target.closest('#tour-card')) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (document.getElementById('tour-card')) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function choose(run: () => void) {
    setOpen(false);
    run();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" data-tour={tour ? 'next-action' : undefined} data-send={canSend ? '1' : '0'}>
        <span data-tour={tour ? 'hold-approve' : undefined}>
          <Button type="button" disabled={busy || closed || primary.id === 'hold' || primary.id === 'confirmed'} onClick={onPrimary} className={slim}>
            {busy ? 'Working…' : primary.label}
          </Button>
        </span>
        {showCallButton && !closed ? (
          <Button type="button" tone="ghost" onClick={onCall} className={slim}>
            Call buyer
          </Button>
        ) : null}
        <div className="relative" ref={rootRef}>
          <span ref={buttonRef} className="inline-flex">
            <Button
              type="button"
              tone="ghost"
              aria-expanded={open}
              aria-haspopup="menu"
              data-tour-open={tour ? 'more' : undefined}
              onClick={() => setOpen((value) => !value)}
              className={slim}
            >
              More
            </Button>
          </span>
          <MoreMenu open={open} sheet={sheet} tour={tour} anchorRef={buttonRef} onClose={() => setOpen(false)}>
            <p className="bg-hl/60 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em]" aria-hidden="true">Decide</p>
            <MenuItem icon={<Check size={14} />} label="Confirmed" tour={tour ? 'menu-confirmed' : undefined} onClick={() => choose(() => onOutcome('confirmed'))} />
            <MenuItem icon={<X size={14} />} label="Cancelled" tour={tour ? 'menu-cancelled' : undefined} onClick={() => choose(() => onOutcome('cancelled'))} />
            <MenuItem icon={<SkipForward size={14} />} label="Skip" tour={tour ? 'menu-skip' : undefined} onClick={() => choose(() => onOutcome('no_response'))} />
            <p className="border-t-2 border-ink bg-hl/60 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em]" aria-hidden="true">This order</p>
            <MenuItem icon={<Banknote size={14} />} label="Offer prepaid" tour={tour ? 'menu-prepaid' : undefined} onClick={() => choose(onPrepaid)} />
            {showCallButton ? null : <MenuItem icon={<Phone size={14} />} label="Call the buyer" tour={tour ? 'menu-call' : undefined} onClick={() => choose(onCall)} />}
            <MenuItem icon={<Volume2 size={14} />} label="Play Hindi" tour={tour ? 'menu-voice' : undefined} onClick={() => choose(onVoice)} />
            <MenuItem icon={<MapPin size={14} />} label="Check pincode" tour={tour ? 'menu-pin' : undefined} onClick={() => choose(onPin)} />
          </MoreMenu>
        </div>
      </div>
      {showHint && order.interventionWhy ? <p className="mt-2 max-w-80 font-mono text-[11px] font-bold uppercase leading-5 tracking-[0.08em] text-inksoft">{order.interventionWhy}</p> : null}
    </div>
  );
}

function MoreMenu({
  open,
  sheet,
  tour,
  anchorRef,
  onClose,
  children,
}: {
  open: boolean;
  sheet: boolean;
  tour?: boolean;
  anchorRef: RefObject<HTMLSpanElement | null>;
  onClose: () => void;
  children: ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!open || sheet) return;
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;
    return autoUpdate(anchor, menu, () => {
      void computePosition(anchor, menu, {
        strategy: 'fixed',
        placement: 'bottom-start',
        middleware: [
          offset(8),
          flip({ padding: 12 }),
          shift({ padding: 12 }),
          size({
            padding: 12,
            apply({ availableHeight }) {
              const cap = Math.min(384, window.innerHeight - 24, Math.max(0, availableHeight));
              menu.style.maxHeight = `${Math.max(160, cap)}px`;
            },
          }),
        ],
      }).then((next) => setPos({ x: next.x, y: next.y }));
    });
  }, [anchorRef, open, sheet]);

  if (!open || typeof document === 'undefined') return null;

  const menu = (
    <div
      ref={menuRef}
      role="menu"
      data-more-menu="true"
      data-tour={tour ? 'more-menu' : undefined}
      className={
        sheet
          ? 'fixed inset-x-0 bottom-0 z-[81] max-h-[70dvh] overflow-y-auto border-t-2 border-ink bg-paper pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_0_0_#1B1712]'
          : 'z-[80] w-64 overflow-auto border-2 border-ink bg-paper shadow-sticker'
      }
      style={sheet ? undefined : { position: 'fixed', top: pos?.y ?? 0, left: pos?.x ?? 0, visibility: pos ? 'visible' : 'hidden' }}
    >
      {children}
    </div>
  );

  return createPortal(
    <>
      {sheet ? <button type="button" className="fixed inset-0 z-[80] bg-ink/40" aria-label="Close menu" onClick={onClose} /> : null}
      {menu}
    </>,
    document.body,
  );
}

function MenuItem({ label, icon, onClick, tour }: { label: string; icon: ReactNode; onClick: () => void; tour?: string }) {
  return (
    <button
      type="button"
      role="menuitem"
      data-tour={tour}
      className="flex w-full items-center gap-2 border-b-2 border-ink bg-paper px-3 py-2.5 text-left font-mono text-[11px] font-bold uppercase tracking-[0.12em] last:border-b-0 hover:bg-lime"
      onClick={onClick}
    >
      <span aria-hidden="true" className="grid h-4 w-4 shrink-0 place-items-center">{icon}</span>
      {label}
    </button>
  );
}
