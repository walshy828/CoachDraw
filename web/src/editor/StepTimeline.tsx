import { useRef } from 'react';
import { baseSeconds, clampSpeed } from '../../../shared/playback';
import type { Playback } from '../lib/usePlayback';
import { pathLabel } from './Panels';
import { useEditor } from './store';

const SNAP = 0.25;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;

/**
 * One row per moving line in the step. Empty space before a bar is the player holding still.
 * Drag a bar to delay it, drag its right edge to change its speed, click the ruler to scrub.
 */
export function StepTimeline({ pb, stepIndex }: { pb: Playback; stepIndex: number }) {
  const { doc, selection, select, setTool, patch, beginGesture } = useEditor();
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; mode: 'move' | 'speed'; x0: number; start0: number; dur0: number; moved: boolean } | null>(null);
  const step = doc.steps[stepIndex];
  if (!step) return null;

  const tl = pb.timeline;
  const times = tl.times[stepIndex] ?? {};
  const rows = doc.paths.filter((p) => p.stepId === step.id && p.tokenId && p.points.length >= 2);
  const dur = tl.durations[stepIndex] ?? 1;
  const scale = Math.max(4, Math.ceil(dur + 1));
  const ticks = Array.from({ length: scale + 1 }, (_, i) => i);
  const playhead = pb.active && pb.stepIndex === stepIndex ? Math.min(scale, pb.t - tl.starts[stepIndex]) : null;

  const secondsPerPx = () => scale / (trackRef.current?.getBoundingClientRect().width || 1);

  const onDown = (e: React.PointerEvent, id: string, mode: 'move' | 'speed') => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { id, mode, x0: e.clientX, start0: times[id]?.start ?? 0, dur0: (times[id]?.end ?? 0) - (times[id]?.start ?? 0), moved: false };
    setTool({ type: 'select' });
    select({ kind: 'path', id });
  };

  const onMove = (e: React.PointerEvent) => {
    const g = drag.current;
    if (!g) return;
    const dx = (e.clientX - g.x0) * secondsPerPx();
    if (!g.moved && Math.abs(e.clientX - g.x0) < 3) return;
    if (!g.moved) {
      beginGesture();
      g.moved = true;
    }
    const p = doc.paths.find((q) => q.id === g.id);
    const t = times[g.id];
    if (!p || !t) return;
    if (g.mode === 'move') {
      const delay = Math.max(0, snap(g.start0 + dx - t.base));
      patch((d) => ({ ...d, paths: d.paths.map((q) => (q.id === g.id ? { ...q, delay: delay || undefined } : q)) }));
    } else {
      const natural = baseSeconds(p);
      const wanted = Math.max(0.2, drag.current!.dur0 + dx);
      const speed = Math.round(clampSpeed(natural / wanted) * 20) / 20;
      patch((d) => ({ ...d, paths: d.paths.map((q) => (q.id === g.id ? { ...q, speed: speed === 1 ? undefined : speed } : q)) }));
    }
  };

  const onUp = (e: React.PointerEvent) => {
    drag.current = null;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
  };

  const scrub = (e: React.PointerEvent) => {
    const r = trackRef.current!.getBoundingClientRect();
    pb.seek(tl.starts[stepIndex] + Math.max(0, Math.min(dur, ((e.clientX - r.left) / r.width) * scale)));
  };

  return (
    <section className="timeline" aria-label={`Timing for step ${stepIndex + 1}`}>
      <header>
        <b>Timing — step {stepIndex + 1}</b>
        <span className="hint">Drag a bar to make that player hold first. Drag a bar's right edge to change its speed.</span>
        <button className="btn" onClick={() => pb.playStep(stepIndex)} disabled={!rows.length}>▶ Preview step</button>
      </header>
      {rows.length === 0 ? (
        <p className="hint">Draw skating, passing or shooting lines in this step and they will appear here.</p>
      ) : (
        <div className="tl-grid">
          <div className="tl-labels">
            <div className="tl-ruler-label">sec</div>
            {rows.map((p) => (
              <div key={p.id} className={`tl-label ${selection?.id === p.id ? 'on' : ''}`} title={pathLabel(doc, p)}>
                <i style={{ background: p.color }} />
                {pathLabel(doc, p)}
              </div>
            ))}
          </div>
          <div className="tl-track" ref={trackRef}>
            <div className="tl-ruler" onPointerDown={scrub} onPointerMove={(e) => e.buttons === 1 && scrub(e)}>
              {ticks.map((t) => (
                <span key={t} style={{ left: `${(t / scale) * 100}%` }}>{t}</span>
              ))}
            </div>
            {rows.map((p) => {
              const t = times[p.id];
              if (!t) return <div key={p.id} className="tl-row" />;
              const src = p.after && rows.find((q) => q.id === p.after!.pathId);
              return (
                <div key={p.id} className="tl-row">
                  {t.start > 0.01 && (
                    <div
                      className="tl-hold"
                      style={{ left: `${(t.base / scale) * 100}%`, width: `${((t.start - t.base) / scale) * 100}%` }}
                      title="Holding in place"
                    />
                  )}
                  <div
                    className={`tl-bar ${selection?.id === p.id ? 'on' : ''}`}
                    style={{ left: `${(t.start / scale) * 100}%`, width: `${((t.end - t.start) / scale) * 100}%`, background: p.color }}
                    title={
                      src
                        ? `Starts when ${pathLabel(doc, src)} is ${Math.round(p.after!.at * 100)}% along`
                        : `${pathLabel(doc, p)} · starts at ${t.start.toFixed(1)}s`
                    }
                    onPointerDown={(e) => onDown(e, p.id, 'move')}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerCancel={onUp}
                  >
                    <span>{src ? `◇ after ${Math.round(p.after!.at * 100)}%` : `${t.start.toFixed(1)}s`}</span>
                    <b
                      className="tl-grip"
                      title="Drag to change speed"
                      onPointerDown={(e) => onDown(e, p.id, 'speed')}
                      onPointerMove={onMove}
                      onPointerUp={onUp}
                      onPointerCancel={onUp}
                    />
                  </div>
                </div>
              );
            })}
            {playhead !== null && <div className="tl-playhead" style={{ left: `${(playhead / scale) * 100}%` }} />}
          </div>
        </div>
      )}
    </section>
  );
}
