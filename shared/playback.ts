import { dist, pathLength, pointAt } from './geometry';
import type { DrawPath, DrillDoc, PathKind, Pt } from './types';

/** Animation speeds in feet per second. */
export const SPEED: Record<PathKind, number> = { skate: 26, carry: 22, back: 16, pass: 65, shot: 90 };
const MIN_PATH_SECONDS = 1;
const EMPTY_STEP_SECONDS = 1;
const PICKUP_RADIUS = 4;

export interface Frame {
  pos: Record<string, Pt>;
  /** Player currently carrying the puck (puck is drawn on their stick). */
  holder: string | null;
}

interface Seg {
  path: DrawPath;
  t0: number;
  t1: number;
  len: number;
}

/** Times are in seconds from the start of the step the path belongs to. */
export interface PathTiming {
  start: number;
  end: number;
  /** Time the delay is measured from: the trigger moment, or the end of the token's previous line, or 0. */
  base: number;
}

export interface Timeline {
  starts: number[];
  durations: number[];
  /** Frame at the start of each step. */
  startFrames: Frame[];
  endFrame: Frame;
  total: number;
  movers: Map<string, Seg[]>[];
  times: Record<string, PathTiming>[];
}

export const clampSpeed = (v: number | undefined) => (Number.isFinite(v) ? Math.min(4, Math.max(0.25, v as number)) : 1);
export const baseSeconds = (p: DrawPath) => Math.max(MIN_PATH_SECONDS, pathLength(p.points) / SPEED[p.kind]);
export const pathSeconds = (p: DrawPath) => baseSeconds(p) / clampSpeed(p.speed);

const animates = (p: DrawPath, stepId: string) => p.stepId === stepId && !!p.tokenId && p.points.length >= 2;

function resolveStep(doc: DrillDoc, stepId: string) {
  const list = doc.paths.filter((p) => animates(p, stepId));
  const byId = new Map(list.map((p) => [p.id, p]));
  const prevSame = new Map<string, DrawPath>();
  const lastOf = new Map<string, DrawPath>();
  for (const p of list) {
    const prev = lastOf.get(p.tokenId!);
    if (prev) prevSame.set(p.id, prev);
    lastOf.set(p.tokenId!, p);
  }

  const memo = new Map<string, PathTiming>();
  const visiting = new Set<string>();
  const resolve = (p: DrawPath): PathTiming => {
    const done = memo.get(p.id);
    if (done) return done;
    if (visiting.has(p.id)) return { start: 0, end: 0, base: 0 }; // dependency cycle: ignore
    visiting.add(p.id);
    const prev = prevSame.get(p.id);
    const prevEnd = prev ? resolve(prev).end : 0;
    const src = p.after && p.after.pathId !== p.id ? byId.get(p.after.pathId) : undefined;
    let base = prevEnd;
    if (src) {
      const r = resolve(src);
      const at = Math.min(1, Math.max(0, p.after!.at));
      base = r.start + at * (r.end - r.start);
    }
    const start = Math.max(prevEnd, base + Math.max(0, p.delay ?? 0));
    const t = { start, end: start + pathSeconds(p), base };
    visiting.delete(p.id);
    memo.set(p.id, t);
    return t;
  };

  const movers = new Map<string, Seg[]>();
  const times: Record<string, PathTiming> = {};
  let duration = 0;
  for (const p of list) {
    const t = resolve(p);
    times[p.id] = t;
    const segs = movers.get(p.tokenId!) ?? [];
    segs.push({ path: p, t0: t.start, t1: t.end, len: pathLength(p.points) });
    movers.set(p.tokenId!, segs);
    duration = Math.max(duration, t.end);
  }
  for (const segs of movers.values()) segs.sort((a, b) => a.t0 - b.t0);
  return { movers, times, duration: duration || EMPTY_STEP_SECONDS };
}

function moverPos(segs: Seg[], u: number, from: Pt): Pt {
  let pos = from;
  for (const s of segs) {
    if (u < s.t0) return pos;
    if (u < s.t1) return pointAt(s.path.points, (s.len * (u - s.t0)) / (s.t1 - s.t0));
    pos = s.path.points[s.path.points.length - 1];
  }
  return pos;
}

function initialFrame(doc: DrillDoc): Frame {
  const pos: Record<string, Pt> = {};
  for (const t of doc.tokens) pos[t.id] = { x: t.x, y: t.y };
  const puck = doc.tokens.find((t) => t.kind === 'puck');
  return { pos, holder: puck ? nearestHolder(doc, pos, puck.id) : null };
}

