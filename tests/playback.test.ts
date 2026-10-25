import { describe, expect, it } from 'vitest';
import { buildTimeline, frameAt } from '../shared/playback';
import { sampleDrills } from '../server/seed';
import type { DrillDoc } from '../shared/types';

const doc: DrillDoc = {
  colors: { off: '#f00', def: '#00f' },
  steps: [
    { id: 's1', title: '1', caption: '' },
    { id: 's2', title: '2', caption: '' },
  ],
  tokens: [
    { id: 'a', kind: 'player', label: 'C', team: 'off', x: 10, y: 10 },
    { id: 'b', kind: 'player', label: 'RW', team: 'off', x: 60, y: 40 },
    { id: 'p', kind: 'puck', label: '', team: 'off', x: 10, y: 10 },
  ],
  paths: [
    { id: 'p1', tokenId: 'a', kind: 'carry', stepId: 's1', color: '#f00', points: [{ x: 10, y: 10 }, { x: 36, y: 10 }] },
    { id: 'p2', tokenId: 'p', kind: 'pass', stepId: 's2', color: '#f00', points: [{ x: 36, y: 10 }, { x: 60, y: 40 }] },
  ],
};

describe('playback', () => {
  const tl = buildTimeline(doc);

  it('runs steps in sequence', () => {
    expect(tl.starts[0]).toBe(0);
    expect(tl.starts[1]).toBeCloseTo(tl.durations[0]);
    expect(tl.total).toBeCloseTo(tl.durations[0] + tl.durations[1]);
  });

  it('puck travels with the carrier, then is passed to the receiver', () => {
    const mid = frameAt(doc, tl, tl.durations[0] / 2);
    expect(mid.holder).toBe('a');
    expect(mid.pos.a.x).toBeGreaterThan(10);
    expect(mid.pos.p).toEqual(mid.pos.a);

    const afterStep1 = frameAt(doc, tl, tl.starts[1]);
    expect(afterStep1.pos.a).toEqual({ x: 36, y: 10 });

    const end = frameAt(doc, tl, tl.total + 1);
    expect(end.pos.p).toEqual({ x: 60, y: 40 });
    expect(end.holder).toBe('b');
  });

  it('next step starts where the previous one ended', () => {
    expect(tl.startFrames[1].pos.a).toEqual({ x: 36, y: 10 });
  });
});

describe('sample drills', () => {
  for (const s of sampleDrills()) {
    it(`${s.meta.name} is well-formed`, () => {
      const ids = new Set(s.doc.tokens.map((t) => t.id));
      const steps = new Set(s.doc.steps.map((t) => t.id));
      expect(s.doc.steps.length).toBeGreaterThanOrEqual(3);
      for (const p of s.doc.paths) {
        expect(steps.has(p.stepId)).toBe(true);
        expect(p.tokenId === null || ids.has(p.tokenId)).toBe(true);
        expect(p.points.length).toBeGreaterThanOrEqual(2);
        for (const pt of p.points) {
          expect(pt.x).toBeGreaterThanOrEqual(0);
          expect(pt.x).toBeLessThanOrEqual(200);
          expect(pt.y).toBeGreaterThanOrEqual(0);
          expect(pt.y).toBeLessThanOrEqual(85);
        }
      }
      const tl = buildTimeline(s.doc);
      expect(tl.total).toBeGreaterThan(3);
      // every moving token ends inside the rink
      for (const pos of Object.values(tl.endFrame.pos)) {
        expect(pos.x).toBeGreaterThanOrEqual(0);
        expect(pos.x).toBeLessThanOrEqual(200);
      }
    });
  }
});

describe('timing: holds and triggers', () => {
  const mk = (extra: Partial<DrillDoc['paths'][number]>): DrillDoc => ({
    colors: { off: '#f00', def: '#00f' },
    steps: [{ id: 's1', title: '1', caption: '' }],
    tokens: [
      { id: 'w', kind: 'player', label: 'RW', team: 'off', x: 0, y: 0 },
      { id: 'd', kind: 'player', label: 'RD', team: 'off', x: 50, y: 50 },
    ],
    paths: [
      { id: 'pw', tokenId: 'w', kind: 'skate', stepId: 's1', color: '#f00', points: [{ x: 0, y: 0 }, { x: 52, y: 0 }] },
      { id: 'pd', tokenId: 'd', kind: 'skate', stepId: 's1', color: '#f00', points: [{ x: 50, y: 50 }, { x: 50, y: 100 }], ...extra },
    ],
  });

  it('a trigger holds the player until the other line reaches the point', () => {
    const doc = mk({ after: { pathId: 'pw', at: 0.5 } });
    const tl = buildTimeline(doc);
    const w = tl.times[0].pw;
    expect(tl.times[0].pd.start).toBeCloseTo(w.start + 0.5 * (w.end - w.start));
    const before = frameAt(doc, tl, tl.times[0].pd.start - 0.1);
    expect(before.pos.d).toEqual({ x: 50, y: 50 });
    const after = frameAt(doc, tl, tl.times[0].pd.start + 0.3);
    expect(after.pos.d.y).toBeGreaterThan(50);
  });

  it('adds a fixed delay and scales duration with speed', () => {
    const plain = buildTimeline(mk({}));
    const held = buildTimeline(mk({ delay: 2 }));
    expect(held.times[0].pd.start).toBeCloseTo(2);
    const fast = buildTimeline(mk({ speed: 2 }));
    const d0 = plain.times[0].pd.end - plain.times[0].pd.start;
    expect(fast.times[0].pd.end - fast.times[0].pd.start).toBeCloseTo(Math.max(1, d0 * 1) / 2, 0);
  });

  it('ignores dependency cycles instead of hanging', () => {
    const doc = mk({ after: { pathId: 'pw', at: 0.5 } });
    doc.paths[0].after = { pathId: 'pd', at: 0.5 };
    expect(() => buildTimeline(doc)).not.toThrow();
  });
});
