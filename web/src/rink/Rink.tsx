import { createContext, forwardRef, useContext, useId, type ReactNode, type SVGProps } from 'react';
import type { RinkView } from '../../../shared/types';

/** NHL rink in feet: x runs along the length (0–200), y across the width (0–85). */
export const RINK_L = 200;
export const RINK_W = 85;
const CORNER_R = 28;
const GOAL_LINE_X = 11;
const BLUE_LINE_X = 75;
const CENTER_X = RINK_L / 2;
const DOT_Y = [20.5, 64.5];
const ZONE_DOT_X = [31, 169];
const NEUTRAL_DOT_X = [80, 120];
const MID_Y = RINK_W / 2;

const C = {
  ice: '#f4f8fc',
  boards: '#23405f',
  red: '#c4475a',
  blue: '#5f86b8',
  crease: '#bfe0f5',
};

export function viewBoxFor(view: RinkView): [number, number, number, number] {
  const m = 2;
  if (view === 'half-left') return [-m, -m, 100 + 2 * m, RINK_W + 2 * m];
  if (view === 'half-right') return [100 - m, -m, 100 + 2 * m, RINK_W + 2 * m];
  return [-m, -m, RINK_L + 2 * m, RINK_W + 2 * m];
}

/** True while the ice is drawn turned 90° (long side vertical) so text and cones can stay upright. */
const RotatedContext = createContext(false);
export const useRotated = () => useContext(RotatedContext);

/** Rink coordinates (feet) to the unrotated SVG root, and back, for a rink drawn turned 90° clockwise. */
export const rotatePt = (p: { x: number; y: number }) => ({ x: RINK_W - p.y, y: p.x });
export const unrotatePt = (p: { x: number; y: number }) => ({ x: p.y, y: RINK_W - p.x });

export function viewAspect(view: RinkView): number {
  const [, , w, h] = viewBoxFor(view);
  return w / h;
}

function FaceoffSpot({ cx, cy, circle }: { cx: number; cy: number; circle: boolean }) {
  const corners = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  return (
    <g stroke={C.red} fill="none" strokeWidth={0.3}>
      {circle && <circle cx={cx} cy={cy} r={15} />}
      <circle cx={cx} cy={cy} r={circle ? 1 : 0.9} fill={C.red} stroke="none" />
      {circle && (
        <>
          {corners.map(([sx, sy]) => (
            <path key={`${sx}${sy}`} d={`M${cx + sx * 5} ${cy + sy * 1.5} H${cx + sx * 2} V${cy + sy * 4.5}`} />
          ))}
          {[-3, 3].flatMap((dx) =>
            [-1, 1].map((sy) => (
              <line key={`${dx}${sy}`} x1={cx + dx} x2={cx + dx} y1={cy + sy * 15} y2={cy + sy * 17} />
            )),
          )}
        </>
      )}
    </g>
  );
}

function Goal({ side }: { side: 'left' | 'right' }) {
  const left = side === 'left';
  const gx = left ? GOAL_LINE_X : RINK_L - GOAL_LINE_X;
  return (
    <g>
      <path
        d={`M${gx} ${MID_Y - 6} A6 6 0 0 ${left ? 1 : 0} ${gx} ${MID_Y + 6} Z`}
        fill={C.crease}
        stroke={C.red}
        strokeWidth={0.3}
      />
      <rect
        x={left ? gx - 3.4 : gx}
        y={MID_Y - 3}
        width={3.4}
        height={6}
        fill="#fff"
        stroke={C.red}
        strokeWidth={0.45}
        rx={0.6}
      />
      <line x1={gx} x2={gx} y1={MID_Y - 3} y2={MID_Y + 3} stroke={C.red} strokeWidth={0.45} />
    </g>
  );
}

interface RinkProps extends Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'children'> {
  view: RinkView;
  /** Turn the ice 90° clockwise so a full-length rink fills a portrait screen. */
  rotated?: boolean;
  children?: ReactNode;
}

export const Rink = forwardRef<SVGSVGElement, RinkProps>(function Rink({ view, rotated = false, children, ...svg }, ref) {
  const vb = viewBoxFor(view);
  const clipId = useId();
  const box = rotated ? [vb[1], vb[0], vb[3], vb[2]] : vb;
  return (
    <svg ref={ref} viewBox={box.join(' ')} xmlns="http://www.w3.org/2000/svg" {...svg}>
      <RotatedContext.Provider value={rotated}>
        <g transform={rotated ? `translate(${RINK_W} 0) rotate(90)` : undefined} clipPath={`url(#${clipId})`}>
          <defs>
            {/* the svg element can be larger than the view (letterboxing): keep half-ice views cut at the view edge */}
            <clipPath id={clipId}>
              <rect x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]} rx={1.5} />
            </clipPath>
            <clipPath id="rink-clip">
              <rect x={0} y={0} width={RINK_L} height={RINK_W} rx={CORNER_R} />
            </clipPath>
          </defs>
          <rect x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]} fill="#fff" />
          <rect x={0} y={0} width={RINK_L} height={RINK_W} rx={CORNER_R} fill={C.ice} />
          <g clipPath="url(#rink-clip)">
            {/* centre ice */}
            <circle cx={CENTER_X} cy={MID_Y} r={15} fill="none" stroke={C.blue} strokeWidth={0.3} />
            <line x1={CENTER_X} x2={CENTER_X} y1={0} y2={RINK_W} stroke={C.red} strokeWidth={1} />
            <circle cx={CENTER_X} cy={MID_Y} r={0.8} fill={C.blue} />
            {/* blue lines */}
            {[BLUE_LINE_X, RINK_L - BLUE_LINE_X].map((x) => (
              <line key={x} x1={x} x2={x} y1={0} y2={RINK_W} stroke={C.blue} strokeWidth={1} />
            ))}
            {/* goal lines */}
            {[GOAL_LINE_X, RINK_L - GOAL_LINE_X].map((x) => (
              <line key={x} x1={x} x2={x} y1={0} y2={RINK_W} stroke={C.red} strokeWidth={0.35} />
            ))}
          </g>
          {ZONE_DOT_X.flatMap((x) => DOT_Y.map((y) => <FaceoffSpot key={`${x}-${y}`} cx={x} cy={y} circle />))}
          {NEUTRAL_DOT_X.flatMap((x) => DOT_Y.map((y) => <FaceoffSpot key={`n${x}-${y}`} cx={x} cy={y} circle={false} />))}
          <Goal side="left" />
          <Goal side="right" />
          <rect x={0} y={0} width={RINK_L} height={RINK_W} rx={CORNER_R} fill="none" stroke={C.boards} strokeWidth={0.9} />
          {children}
        </g>
      </RotatedContext.Provider>
    </svg>
  );
});
