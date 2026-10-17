'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { ApiError, api } from '@/lib/api';

interface CallPlan {
  mode: 'phone' | 'browser';
  signedUrl: string | null;
  variables: Record<string, string>;
  notice: string | null;
}

export function CallBuyer({ orderId, open, onClose }: { orderId: string; open: boolean; onClose: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'calling' | 'live' | 'done'>('idle');
  const [notice, setNotice] = useState('');
  const session = useRef<{ endSession: () => Promise<void> } | null>(null);

  if (!open) return null;

  async function start() {
    setPhase('calling');
    setNotice('');
    try {
      const plan = await api<CallPlan>(`/orders/${orderId}/call`, { method: 'POST', body: JSON.stringify({ browser: true }) });
      if (plan.mode === 'phone') {
        setPhase('done');
        setNotice(plan.notice || 'Calling the buyer.');
        return;
      }
      if (!plan.signedUrl) {
        setPhase('idle');
        setNotice(plan.notice || 'Set ELEVENLABS_API_KEY to call the buyer.');
        return;
      }
      const mod = await import('@elevenlabs/client');
      const live = await mod.Conversation.startSession({
        signedUrl: plan.signedUrl,
        dynamicVariables: plan.variables,
      });
      session.current = live;
      setPhase('live');
      if (plan.notice) setNotice(plan.notice);
    } catch (err) {
      setPhase('idle');
      setNotice(err instanceof ApiError ? err.message : 'The browser call could not start.');
    }
  }

  async function hangup() {
    try {
      await session.current?.endSession();
    } catch {
      /* the session already ended */
    }
    session.current = null;
    setPhase('done');
  }

  return (
    <section className="border-2 border-ink bg-paper p-4 shadow-sticker" aria-label="Call the buyer">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]">Call the buyer</p>
      <p className="mt-2 text-sm leading-6">The call stays in this browser unless an outbound number is configured. The API key never leaves the server.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {phase === 'live' ? (
          <Button type="button" tone="danger" onClick={hangup}>End call</Button>
        ) : (
          <Button type="button" onClick={start} disabled={phase === 'calling'}>
            {phase === 'calling' ? 'Connecting…' : phase === 'done' ? 'Call again' : 'Start browser call'}
          </Button>
        )}
        <Button type="button" tone="ghost" onClick={onClose}>Close</Button>
      </div>
      {phase === 'live' ? <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink">On the call</p> : null}
      {notice ? <p className="mt-3 text-sm leading-6">{notice}</p> : null}
    </section>
  );
}
