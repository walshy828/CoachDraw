import { useEffect, useMemo, useRef, useState } from 'react';
import type { Drill } from '../../../shared/types';
import { DrillSheet } from '../editor/DrillSheet';
import { exportPng, safeName } from '../lib/exportImage';
import { useFitRotation } from '../lib/useFitRotation';
import { usePlayback } from '../lib/usePlayback';
import { DrillView } from '../rink/DrillView';
import { Icon } from '../ui/Icon';
import { INK_COLORS, INK_WIDTHS, InkLayer, useInk } from './ink';

const SPEEDS = [0.5, 1, 2];
const HIDE_AFTER_MS = 3500;

interface Props {
  drill: Drill;
  /** Back arrow in the top-left (the owner's library). Omitted on shared links. */
  onExit?: () => void;
  /** Pencil button to jump to the editor (owner only). */
  onEdit?: () => void;
}

/**
 * Full-screen presenter for phones and tablets. The ice takes the whole screen; every control floats over it and
 * tucks away while the drill plays. The pen opens a telestrator tray for temporary drawing.
 */
export function DrillViewer({ drill, onExit, onEdit }: Props) {
  const { doc } = drill;
  const pb = usePlayback(doc, 0);
  const [turn, setTurn] = useState<boolean | null>(null);
  const fit = useFitRotation(drill.rinkView, turn);
  const ink = useInk(fit.rotated);
  const [chrome, setChrome] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [palette, setPalette] = useState(false);
  const [notes, setNotes] = useState(false);
  const [bump, setBump] = useState(0);
  const sheet = useRef<SVGSVGElement | null>(null);

  const step = doc.steps[pb.stepIndex];
  const hasNotes = !!(drill.description || drill.notes || doc.steps.length);
  const meta = [drill.category, drill.ageGroup, drill.durationMin ? `${drill.durationMin} min` : ''].filter(Boolean).join(' · ');
  const bars = chrome && !drawing;

  const poke = () => {
    setChrome(true);
    setBump((b) => b + 1);
  };

  // controls tuck away a few seconds after the drill starts playing
  useEffect(() => {
    if (!chrome || !pb.playing || drawing || notes) return;
    const t = setTimeout(() => setChrome(false), HIDE_AFTER_MS);
    return () => clearTimeout(t);
  }, [chrome, pb.playing, drawing, notes, bump]);

  // keep the screen on while the coach is standing at the boards
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const grab = () => {
      if (document.visibilityState === 'visible') navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    };
    grab();
    document.addEventListener('visibilitychange', grab);
    return () => {
      document.removeEventListener('visibilitychange', grab);
      lock?.release().catch(() => {});
    };
  }, []);

  const toggleRef = useRef(pb.toggle);
  toggleRef.current = pb.toggle;
  const navRef = useRef({ next: pb.next, prev: pb.prev });
  navRef.current = { next: pb.next, prev: pb.prev };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      if (e.key === ' ' && el.tagName !== 'BUTTON') {
        e.preventDefault();
        toggleRef.current();
      } else if (e.key === 'ArrowRight') navRef.current.next();
      else if (e.key === 'ArrowLeft') navRef.current.prev();
      else if (e.key === 'Escape') {
        setDrawing(false);
        setNotes(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const startDrawing = () => {
    pb.pause(); // freeze the frame so the coach can mark it up
    setPalette(false);
    setDrawing(true);
  };
  const stopDrawing = () => {
    setDrawing(false);
    setPalette(false);
    poke();
  };

  const ticks = useMemo(
    () => (pb.timeline.total > 0 ? pb.timeline.starts.slice(1).map((s) => (s / pb.timeline.total) * 100) : []),
    [pb.timeline],
  );
  const pct = pb.timeline.total > 0 ? (pb.t / pb.timeline.total) * 100 : 0;
  const nextSpeed = () => pb.setSpeed(SPEEDS[(SPEEDS.indexOf(pb.speed) + 1) % SPEEDS.length]);

  const pointerHandlers = drawing
    ? {
        onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => ink.handlers.onPointerDown(e, () => setPalette(false)),
        onPointerMove: ink.handlers.onPointerMove,
        onPointerUp: ink.handlers.onPointerUp,
        onPointerCancel: ink.handlers.onPointerCancel,
      }
    : {};

  return (
    <div className={`viewer ${bars ? 'bars' : ''} ${drawing ? 'drawing' : ''}`}>
      <div
        className="viewer-stage"
        ref={fit.ref}
        onClick={() => {
          if (drawing) return;
          if (notes) return setNotes(false);
          chrome ? setChrome(false) : poke();
        }}
      >
        <DrillView
          doc={doc}
          view={drill.rinkView}
          frame={pb.frame}
          activeStepId={step?.id}
          pathMode={pb.active ? 'upto-active' : 'all'}
          badges
          rotated={fit.rotated}
          className={`rink-svg ${drawing ? 'inking' : ''}`}
          overlay={<InkLayer strokes={ink.strokes} />}
          {...pointerHandlers}
        />
      </div>

      <div className="viewer-progress" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </div>

      {/* top: back, title, and the two things you reach for mid-drill */}
      <header className="v-top">
        <div className="bar-pill glass left">
          {onExit && (
            <button className="icon-btn" onClick={onExit} aria-label="Back to your drills">
              <Icon name="back" />
            </button>
          )}
          {!onExit && <span className="brand" aria-hidden="true">🏒</span>}
          <h1 className="shared-title">{drill.name}</h1>
        </div>
        <div className="bar-pill glass right">
          {ink.hasInk && (
            <button className="icon-btn" onClick={ink.clear} aria-label="Clear drawing">
              <Icon name="erase" />
            </button>
          )}
          <button className="icon-btn" onClick={startDrawing} aria-label="Draw on the ice">
            <Icon name="pen" />
          </button>
          {hasNotes && (
            <button className={`icon-btn ${notes ? 'on' : ''}`} onClick={() => setNotes((v) => !v)} aria-label="Steps and notes" aria-expanded={notes}>
              <Icon name="steps" />
            </button>
          )}
          {onEdit && (
            <button className="icon-btn" onClick={onEdit} aria-label="Edit drill">
              <Icon name="edit" />
            </button>
          )}
        </div>
      </header>

      {/* bottom: coaching point + transport */}
      <footer className="v-bottom">
        {step && (step.title || step.caption) && (
          <button className="v-caption glass" onClick={() => setNotes(true)} aria-label="Open steps">
            <b>
              {pb.stepIndex + 1}/{doc.steps.length}
              {step.title ? ` · ${step.title}` : ''}
            </b>
            {step.caption && <span>{step.caption}</span>}
          </button>
        )}
        <div className="v-transport glass">
          <button className="round" aria-label="Previous step" onClick={() => (pb.prev(), poke())}>
            <Icon name="prev" />
          </button>
          <button className="round play" aria-label={pb.playing ? 'Pause' : 'Play'} onClick={() => (pb.toggle(), poke())}>
            <Icon name={pb.playing ? 'pause' : 'play'} size={28} />
          </button>
          <button className="round" aria-label="Next step" onClick={() => (pb.next(), poke())} disabled={pb.stepIndex >= doc.steps.length - 1}>
            <Icon name="next" />
          </button>
          <div className="v-scrub">
            {ticks.map((t) => (
              <i key={t} style={{ left: `${t}%` }} />
            ))}
            <input
              type="range"
              min={0}
              max={Math.max(0.01, pb.timeline.total)}
              step={0.01}
              value={pb.t}
              onChange={(e) => (pb.seek(Number(e.target.value)), poke())}
              aria-label="Timeline"
            />
          </div>
          <button className="chip-btn" onClick={() => (nextSpeed(), poke())} aria-label={`Playback speed ${pb.speed}×`}>
            {pb.speed}×
          </button>
        </div>
      </footer>

      {/* drawing tray: only exists while the pen is engaged */}
      {drawing && (
        <div className="v-tray-wrap">
          {palette && (
            <div className="v-palette glass" role="group" aria-label="Pen options">
              <div className="seg">
                <button className={!ink.laser ? 'on' : ''} onClick={() => ink.setLaser(false)}>
                  <Icon name="pen" size={20} /> Pen
                </button>
                <button className={ink.laser ? 'on' : ''} onClick={() => ink.setLaser(true)}>
                  <Icon name="laser" size={20} /> Laser
                </button>
              </div>
              <div className="swatches">
                {INK_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`swatch ${ink.color === c ? 'on' : ''}`}
                    style={{ background: c }}
                    onClick={() => ink.setColor(c)}
                    aria-label={`Ink ${c}`}
                  />
                ))}
              </div>
              <div className="v-widths">
                {INK_WIDTHS.map((w, i) => (
                  <button key={w} className={`chip-btn ${ink.width === w ? 'on' : ''}`} onClick={() => ink.setWidth(w)} aria-label={['Thin', 'Medium', 'Thick'][i]}>
                    <span style={{ width: 8 + i * 6, height: 8 + i * 6, background: ink.color, borderRadius: '50%' }} />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="v-tray glass">
            <button className="round" aria-label={pb.playing ? 'Pause' : 'Play'} onClick={pb.toggle}>
              <Icon name={pb.playing ? 'pause' : 'play'} size={24} />
            </button>
            <button className={`round ink-color ${palette ? 'open' : ''}`} aria-label="Pen options" aria-expanded={palette} onClick={() => setPalette((v) => !v)}>
              <span style={{ background: ink.color }} />
            </button>
            <button className="round" aria-label="Undo stroke" onClick={ink.undo} disabled={!ink.hasInk}>
              <Icon name="undo" />
            </button>
            <button className="round" aria-label="Clear drawing" onClick={ink.clear} disabled={!ink.strokes.length}>
              <Icon name="erase" />
            </button>
            <button className="btn primary done" onClick={stopDrawing}>
              <Icon name="check" size={20} /> Done
            </button>
          </div>
        </div>
      )}

      {notes && (
        <aside className="v-notes" aria-label="Steps and notes">
          <div className="sheet-grip" aria-hidden="true" />
          <header className="sheet-head">
            <b className="sheet-title">{meta || 'Steps & notes'}</b>
            <button className="icon-btn" onClick={() => setNotes(false)} aria-label="Close">
              <Icon name="close" />
            </button>
          </header>
          <div className="sheet-body panel-body">
            {drill.description && <p>{drill.description}</p>}
            <ol className="steps">
              {doc.steps.map((s, i) => (
                <li key={s.id} className={i === pb.stepIndex ? 'on' : ''}>
                  <button
                    className="step-btn"
                    onClick={() => {
                      pb.goStep(i);
                      setNotes(false);
                    }}
                  >
                    <b>{i + 1}</b>
                    <span>
                      {s.title || `Step ${i + 1}`}
                      {s.caption && <small style={{ display: 'block' }}>{s.caption}</small>}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {drill.notes && <pre className="notes">{drill.notes}</pre>}
            <div className="row wrap">
              <button className="btn" onClick={() => setTurn(!fit.rotated)}>
                <Icon name="rotate" size={18} /> Turn ice
              </button>
              <button className="btn" onClick={() => sheet.current && exportPng(sheet.current, safeName(drill.name))}>
                <Icon name="share" size={18} /> PNG
              </button>
              <button className="btn" onClick={() => window.print()}>Print / PDF</button>
            </div>
          </div>
        </aside>
      )}

      <DrillSheet ref={sheet} meta={drill} doc={doc} className="print-only" />
    </div>
  );
}
