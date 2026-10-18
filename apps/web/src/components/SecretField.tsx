'use client';

import { useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ApiError, api } from '@/lib/api';
import { useToast } from '@/components/Toaster';
import { Button, Field, inputClass } from '@/components/ui';

export type SecretFieldName = 'whatsappToken' | 'whatsappAppSecret';

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
        <ConfirmDialog
          open
          phase={phase}
          tone="go"
          title={gate === 'edit' ? 'Edit the saved key' : 'Show the saved key'}
          body="Enter the password for this RTO Shield login. The key stays on this page."
          confirmLabel="Confirm"
          pending={pending}
          onConfirm={() => void confirm()}
          onClose={requestClose}
          onExitEnd={finishClose}
        >
          <Field label="RTO Shield password" error={passwordError}>
            <input
              className={inputClass}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void confirm();
                }
              }}
            />
          </Field>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
