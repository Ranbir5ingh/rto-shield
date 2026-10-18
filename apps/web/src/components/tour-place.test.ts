import { describe, expect, it } from 'vitest';
import { rectsIntersect, resolveTourFrame, scrollDeltaToClear, tourBounds, type Rect } from './tour-place';

const inset = { top: 12, bottom: 88 };

function cardRect(frame: { top: number; left: number; width: number; maxHeight: number }, height: number): Rect {
  return { top: frame.top, left: frame.left, width: frame.width, height: Math.min(height, frame.maxHeight) };
}

describe('tour placement', () => {
  it('puts the card below a short target without covering it', () => {
    const target = { top: 80, left: 40, width: 280, height: 72 };
    const frame = resolveTourFrame({
      viewport: { width: 1280, height: 600 },
      inset,
      target,
      card: { width: 352, height: 240 },
      placed: { x: 40, y: 168 },
      referenceHidden: false,
      mobile: false,
    });
    const bounds = tourBounds({ width: 1280, height: 600 }, inset);
    const card = cardRect(frame, 240);
    expect(frame.mode).toBe('float');
    expect(frame.top).toBeGreaterThanOrEqual(target.top + target.height);
    expect(frame.top).toBeGreaterThanOrEqual(bounds.top);
    expect(card.top + card.height).toBeLessThanOrEqual(bounds.bottom + 1);
    expect(rectsIntersect(card, target)).toBe(false);
  });

  it('asks for a scroll when a phone target fills the screen', () => {
    const viewport = { width: 390, height: 844 };
    const bounds = tourBounds(viewport, inset);
    const target = { top: 70, left: 16, width: 358, height: 640 };
    const delta = scrollDeltaToClear(target, bounds, 260);
    expect(delta).not.toBe(0);
    const shifted = { ...target, top: target.top - delta };
    const frame = resolveTourFrame({
      viewport,
      inset,
      target: shifted,
      card: { width: 352, height: 260 },
      placed: null,
      referenceHidden: false,
      mobile: true,
    });
    const card = cardRect(frame, 260);
    expect(frame.mode).toBe('float');
    expect(rectsIntersect(card, shifted)).toBe(false);
    expect(frame.top).toBeGreaterThanOrEqual(bounds.top - 1);
  });

  it('places the card above a wide desktop target instead of covering it', () => {
    const target = { top: 420, left: 80, width: 880, height: 200 };
    const frame = resolveTourFrame({
      viewport: { width: 1280, height: 800 },
      inset,
      target,
      card: { width: 352, height: 260 },
      placed: { x: 400, y: 200 },
      referenceHidden: false,
      mobile: false,
    });
    const card = cardRect(frame, 260);
    expect(frame.mode).toBe('float');
    expect(card.top + card.height).toBeLessThanOrEqual(target.top);
    expect(rectsIntersect(card, target)).toBe(false);
  });

  it('floats below a small target when the side is clear', () => {
    const target = { top: 120, left: 80, width: 240, height: 64 };
    const frame = resolveTourFrame({
      viewport: { width: 1440, height: 900 },
      inset,
      target,
      card: { width: 352, height: 220 },
      placed: { x: 80, y: 200 },
      referenceHidden: false,
      mobile: false,
    });
    expect(frame.mode).toBe('float');
    expect(frame.top).toBeGreaterThanOrEqual(target.top + target.height);
    expect(rectsIntersect(cardRect(frame, 220), target)).toBe(false);
  });
});
