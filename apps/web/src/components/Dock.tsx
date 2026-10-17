'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState, type ComponentType, type MouseEvent, type PointerEvent, type ReactNode } from 'react';

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
          {items.map((item) => (
            <DockEntry key={item.id} item={item} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function DockEntry({ item }: { item: DockItem }) {
  const held = useRef(false);
  const timer = useRef(0);
  const Icon = item.icon;
  const className = `dock-item ${item.current ? 'text-ink' : 'text-inksoft'}`;
  const inner = (
    <>
      {item.mark ? item.mark : null}
      {Icon ? <Icon size={16} aria-hidden="true" /> : null}
      <span className="dock-label">{item.label}</span>
      <span className="dock-tip" role="tooltip">
        {item.label}
      </span>
    </>
  );

  function pointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === 'mouse') return;
    held.current = false;
    const node = event.currentTarget;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      held.current = true;
      node.dataset.held = '1';
    }, 420);
  }

  function pointerEnd(event: PointerEvent<HTMLElement>) {
    window.clearTimeout(timer.current);
    const node = event.currentTarget;
    if (node.dataset.held === '1') {
      window.setTimeout(() => {
        delete node.dataset.held;
      }, 1200);
      return;
    }
    delete node.dataset.held;
  }

  function click(event: MouseEvent) {
    if (held.current) {
      event.preventDefault();
      held.current = false;
      return;
    }
    item.onSelect?.();
  }

  if (!item.href) {
    return (
      <button type="button" className={className} aria-label={item.label} onPointerDown={pointerDown} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onClick={click}>
        {inner}
      </button>
    );
  }
  if (item.href.startsWith('#') || item.href.startsWith('/#')) {
    return (
      <a
        href={item.href}
        aria-label={item.label}
        aria-current={item.current ? 'page' : undefined}
        className={className}
        onPointerDown={pointerDown}
        onPointerUp={pointerEnd}
        onPointerCancel={pointerEnd}
        onClick={click}
      >
        {inner}
      </a>
    );
  }
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={item.current ? 'page' : undefined}
      className={className}
      onMouseEnter={item.onPrefetch}
      onFocus={item.onPrefetch}
      onPointerDown={pointerDown}
      onPointerUp={pointerEnd}
      onPointerCancel={pointerEnd}
      onClick={click}
    >
      {inner}
    </Link>
  );
}
