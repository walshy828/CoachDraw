import { describe, expect, it } from 'vitest';
import { cleanStroke, dist, fitCircle, pathLength } from '../shared/geometry';
import type { Pt } from '../shared/types';

const rng = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646 - 0.5;
};

describe('cleanStroke', () => {
  it('turns a wobbly circle into a true circle', () => {
    const r = rng(7);
    const raw: Pt[] = [];
    for (let i = 0; i <= 60; i++) {
      const a = (i / 60) * 2 * Math.PI * 1.03;
      const rad = 10 + r() * 1.6;
      raw.push({ x: 50 + rad * Math.cos(a), y: 40 + rad * Math.sin(a) });
    }
    const out = cleanStroke(raw, true);
    const c = fitCircle(out)!;
    const maxErr = Math.max(...out.map((p) => Math.abs(dist(p, c) - c.r)));
    expect(maxErr).toBeLessThan(0.05);
    expect(c.r).toBeGreaterThan(9);
    expect(c.r).toBeLessThan(11);
  });

  it('snaps a nearly straight stroke to a line', () => {
    const r = rng(3);
    const raw = Array.from({ length: 40 }, (_, i) => ({ x: i * 2, y: 20 + r() * 1.2 }));
    expect(cleanStroke(raw, true)).toHaveLength(2);
  });

  it('smooths a jittery curve and keeps its endpoints', () => {
    const r = rng(11);
    const raw = Array.from({ length: 50 }, (_, i) => ({ x: i * 2, y: 30 + 15 * Math.sin(i / 10) + r() * 1.5 }));
    const out = cleanStroke(raw, true);
    expect(out[0]).toEqual(raw[0]);
    expect(dist(out[out.length - 1], raw[raw.length - 1])).toBeLessThan(0.01);
    expect(out.length).toBeGreaterThan(5);
    expect(pathLength(out)).toBeLessThan(pathLength(raw)); // jitter removed
  });

  it('leaves the stroke essentially as drawn when cleanup is off', () => {
    const raw = Array.from({ length: 30 }, (_, i) => ({ x: i, y: Math.sin(i / 2) * 5 + 20 }));
    const out = cleanStroke(raw, false);
    expect(out.length).toBeGreaterThan(10);
  });
});
