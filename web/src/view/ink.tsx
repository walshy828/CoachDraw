import { useCallback, useRef, useState } from 'react';
import type { Pt } from '../../../shared/types';
import { unrotatePt } from '../rink/Rink';

export interface Stroke {
  id: number;
  points: Pt[];
  color: string;
  /** Line width in rink feet. */
  width: number;
  /** Laser strokes fade away on their own once the finger lifts. */
  laser?: boolean;
  fading?: boolean;
}

export const INK_COLORS = ['#e5322d', '#1b5fd6', '#111111', '#1f9d55', '#ff8a00', '#8e44ad'];
export const INK_WIDTHS = [0.7, 1.4, 2.6];
const MIN_STEP = 0.35;
const LASER_LINGER_MS = 1700;

/** Quadratic-smoothed path through the sampled points. */
export function strokePath(pts: Pt[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}l0.01 0`;
  let d = `M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    d += `Q${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
  }
  const last = pts[pts.length - 1];
  return `${d}L${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
}

/**
 * Temporary telestrator-style ink for the viewer. Strokes live in rink coordinates, so they stay put on the ice
 * when the screen rotates or resizes, and nothing here is saved with the drill.
 */
export function useInk(rotated: boolean) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(INK_COLORS[0]);
  const [width, setWidth] = useState(INK_WIDTHS[1]);
  const [laser, setLaser] = useState(false);
  const live = useRef<{ id: number; pointerId: number } | null>(null);
  const nextId = useRef(1);

  const toRink = useCallback(
    (svg: SVGSVGElement, e: { clientX: number; clientY: number }): Pt => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const root = pt.matrixTransform(svg.getScreenCTM()!.inverse());
      return rotated ? unrotatePt(root) : root;
    },
    [rotated],
  );

  const down = (e: React.PointerEvent<SVGSVGElement>, onStart?: () => void) => {
    if (!e.isPrimary || live.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    onStart?.();
    const id = nextId.current++;
    live.current = { id, pointerId: e.pointerId };
    const p = toRink(e.currentTarget, e);
    setStrokes((s) => [...s, { id, points: [p], color, width, laser }]);
  };

  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const cur = live.current;
    if (!cur || e.pointerId !== cur.pointerId) return;
    // coalesced events keep fast pen strokes smooth
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    const svg = e.currentTarget;
    const pts = events.map((ev) => toRink(svg, ev));
    setStrokes((all) =>
      all.map((s) => {
        if (s.id !== cur.id) return s;
        const points = [...s.points];
        for (const p of pts) {
          const last = points[points.length - 1];
          if (Math.hypot(p.x - last.x, p.y - last.y) >= MIN_STEP) points.push(p);
        }
        return points.length === s.points.length ? s : { ...s, points };
      }),
    );
  };

  const up = (e: React.PointerEvent<SVGSVGElement>) => {
    const cur = live.current;
    if (!cur || e.pointerId !== cur.pointerId) return;
    live.current = null;
    setStrokes((all) => all.map((s) => (s.id === cur.id && s.laser ? { ...s, fading: true } : s)));
    setTimeout(() => setStrokes((all) => all.filter((s) => !(s.id === cur.id && s.laser))), LASER_LINGER_MS);
  };

  return {
    strokes,
    color,
    width,
    laser,
    setColor,
    setWidth,
    setLaser,
    hasInk: strokes.some((s) => !s.laser),
    undo: () => setStrokes((s) => {
      const i = s.findLastIndex((x) => !x.laser);
      return i < 0 ? s : s.filter((_, j) => j !== i);
    }),
    clear: () => setStrokes([]),
    handlers: { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up },
  };
}

export function InkLayer({ strokes }: { strokes: Stroke[] }) {
  return (
    <g style={{ pointerEvents: 'none' }} fill="none" strokeLinecap="round" strokeLinejoin="round">
      {strokes.map((s) => (
        <path
          key={s.id}
          d={strokePath(s.points)}
          stroke={s.color}
          strokeWidth={s.laser ? Math.max(s.width, 1.4) : s.width}
          className={s.laser ? (s.fading ? 'ink-laser ink-fade' : 'ink-laser') : undefined}
          style={s.laser ? { filter: `drop-shadow(0 0 1.2px ${s.color})` } : undefined}
        />
      ))}
    </g>
  );
}
