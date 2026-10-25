import type { Pt } from './types';

export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export function pathLength(pts: Pt[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]);
  return l;
}

/** Point (and heading in radians) at distance d along the polyline. */
export function pointAt(pts: Pt[], d: number): Pt & { angle: number } {
  if (pts.length === 0) return { x: 0, y: 0, angle: 0 };
  if (pts.length === 1) return { ...pts[0], angle: 0 };
  let remaining = Math.max(0, d);
  for (let i = 1; i < pts.length; i++) {
    const seg = dist(pts[i - 1], pts[i]);
    if (remaining <= seg || i === pts.length - 1) {
      const t = seg === 0 ? 0 : Math.min(1, remaining / seg);
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
        angle: Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x),
      };
    }
    remaining -= seg;
  }
  return { ...pts[pts.length - 1], angle: 0 };
}

function dedupe(pts: Pt[], minDist: number): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    if (out.length === 0 || dist(out[out.length - 1], p) >= minDist) out.push(p);
  }
  if (pts.length > 1 && out.length > 0 && out[out.length - 1] !== pts[pts.length - 1]) {
    out.push(pts[pts.length - 1]);
  }
  return out;
}

function perpDistance(p: Pt, a: Pt, b: Pt): number {
  const len = dist(a, b);
  if (len === 0) return dist(p, a);
  return Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / len;
}

/** Ramer–Douglas–Peucker simplification. */
export function rdp(pts: Pt[], epsilon: number): Pt[] {
  if (pts.length < 3) return pts.slice();
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDistance(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= epsilon) return [pts[0], pts[pts.length - 1]];
  const left = rdp(pts.slice(0, idx + 1), epsilon);
  const right = rdp(pts.slice(idx), epsilon);
  return left.slice(0, -1).concat(right);
}

/** Uniform Catmull-Rom spline through the given points, sampled `perSeg` times per segment. */
export function catmullRom(pts: Pt[], perSeg = 8): Pt[] {
  if (pts.length < 3) return pts.slice();
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < perSeg; s++) {
      const t = s / perSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Least-squares (Kåsa) circle fit. */
export function fitCircle(pts: Pt[]): { x: number; y: number; r: number } | null {
  const n = pts.length;
  if (n < 3) return null;
  let mx = 0;
  let my = 0;
  for (const p of pts) {
    mx += p.x;
    my += p.y;
  }
  mx /= n;
  my /= n;
  let Suu = 0, Svv = 0, Suv = 0, Suuu = 0, Svvv = 0, Suvv = 0, Svuu = 0;
  for (const p of pts) {
    const u = p.x - mx;
    const v = p.y - my;
    Suu += u * u;
    Svv += v * v;
    Suv += u * v;
    Suuu += u * u * u;
    Svvv += v * v * v;
    Suvv += u * v * v;
    Svuu += v * u * u;
  }
  const det = Suu * Svv - Suv * Suv;
  if (Math.abs(det) < 1e-9) return null;
  const a = Suuu + Suvv;
  const b = Svvv + Svuu;
  const uc = (a * Svv - b * Suv) / (2 * det);
  const vc = (b * Suu - a * Suv) / (2 * det);
  const r = Math.sqrt(uc * uc + vc * vc + (Suu + Svv) / n);
  return { x: uc + mx, y: vc + my, r };
}

function maxDeviation(pts: Pt[], a: Pt, b: Pt): number {
  let m = 0;
  for (const p of pts) m = Math.max(m, perpDistance(p, a, b));
  return m;
}

/** Total signed angle swept around a centre, unwrapping jumps (positive = clockwise on screen). */
function sweptAngle(pts: Pt[], c: { x: number; y: number }): number {
  let total = 0;
  let prev = Math.atan2(pts[0].y - c.y, pts[0].x - c.x);
  for (let i = 1; i < pts.length; i++) {
    const a = Math.atan2(pts[i].y - c.y, pts[i].x - c.x);
    let d = a - prev;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    total += d;
    prev = a;
  }
  return total;
}

/**
 * Turn a hand-drawn stroke into a tidy path.
 * - nearly straight strokes become a straight line
 * - closed, roughly round strokes become a true circle
 * - everything else is simplified and smoothed into a gradual curve
 * With `clean` off the stroke is only lightly thinned so it stays as drawn.
 */
export function cleanStroke(raw: Pt[], clean: boolean): Pt[] {
  const pts = dedupe(raw, 0.2);
  if (pts.length < 2) return pts;
  if (!clean) return rdp(pts, 0.25);

  const len = pathLength(pts);
  const first = pts[0];
  const last = pts[pts.length - 1];
  const chord = dist(first, last);

  if (chord > 0.92 * len && maxDeviation(pts, first, last) < Math.max(1.5, 0.05 * len)) {
    return [first, last];
  }

  if (len > 12 && chord < 0.25 * len) {
    const c = fitCircle(pts);
    if (c && c.r > 2.5) {
      let resid = 0;
      for (const p of pts) resid += Math.abs(dist(p, c) - c.r);
      resid /= pts.length * c.r;
      if (resid < 0.2) {
        const sweep = sweptAngle(pts, c);
        const full = Math.abs(sweep) > 2 * Math.PI * 0.8;
        const total = full ? Math.sign(sweep) * 2 * Math.PI : sweep;
        const start = Math.atan2(first.y - c.y, first.x - c.x);
        const n = Math.max(24, Math.round(Math.abs(total) * 10));
        const out: Pt[] = [];
        for (let i = 0; i <= n; i++) {
          const a = start + (total * i) / n;
          out.push({ x: c.x + c.r * Math.cos(a), y: c.y + c.r * Math.sin(a) });
        }
        return out;
      }
    }
  }

  const simple = rdp(pts, Math.max(1.2, len * 0.012));
  return simple.length < 3 ? simple : catmullRom(simple, 8);
}

/** Fraction (0-1) along the polyline of the point closest to `p`. */
export function project(pts: Pt[], p: Pt): number {
  const total = pathLength(pts);
  if (total === 0) return 0;
  let best = Infinity;
  let bestS = 0;
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const seg = dist(a, b);
    if (seg > 0) {
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (seg * seg)));
      const d = dist(p, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      if (d < best) {
        best = d;
        bestS = acc + t * seg;
      }
    }
    acc += seg;
  }
  return bestS / total;
}
