'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState, type ComponentType, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

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
  className = '',
}: {
  items: DockItem[];
  label: string;
  placement: 'bottom' | 'responsive';
  className?: string;
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
      className={`pointer-events-none fixed z-[70] flex justify-center px-2 ${className} ${
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
            <DockEntry key={item.id} item={item} placement={placement} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function DockEntry({ item, placement }: { item: DockItem; placement: 'bottom' | 'responsive' }) {
  const held = useRef(false);
  const timer = useRef(0);
  const anchor = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const Icon = item.icon;
  const className = `dock-item ${item.current ? 'text-ink' : 'text-inksoft'}`;
  const inner = (
    <>
      {item.mark ? item.mark : null}
      {Icon ? <Icon size={16} aria-hidden="true" /> : null}
      <span className="dock-label">{item.label}</span>
      <DockTip label={item.label} open={open} tip={tip} />
    </>
  );

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const node = anchor.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const below = placement === 'responsive' && window.matchMedia('(min-width: 768px)').matches;
      setTip({ x: rect.left + rect.width / 2, y: below ? rect.bottom : rect.top, below });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, placement]);

  function pointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === 'mouse') return;
    held.current = false;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      held.current = true;
      setOpen(true);
    }, 420);
  }

  function pointerEnd(event: PointerEvent<HTMLElement>) {
    window.clearTimeout(timer.current);
    if (event.pointerType === 'mouse') return;
    if (held.current) {
      window.setTimeout(() => {
        held.current = false;
        setOpen(false);
      }, 1200);
      return;
    }
    setOpen(false);
  }

  function click(event: MouseEvent) {
    if (held.current) {
      event.preventDefault();
      held.current = false;
      return;
    }
    item.onSelect?.();
  }

  const handlers = {
    onPointerDown: pointerDown,
    onPointerUp: pointerEnd,
    onPointerCancel: pointerEnd,
    onMouseEnter: () => {
      item.onPrefetch?.();
      setOpen(true);
    },
    onMouseLeave: () => {
      if (!held.current) setOpen(false);
    },
    onFocus: () => {
      item.onPrefetch?.();
      setOpen(true);
    },
    onBlur: () => setOpen(false),
    onClick: click,
  };

  if (!item.href) {
    return (
      <button type="button" ref={(node) => { anchor.current = node; }} className={className} aria-label={item.label} {...handlers}>
        {inner}
      </button>
    );
  }
  if (item.href.startsWith('#') || item.href.startsWith('/#')) {
    return (
      <a
        href={item.href}
        ref={(node) => { anchor.current = node; }}
        aria-label={item.label}
        aria-current={item.current ? 'page' : undefined}
        className={className}
        {...handlers}
      >
        {inner}
      </a>
    );
  }
  return (
    <Link
      href={item.href}
      ref={(node) => { anchor.current = node; }}
      aria-label={item.label}
      aria-current={item.current ? 'page' : undefined}
      className={className}
      {...handlers}
    >
      {inner}
    </Link>
  );
}

function DockTip({ label, open, tip }: { label: string; open: boolean; tip: { x: number; y: number; below: boolean } | null }) {
  if (!open || !tip || typeof document === 'undefined') return null;
  return createPortal(
    <span
      role="tooltip"
      className="dock-tip dock-tip-fixed"
      style={{
        left: tip.x,
        top: tip.y,
        bottom: 'auto',
        height: 'auto',
        transform: tip.below ? 'translate(-50%, 8px)' : 'translate(-50%, calc(-100% - 8px))',
      }}
    >
      {label}
    </span>,
    document.body,
  );
}
