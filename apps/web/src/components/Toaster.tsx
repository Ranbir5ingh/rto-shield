'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((current) => [...current.slice(-3), { id, tone, message }]);
      const timer = window.setTimeout(() => dismiss(id), 4800);
      timers.current.push(timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(22rem,calc(100%-2rem))] flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            role={item.tone === 'error' ? 'alert' : 'status'}
            className={`toast-in pointer-events-auto sticker-sm flex items-start justify-between gap-3 px-4 py-3 ${
              item.tone === 'success' ? '!bg-lime/40' : item.tone === 'error' ? '!bg-risk/15' : '!bg-sky/25'
            }`}
          >
            <p className="font-mono text-xs leading-5 text-ink">{item.message}</p>
            <button type="button" className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink/70" onClick={() => dismiss(item.id)}>
              Close
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const api = useContext(ToastContext);
  if (!api) throw new Error('ToastProvider is missing');
  return api;
}
