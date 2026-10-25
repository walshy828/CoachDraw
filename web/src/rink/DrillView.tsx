import { forwardRef, useMemo } from 'react';
import { pathLength, pointAt } from '../../../shared/geometry';
import { timingMarkers, type Frame } from '../../../shared/playback';
import type { DrawPath, DrillDoc, PathKind, Pt, RinkView, Token } from '../../../shared/types';
import { Rink, useRotated } from './Rink';

export type Selection = { kind: 'token' | 'path'; id: string } | null;
export type PathMode = 'all' | 'upto-active' | 'active-only';

const toD = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');

function wavy(pts: Pt[], amp = 0.8, wavelength = 3.4): Pt[] {
  const len = pathLength(pts);
  if (len < 4) return pts;
  const n = Math.ceil(len / 0.5);
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const s = (len * i) / n;
    const p = pointAt(pts, s);
    const taper = Math.min(1, (len - s) / 3, s / 1.5 + 0.2);
    const off = amp * taper * Math.sin((2 * Math.PI * s) / wavelength);
    out.push({ x: p.x - Math.sin(p.angle) * off, y: p.y + Math.cos(p.angle) * off });
  }
  return out;
}

export function luminance(hex: string) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return 0.5;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export const tokenColor = (doc: DrillDoc, t: Token) => t.color ?? doc.colors[t.team];

function Arrow({ at, color, size, bar }: { at: Pt & { angle: number }; color: string; size: number; bar?: boolean }) {
  const a = (deg: number) => ({
    x: at.x + Math.cos(at.angle + (deg * Math.PI) / 180) * size,
    y: at.y + Math.sin(at.angle + (deg * Math.PI) / 180) * size,
  });
  if (bar) {
    const l = a(90);
    const r = a(-90);
    return <line x1={l.x} y1={l.y} x2={r.x} y2={r.y} stroke={color} strokeWidth={0.7} strokeLinecap="round" />;
  }
  const l = a(150);
  const r = a(-150);
  return <polygon points={`${at.x},${at.y} ${l.x},${l.y} ${r.x},${r.y}`} fill={color} />;
}

const STYLE: Record<PathKind, { width: number; dash?: string; arrow: number }> = {
  skate: { width: 0.5, dash: '1.6 1.1', arrow: 2.2 },
  carry: { width: 0.5, arrow: 2.2 },
  back: { width: 0.5, dash: '0.3 1.1', arrow: 1.8 },
  pass: { width: 1.0, arrow: 2.6 },
  shot: { width: 0.95, arrow: 3.0 },
};

export function PathShape({
  path,
  opacity = 1,
  selected,
  badge,
}: {
  path: DrawPath;
  opacity?: number;
  selected?: boolean;
  badge?: number;
}) {
  const rotated = useRotated();
  const pts = path.points;
  const shown = useMemo(() => (path.kind === 'carry' ? wavy(pts) : pts), [pts, path.kind]);
  if (pts.length < 2) return null;
  const st = STYLE[path.kind];
  const len = pathLength(pts);
  const end = pointAt(pts, len);
  const tail = pointAt(pts, Math.max(0, len - 0.4));
  const head = { x: end.x, y: end.y, angle: Math.atan2(end.y - tail.y, end.x - tail.x) };
  // stop the stroke short of the arrow tip so dashes do not poke through
  const d = toD(shown);
  return (
    <g data-kind="path" data-id={path.id} opacity={opacity} style={{ cursor: 'pointer' }}>
      <path d={toD(pts)} fill="none" stroke="transparent" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      {selected && <path d={d} fill="none" stroke="#2b7fff" strokeWidth={st.width + 1.6} strokeOpacity={0.35} strokeLinecap="round" />}
      <path
        d={d}
        fill="none"
        stroke={path.color}
        strokeWidth={st.width}
        strokeDasharray={st.dash}
        strokeLinecap={path.kind === 'back' ? 'round' : 'butt'}
        strokeLinejoin="round"
      />
      {path.kind === 'pass' && (
        <path d={d} fill="none" stroke="#f4f8fc" strokeWidth={0.35} strokeLinejoin="round" />
      )}
      <Arrow at={head} color={path.color} size={st.arrow} bar={path.kind === 'back'} />
      {badge !== undefined && (
        <g transform={`translate(${pts[0].x} ${pts[0].y})${rotated ? ' rotate(-90)' : ''}`} style={{ pointerEvents: 'none' }}>
          <circle r={1.7} fill="#fff" stroke={path.color} strokeWidth={0.4} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={2.1} fontWeight={700} fill="#1c2b3d">
            {badge}
          </text>
        </g>
      )}
    </g>
  );
}

