export const TOUR_PAD = 12;
const MIN_CARD = 180;

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface TourBounds {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type TourMode = 'float' | 'sheet' | 'corner';

export interface TourFrame {
  mode: TourMode;
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

export function tourBounds(
  viewport: { width: number; height: number },
  inset: { top: number; bottom: number },
): TourBounds {
  return {
    top: Math.max(TOUR_PAD, inset.top),
    left: TOUR_PAD,
    right: Math.max(TOUR_PAD * 2, viewport.width - TOUR_PAD),
    bottom: Math.max(TOUR_PAD * 2, viewport.height - Math.max(TOUR_PAD, inset.bottom)),
  };
}

export function cardWidthFor(viewportWidth: number): number {
  return Math.min(352, Math.max(220, viewportWidth - TOUR_PAD * 2));
}

function overlaps(a: { top: number; left: number; width: number; height: number }, b: Rect): boolean {
  const gap = 8;
  return !(
    a.left + a.width <= b.left - gap
    || a.left >= b.left + b.width + gap
    || a.top + a.height <= b.top - gap
    || a.top >= b.top + b.height + gap
  );
}

function inside(frame: { top: number; left: number; width: number; height: number }, bounds: TourBounds): boolean {
  return (
    frame.top >= bounds.top - 1
    && frame.left >= bounds.left - 1
    && frame.top + frame.height <= bounds.bottom + 1
    && frame.left + frame.width <= bounds.right + 1
  );
}

/** Where the card goes when no side can hold it without covering the target or leaving the viewport. */
export function dockFrame(bounds: TourBounds, target: Rect | null, mobile: boolean, cardWidth: number): TourFrame {
  const roomH = Math.max(0, bounds.bottom - bounds.top);
  const roomW = Math.max(0, bounds.right - bounds.left);
  if (mobile || roomW < 520) {
    const maxHeight = Math.min(roomH, Math.max(MIN_CARD, Math.min(320, Math.round(roomH * 0.46))));
    const height = Math.min(roomH, maxHeight);
    return {
      mode: 'sheet',
      top: bounds.bottom - height,
      left: bounds.left,
      width: roomW,
      maxHeight: height,
    };
  }
  const width = Math.min(cardWidth, roomW);
  const maxHeight = Math.min(roomH, 300);
  const targetMid = target ? target.top + target.height / 2 : bounds.top;
  const viewMid = (bounds.top + bounds.bottom) / 2;
  const top = targetMid > viewMid ? bounds.top : Math.max(bounds.top, bounds.bottom - maxHeight);
  return {
    mode: 'corner',
    top,
    left: Math.max(bounds.left, bounds.right - width),
    width,
    maxHeight,
  };
}

/**
 * Float beside the target when it fits inside the viewport padding.
 * Otherwise dock to a corner, or a bottom sheet on a narrow screen.
 */
export function resolveTourFrame(input: {
  viewport: { width: number; height: number };
  inset: { top: number; bottom: number };
  target: Rect | null;
  card: { width: number; height: number };
  placed: { x: number; y: number } | null;
  referenceHidden: boolean;
  mobile: boolean;
}): TourFrame {
  const bounds = tourBounds(input.viewport, input.inset);
  const width = Math.min(input.card.width, Math.max(0, bounds.right - bounds.left));
  const roomH = Math.max(0, bounds.bottom - bounds.top);
  const natural = Math.max(input.card.height, MIN_CARD);
  const dock = () => dockFrame(bounds, input.target, input.mobile || input.viewport.width < 768, width);

  if (!input.target || input.referenceHidden || !input.placed) return dock();
  if (input.target.height > roomH * 0.72) return dock();
  if (roomH < MIN_CARD) return dock();

  const height = Math.min(natural, roomH);
  const top = Math.min(Math.max(input.placed.y, bounds.top), Math.max(bounds.top, bounds.bottom - height));
  const left = Math.min(Math.max(input.placed.x, bounds.left), Math.max(bounds.left, bounds.right - width));
  const frame = { top, left, width, height };
  const clipped = input.placed.y < bounds.top - 1 || input.placed.y + natural > bounds.bottom + 1;
  if (clipped || !inside(frame, bounds) || overlaps(frame, input.target)) return dock();
  return { mode: 'float', top, left, width, maxHeight: Math.max(0, bounds.bottom - top) };
}
