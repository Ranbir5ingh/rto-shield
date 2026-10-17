'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ApiError, api } from '@/lib/api';
import { useToast } from '@/components/Toaster';
import { Button, Field, inputClass } from '@/components/ui';

export type SecretFieldName = 'whatsappToken' | 'whatsappAppSecret' | 'geminiKey';

export function maskedSecret(last4: string) {
  return last4 ? `••••••••${last4}` : '';
}

export function SecretField({
  label,
  field,
  last4,
  draft,
  onDraftChange,
  error,
}: {
  label: string;
  field: SecretFieldName;
  last4: string;
  draft: string | null;
  onDraftChange: (value: string | null) => void;
  error?: string;
}) {
  const toast = useToast();
  const [revealed, setRevealed] = useState('');
  const [editing, setEditing] = useState(false);
  const [gate, setGate] = useState<'reveal' | 'edit' | null>(null);
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [pending, setPending] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<number | null>(null);

  function finishClose() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setGate(null);
    setPassword('');
    setPasswordError('');
    returnFocus.current?.focus();
  }

  function requestClose() {
    if (phase === 'out') return;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finishClose();
      return;
    }
    setPhase('out');
    closeTimer.current = window.setTimeout(finishClose, 420);
  }

  function openGate(next: 'reveal' | 'edit', opener: HTMLElement | null) {
    returnFocus.current = opener;
    setRevealed('');
    setPassword('');
    setPasswordError('');
    setPhase('in');
    setGate(next);
  }

  async function confirm() {
    if (!password) {
      setPasswordError('Enter your RTO Shield password.');
      return;
    }
    setPasswordError('');
    setPending(true);
    try {
      const body = await api<{ value: string }>('/settings/secrets/reveal', {
        method: 'POST',
        body: JSON.stringify({ field, password }),
      });
      if (gate === 'edit') {
        setEditing(true);
        setRevealed('');
        onDraftChange(body.value);
      } else {
        setRevealed(body.value);
        setEditing(false);
        toast.info('Showing the saved secret on this page only.');
      }
      requestClose();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not reveal that secret');
    } finally {
      setPending(false);
    }
  }

  if (!last4 || editing) {
    return (
      <div>
        <Field label={label} error={error}>
          <input
            className={inputClass}
            type={editing ? 'text' : 'password'}
            autoComplete="new-password"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={draft ?? ''}
            onChange={(event) => onDraftChange(event.target.value)}
          />
        </Field>
        {editing ? (
          <div className="mt-2">
            <Button
              type="button"
              tone="ghost"
              onClick={() => {
                setEditing(false);
                onDraftChange(null);
              }}
            >
              Cancel
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <Field label={label}>
        <input className={`${inputClass} font-mono`} readOnly value={revealed || maskedSecret(last4)} spellCheck={false} autoComplete="off" />
      </Field>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-ink">Saved</span>
        {revealed ? (
          <Button type="button" tone="ghost" onClick={() => setRevealed('')}>
            Hide
          </Button>
        ) : (
          <Button type="button" tone="ghost" onClick={(event) => openGate('reveal', event.currentTarget)}>
            Reveal
          </Button>
        )}
        <Button type="button" tone="ghost" onClick={(event) => openGate('edit', event.currentTarget)}>
          Edit
        </Button>
      </div>
      {gate ? (
        <SecretPasswordDialog
          mode={gate}
          phase={phase}
          password={password}
          passwordError={passwordError}
          pending={pending}
          onPassword={setPassword}
          onConfirm={() => void confirm()}
          onClose={requestClose}
          onExitEnd={finishClose}
        />
      ) : null}
    </div>
  );
}

function SecretPasswordDialog({
  mode,
  phase,
  password,
  passwordError,
  pending,
  onPassword,
  onConfirm,
  onClose,
  onExitEnd,
}: {
  mode: 'reveal' | 'edit';
  phase: 'in' | 'out';
  password: string;
  passwordError: string;
  pending: boolean;
  onPassword: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  onExitEnd: () => void;
}) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const title = mode === 'edit' ? 'Edit the saved key' : 'Show the saved key';

  useEffect(() => {
    inputRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const nodes = [...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input')];
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
  }, []);

  return createPortal(
    <div
      className={`secret-modal fixed inset-0 z-[220] flex items-center justify-center px-4 ${phase === 'out' ? 'secret-modal-out' : 'secret-modal-in'}`}
      onAnimationEnd={(event) => {
        if (event.target !== event.currentTarget || event.animationName !== 'secret-modal-out') return;
        onExitEnd();
      }}
    >
      <button type="button" tabIndex={-1} className="absolute inset-0 bg-ink/40 backdrop-blur-[3px]" aria-label="Close password prompt" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="secret-modal-card relative w-full max-w-md border-2 border-ink bg-white p-6 shadow-sticker"
      >
        <p className="eyebrow">Password</p>
        <h2 id={titleId} className="mt-2 font-display text-3xl">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink/75">Enter the password for this RTO Shield login. The key stays on this page.</p>
        <div className="mt-5">
          <Field label="RTO Shield password" error={passwordError}>
            <input
              ref={inputRef}
              className={inputClass}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => onPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onConfirm();
                }
              }}
            />
          </Field>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" onClick={onConfirm} disabled={pending}>
            {pending ? 'Checking…' : 'Confirm'}
          </Button>
          <Button type="button" tone="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
