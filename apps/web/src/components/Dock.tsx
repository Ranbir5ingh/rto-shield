'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';

export interface DockItem {
  id: string;
  href?: string;
  label: string;
  short: string;
  icon?: ComponentType<{ size?: number; 'aria-hidden'?: boolean | 'true' }>;
  mark?: ReactNode;
  current?: boolean;
  onPrefetch?: () => void;
  onSelect?: () => void;
}

interface Indicator {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Sharp floating dock. The lime block is one element that slides between items
 * (measured, then translated) so the active state moves instead of popping.
 */
export function Dock({
  items,
  label,
  placement,
}: {
  items: DockItem[];
  label: string;
  placement: 'bottom' | 'responsive';
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<Indicator | null>(null);
  const signature = items.map((item) => `${item.id}:${item.current ? 1 : 0}`).join('|');

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    let frame = 0;
    const measure = () => {
      const active = list.querySelector<HTMLElement>('[aria-current="page"]');
      if (!active) {
        setIndicator(null);
        return;
      }
      setIndicator({
        x: active.offsetLeft,
        y: active.offsetTop,
        w: active.offsetWidth,
        h: active.offsetHeight,
      });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(list);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [signature]);

  return (
    <div
      data-dock={placement}
      className={`pointer-events-none fixed z-[70] flex justify-center px-2 ${
        placement === 'bottom'
          ? 'inset-x-0 bottom-0 pb-[max(0.65rem,env(safe-area-inset-bottom))]'
          : 'inset-x-0 bottom-0 pb-[max(0.65rem,env(safe-area-inset-bottom))] md:bottom-auto md:top-4 md:pb-0'
      }`}
    >
      <nav aria-label={label} className="dock pointer-events-auto max-w-full">
        <div
          ref={listRef}
          className="relative flex max-w-[100vw] items-stretch overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {indicator ? (
            <span
              aria-hidden="true"
              className="dock-indicator"
              style={{
                width: indicator.w,
                height: indicator.h,
                transform: `translate(${indicator.x}px, ${indicator.y}px)`,
              }}
            />
          ) : null}
          {items.map((item) => {
            const Icon = item.icon;
            const className = `dock-item ${item.current ? 'text-ink' : 'text-inksoft'}`;
            const inner = (
              <>
                {item.mark ? item.mark : null}
                {Icon ? <Icon size={16} aria-hidden="true" /> : null}
                <span className="md:hidden">{item.short}</span>
                <span className="hidden md:inline">{item.label}</span>
              </>
            );
            if (!item.href) {
              return (
                <button key={item.id} type="button" className={className} onClick={item.onSelect}>
                  {inner}
                </button>
              );
            }
            if (item.href.startsWith('#') || item.href.startsWith('/#')) {
              return (
                <a
                  key={item.id}
                  href={item.href}
                  aria-current={item.current ? 'page' : undefined}
                  className={className}
                  onClick={item.onSelect}
                >
                  {inner}
                </a>
              );
            }
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={item.current ? 'page' : undefined}
                className={className}
                onMouseEnter={item.onPrefetch}
                onFocus={item.onPrefetch}
                onClick={item.onSelect}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