function nearestHolder(doc: DrillDoc, pos: Record<string, Pt>, puckId: string): string | null {
  let best: string | null = null;
  let bestD = PICKUP_RADIUS;
  for (const t of doc.tokens) {
    if (t.kind !== 'player' && t.kind !== 'goalie') continue;
    const d = dist(pos[t.id], pos[puckId]);
    if (d <= bestD) {
      bestD = d;
      best = t.id;
    }
  }
  return best;
}

/** Positions inside one step at local time `u` (seconds). */
function stepFrame(doc: DrillDoc, movers: Map<string, Seg[]>, start: Frame, u: number, final: boolean): Frame {
  const puck = doc.tokens.find((t) => t.kind === 'puck');
  const pos: Record<string, Pt> = { ...start.pos };
  let holder = start.holder;

  for (const [id, segs] of movers) pos[id] = moverPos(segs, u, start.pos[id]);

  if (puck) {
    const flights = movers.get(puck.id)?.filter((s) => s.path.kind === 'pass' || s.path.kind === 'shot') ?? [];
    const last = [...flights].reverse().find((s) => u > s.t0);
    if (last) {
      holder = null;
      // a completed pass is picked up by whoever is there to receive it
      if (u >= last.t1 && last.path.kind === 'pass') holder = nearestHolder(doc, pos, puck.id);
    } else {
      const carrier = [...movers.entries()].find(([, segs]) => segs.some((s) => s.path.kind === 'carry' && u >= s.t0));
      if (carrier && !holder) holder = carrier[0];
    }
    if (holder) {
      pos[puck.id] = pos[holder];
    } else if (final) {
      const picked = nearestHolder(doc, pos, puck.id);
      if (picked) {
        holder = picked;
        pos[puck.id] = pos[picked];
      }
    }
  }
  return { pos, holder };
}

export function buildTimeline(doc: DrillDoc): Timeline {
  const starts: number[] = [];
  const durations: number[] = [];
  const startFrames: Frame[] = [];
  const moversList: Map<string, Seg[]>[] = [];
  const timesList: Record<string, PathTiming>[] = [];
  let frame = initialFrame(doc);
  let t = 0;
  for (const step of doc.steps) {
    const { movers, times, duration } = resolveStep(doc, step.id);
    starts.push(t);
    durations.push(duration);
    startFrames.push(frame);
    moversList.push(movers);
    timesList.push(times);
    frame = stepFrame(doc, movers, frame, duration, true);
    t += duration;
  }
  return { starts, durations, startFrames, endFrame: frame, total: t, movers: moversList, times: timesList };
}

export function stepIndexAt(tl: Timeline, t: number): number {
  for (let i = tl.starts.length - 1; i >= 0; i--) if (t >= tl.starts[i]) return i;
  return 0;
}

export function frameAt(doc: DrillDoc, tl: Timeline, t: number): Frame {
  if (doc.steps.length === 0) return initialFrame(doc);
  if (t >= tl.total) return tl.endFrame;
  const i = stepIndexAt(tl, t);
  return stepFrame(doc, tl.movers[i], tl.startFrames[i], t - tl.starts[i], false);
}

/** Would making `pathId` wait on `sourceId` create a loop (source already waits, directly or not, on pathId)? */
export function wouldCycle(doc: DrillDoc, pathId: string, sourceId: string): boolean {
  const seen = new Set<string>();
  let cur: string | undefined = sourceId;
  while (cur && !seen.has(cur)) {
    if (cur === pathId) return true;
    seen.add(cur);
    cur = doc.paths.find((p) => p.id === cur)?.after?.pathId;
  }
  return false;
}

export interface TimingMarker {
  pathId: string;
  /** Point on the triggering line where the wait ends. */
  from?: Pt;
  to: Pt;
  delay: number;
}

/** Hold/trigger annotations to draw on the ice for one step. */
export function timingMarkers(doc: DrillDoc, stepId: string): TimingMarker[] {
  const out: TimingMarker[] = [];
  for (const p of doc.paths) {
    if (!animates(p, stepId)) continue;
    const src = p.after ? doc.paths.find((q) => q.id === p.after!.pathId && animates(q, stepId) && q.id !== p.id) : undefined;
    const delay = Math.max(0, p.delay ?? 0);
    if (!src && delay === 0) continue;
    out.push({
      pathId: p.id,
      from: src ? pointAt(src.points, Math.min(1, Math.max(0, p.after!.at)) * pathLength(src.points)) : undefined,
      to: p.points[0],
      delay,
    });
  }
  return out;
}
