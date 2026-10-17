'use client';

import { useState } from 'react';
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

export function OrderActions({
  order,
  busy,
  canSend,
  tour,
  showCallButton,
  compact,
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
  onPrimary: () => void;
  onOutcome: (value: 'confirmed' | 'cancelled' | 'no_response') => void;
  onPrepaid: () => void;
  onCall: () => void;
  onVoice: () => void;
  onPin: () => void;
}) {
  const [open, setOpen] = useState(false);
  const primary = actionCopy(order);
  const closed = order.stage === 'closed';
  const slim = compact ? '!px-4 !py-2.5 !text-[11px]' : '';
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" data-tour={tour ? 'next-action' : undefined} data-send={canSend ? '1' : '0'}>
        <span data-tour={tour ? 'approve-send' : undefined}>
          <Button type="button" disabled={busy || closed || primary.id === 'hold' || primary.id === 'confirmed'} onClick={onPrimary} className={slim}>
            {busy ? 'Working…' : primary.label}
          </Button>
        </span>
        {showCallButton && !closed ? (
          <Button type="button" tone="ghost" onClick={onCall} className={slim}>
            Call buyer
          </Button>
        ) : null}
        <div className="relative">
          <Button type="button" tone="ghost" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)} className={slim}>
            More
          </Button>
          {open ? (
            <div role="menu" className="absolute left-0 z-20 mt-1 min-w-44 border-2 border-ink bg-paper shadow-sticker">
              <MenuItem label="Confirmed" onClick={() => { setOpen(false); onOutcome('confirmed'); }} />
              <MenuItem label="Cancelled" onClick={() => { setOpen(false); onOutcome('cancelled'); }} />
              <MenuItem label="Skip" onClick={() => { setOpen(false); onOutcome('no_response'); }} />
              <MenuItem label="Offer prepaid" onClick={() => { setOpen(false); onPrepaid(); }} />
              {showCallButton ? null : <MenuItem label="Call the buyer" onClick={() => { setOpen(false); onCall(); }} />}
              <MenuItem label="Play Hindi" onClick={() => { setOpen(false); onVoice(); }} />
              <MenuItem label="Pincode" onClick={() => { setOpen(false); onPin(); }} />
            </div>
          ) : null}
        </div>
      </div>
      {order.interventionWhy ? <p className="mt-2 max-w-80 font-mono text-[11px] font-bold uppercase leading-5 tracking-[0.08em] text-inksoft">{order.interventionWhy}</p> : null}
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" className="block w-full border-b-2 border-ink px-3 py-2 text-left font-mono text-[11px] font-bold uppercase tracking-[0.12em] last:border-b-0 hover:bg-lime" onClick={onClick}>
      {label}
    </button>
  );
}