export function TokenShape({
  token,
  doc,
  at,
  selected,
  puckOffset,
}: {
  token: Token;
  doc: DrillDoc;
  at: Pt;
  selected?: boolean;
  puckOffset?: boolean;
}) {
  const rotated = useRotated();
  const upright = rotated ? 'rotate(-90)' : undefined;
  const color = tokenColor(doc, token);
  const x = at.x + (puckOffset ? 2.4 : 0);
  const y = at.y + (puckOffset ? 1.9 : 0);
  let body;
  if (token.kind === 'puck') {
    body = <circle r={1.15} fill="#111" stroke="#fff" strokeWidth={0.3} />;
  } else if (token.kind === 'cone') {
    body = <polygon transform={upright} points="0,-2.4 2.1,1.8 -2.1,1.8" fill="#ff8a00" stroke="#a85200" strokeWidth={0.3} />;
  } else {
    const fill = token.kind === 'goalie' ? '#111' : color;
    const textColor = token.kind === 'goalie' || luminance(fill) < 0.55 ? '#fff' : '#111';
    body = (
      <>
        <circle r={2.7} fill={fill} stroke="#fff" strokeWidth={0.35} />
        <text
          transform={upright}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={token.label.length > 2 ? 1.9 : 2.3}
          fontWeight={700}
          fill={textColor}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {token.label}
        </text>
      </>
    );
  }
  return (
    <g data-kind="token" data-id={token.id} transform={`translate(${x} ${y})`} style={{ cursor: 'grab' }}>
      <circle r={token.kind === 'puck' ? 3 : 5} fill="transparent" />
      {selected && <circle r={3.8} fill="none" stroke="#2b7fff" strokeWidth={0.6} strokeDasharray="1 0.7" />}
      {body}
    </g>
  );
}

interface DrillViewProps extends Omit<React.SVGProps<SVGSVGElement>, 'viewBox' | 'children'> {
  doc: DrillDoc;
  view: RinkView;
  frame: Frame;
  activeStepId?: string | null;
  pathMode?: PathMode;
  selected?: Selection;
  badges?: boolean;
  /** Show hold/trigger markers for the active step (editing only). */
  timing?: boolean;
  preview?: { points: Pt[]; color: string } | null;
  rotated?: boolean;
  /** Drawn above everything else, in rink coordinates (viewer annotations). */
  overlay?: React.ReactNode;
}

export const DrillView = forwardRef<SVGSVGElement, DrillViewProps>(function DrillView(
  { doc, view, frame, activeStepId = null, pathMode = 'all', selected = null, badges = false, timing = false, preview = null, rotated = false, overlay = null, ...svg },
  ref,
) {
  const stepIndex = new Map(doc.steps.map((s, i) => [s.id, i]));
  const activeIdx = activeStepId ? (stepIndex.get(activeStepId) ?? -1) : -1;
  const puck = doc.tokens.find((t) => t.kind === 'puck');
  const markers = timing && activeStepId ? timingMarkers(doc, activeStepId) : [];

  const visible = doc.paths
    .map((p) => {
      const idx = stepIndex.get(p.stepId) ?? 0;
      let opacity = 1;
      if (activeIdx >= 0) {
        if (pathMode === 'upto-active') {
          if (idx > activeIdx) return null;
          opacity = idx === activeIdx ? 1 : 0.4;
        } else if (pathMode === 'active-only') {
          if (idx !== activeIdx) return null;
        } else {
          opacity = idx === activeIdx ? 1 : 0.28;
        }
      }
      return { p, idx, opacity };
    })
    .filter((x): x is { p: DrawPath; idx: number; opacity: number } => x !== null);

  return (
    <Rink ref={ref} view={view} rotated={rotated} {...svg}>
      {visible.map(({ p, idx, opacity }) => (
        <PathShape
          key={p.id}
          path={p}
          opacity={opacity}
          selected={selected?.kind === 'path' && selected.id === p.id}
          badge={badges ? idx + 1 : undefined}
        />
      ))}
      {markers.map((m) => (
        <g key={m.pathId}>
          {m.from && (
            <line x1={m.from.x} y1={m.from.y} x2={m.to.x} y2={m.to.y} stroke="#5b6b82" strokeWidth={0.3} strokeDasharray="0.8 0.8" style={{ pointerEvents: 'none' }} />
          )}
          {m.delay > 0 && (
            <text
              x={m.from ? (m.from.x + m.to.x) / 2 : m.to.x}
              y={(m.from ? (m.from.y + m.to.y) / 2 : m.to.y) - 2.2}
              transform={rotated ? `rotate(-90 ${m.from ? (m.from.x + m.to.x) / 2 : m.to.x} ${(m.from ? (m.from.y + m.to.y) / 2 : m.to.y) - 2.2})` : undefined}
              textAnchor="middle"
              fontSize={2}
              fontWeight={700}
              fill="#5b6b82"
              stroke="#f4f8fc"
              strokeWidth={0.5}
              paintOrder="stroke"
              style={{ pointerEvents: 'none' }}
            >
              {m.from ? '+' : 'hold '}
              {m.delay}s
            </text>
          )}
          {m.from && (
            <g data-kind="trigger" data-id={m.pathId} transform={`translate(${m.from.x} ${m.from.y})`} style={{ cursor: 'ew-resize' }}>
              <circle r={4} fill="transparent" />
              <rect x={-1.2} y={-1.2} width={2.4} height={2.4} transform="rotate(45)" fill="#fff" stroke="#5b6b82" strokeWidth={0.4} />
            </g>
          )}
        </g>
      ))}
      {preview && preview.points.length > 1 && (
        <path d={toD(preview.points)} fill="none" stroke={preview.color} strokeWidth={0.5} strokeOpacity={0.7} strokeLinecap="round" />
      )}
      {doc.tokens
        .filter((t) => t.kind !== 'puck')
        .map((t) => (
          <TokenShape
            key={t.id}
            token={t}
            doc={doc}
            at={frame.pos[t.id] ?? t}
            selected={selected?.kind === 'token' && selected.id === t.id}
          />
        ))}
      {puck && (
        <TokenShape
          token={puck}
          doc={doc}
          at={frame.pos[puck.id] ?? puck}
          selected={selected?.kind === 'token' && selected.id === puck.id}
          puckOffset={frame.holder !== null}
        />
      )}
      {overlay}
    </Rink>
  );
});
