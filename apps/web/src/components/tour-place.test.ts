import { describe, expect, it } from 'vitest';
import { resolveTourFrame, tourBounds } from './tour-place';

const inset = { top: 12, bottom: 88 };

describe('tour placement', () => {
  it('keeps a floating card inside a short laptop viewport', () => {
    const frame = resolveTourFrame({
      viewport: { width: 1280, height: 600 },
      inset,
      target: { top: 80, left: 40, width: 280, height: 72 },
      card: { width: 352, height: 240 },
      placed: { x: 40, y: 168 },
      referenceHidden: false,
      mobile: false,
    });
    const bounds = tourBounds({ width: 1280, height: 600 }, inset);
    expect(frame.top).toBeGreaterThanOrEqual(bounds.top);
    expect(frame.top + Math.min(frame.maxHeight, 240)).toBeLessThanOrEqual(bounds.bottom + 1);
    expect(frame.left).toBeGreaterThanOrEqual(bounds.left);
    expect(frame.left + frame.width).toBeLessThanOrEqual(bounds.right + 1);
  });

  it('docks a bottom sheet on a phone when the target fills the screen', () => {
    const frame = resolveTourFrame({
      viewport: { width: 390, height: 844 },
      inset,
      target: { top: 70, left: 16, width: 358, height: 640 },
      card: { width: 352, height: 260 },
      placed: { x: 16, y: 720 },
      referenceHidden: false,
      mobile: true,
    });
    const bounds = tourBounds({ width: 390, height: 844 }, inset);
    expect(frame.mode).toBe('sheet');
    expect(frame.top).toBeGreaterThanOrEqual(bounds.top);
    expect(frame.top + frame.maxHeight).toBeLessThanOrEqual(bounds.bottom + 1);
    expect(frame.left).toBe(bounds.left);
    expect(frame.width).toBe(bounds.right - bounds.left);
  });

  it('docks a corner on a short desktop when the card would cover the target', () => {
    const target = { top: 40, left: 200, width: 880, height: 420 };
    const frame = resolveTourFrame({
      viewport: { width: 1280, height: 600 },
      inset,
      target,
      card: { width: 352, height: 260 },
      placed: { x: 400, y: 200 },
      referenceHidden: false,
      mobile: false,
    });
    const bounds = tourBounds({ width: 1280, height: 600 }, inset);
    expect(frame.mode).toBe('corner');
    expect(frame.top).toBeGreaterThanOrEqual(bounds.top);
    expect(frame.top + frame.maxHeight).toBeLessThanOrEqual(bounds.bottom + 1);
    expect(frame.left + frame.width).toBeLessThanOrEqual(bounds.right + 1);
  });

  it('floats beside a small target when the side is clear', () => {
    const frame = resolveTourFrame({
      viewport: { width: 1440, height: 900 },
      inset,
      target: { top: 120, left: 80, width: 240, height: 64 },
      card: { width: 352, height: 220 },
      placed: { x: 80, y: 200 },
      referenceHidden: false,
      mobile: false,
    });
    expect(frame.mode).toBe('float');
    expect(frame.top).toBe(200);
    expect(frame.left).toBe(80);
  });
});
