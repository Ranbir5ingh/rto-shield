export const TOUR_PAD = 12;
export const TOUR_GAP = 12;

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

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(
    a.left + a.width <= b.left
    || a.left >= b.left + b.width
    || a.top + a.height <= b.top
    || a.top >= b.top + b.height
  );
}

function frameRect(frame: TourFrame, height: number): Rect {
  return { top: frame.top, left: frame.left, width: frame.width, height: Math.min(height, frame.maxHeight) };
}

/**
 * How far to scroll so the card can sit above or below the target.
 * Positive scrolls the target up. Negative scrolls it down.
 * Zero means a clear band already exists.
 */
export function scrollDeltaToClear(target: Rect, bounds: TourBounds, cardHeight: number): number {
  const room = Math.max(0, bounds.bottom - bounds.top);
  const height = Math.min(Math.max(cardHeight, 160), Math.max(120, room - TOUR_GAP));
  const roomBelow = bounds.bottom - (target.top + target.height + TOUR_GAP);
  const roomAbove = target.top - TOUR_GAP - bounds.top;
  if (roomBelow >= height || roomAbove >= height) return 0;
  const band = height + TOUR_GAP;
  if (target.height + band <= room + 1) {
    const wantBottom = bounds.bottom - band;
    const overflow = target.top + target.height - wantBottom;
    if (overflow > 1) return overflow;
  }
  const wantTop = bounds.top + band;
  if (target.top < wantTop - 1) return target.top - wantTop;
  return 0;
}

/**
 * Put the card above or below the target, inside the viewport inset.
 * Never returns a frame that intersects the target when a clear band exists.
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
  const narrow = input.mobile || input.viewport.width < 768;
  const width = narrow
    ? Math.max(160, bounds.right - bounds.left)
    : Math.min(input.card.width, Math.max(160, bounds.right - bounds.left));
  const room = Math.max(0, bounds.bottom - bounds.top);
  const height = Math.min(Math.max(input.card.height, 160), room);
  const anchorLeft = input.placed?.x ?? input.target?.left ?? bounds.left;
  const left = narrow
    ? bounds.left
    : Math.min(Math.max(bounds.left, anchorLeft), Math.max(bounds.left, bounds.right - width));
  if (input.referenceHidden && !input.target) {
    return { mode: 'float', top: bounds.top, left: bounds.left, width, maxHeight: height };
  }
  if (!input.target) {
    return { mode: 'float', top: bounds.top, left: bounds.left, width, maxHeight: height };
  }
  const roomBelow = bounds.bottom - (input.target.top + input.target.height + TOUR_GAP);
  const roomAbove = input.target.top - TOUR_GAP - bounds.top;
  const belowFits = roomBelow >= Math.min(height, 120);
  const aboveFits = roomAbove >= Math.min(height, 120);
  if (belowFits && (!aboveFits || roomBelow >= roomAbove)) {
    return {
      mode: 'float',
      top: input.target.top + input.target.height + TOUR_GAP,
      left,
      width,
      maxHeight: Math.max(0, Math.min(height, roomBelow)),
    };
  }
  if (aboveFits || roomAbove > roomBelow) {
    const maxHeight = Math.max(0, Math.min(height, roomAbove));
    return {
      mode: 'float',
      top: input.target.top - TOUR_GAP - maxHeight,
      left,
      width,
      maxHeight,
    };
  }
  const parked = {
    mode: 'float' as const,
    top: bounds.top,
    left,
    width,
    maxHeight: Math.min(height, Math.max(0, room / 2)),
  };
  if (rectsIntersect(frameRect(parked, height), input.target)) {
    const belowTop = Math.min(bounds.bottom - 1, input.target.top + input.target.height + TOUR_GAP);
    return { mode: 'float', top: belowTop, left, width, maxHeight: Math.max(0, bounds.bottom - belowTop) };
  }
  return parked;
}
