'use client';

import { useState } from 'react';
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
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [pending, setPending] = useState(false);

  function cancelGate() {
    setGate(null);
    setPassword('');
    setPasswordError('');
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
      cancelGate();
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
          <Button type="button" tone="ghost" onClick={() => setGate('reveal')}>
            Reveal
          </Button>
        )}
        <Button
          type="button"
          tone="ghost"
          onClick={() => {
            setRevealed('');
            setGate('edit');
          }}
        >
          Edit
        </Button>
      </div>
      {gate ? (
        <div className="mt-3 space-y-2">
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
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void confirm()} disabled={pending}>
              {pending ? 'Checking…' : 'Confirm'}
            </Button>
            <Button type="button" tone="ghost" onClick={cancelGate}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
