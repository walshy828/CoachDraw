import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildTimeline, frameAt, stepIndexAt, type Frame, type Timeline } from '../../../shared/playback';
import type { DrillDoc } from '../../../shared/types';

export type PlayMode = 'all' | 'step';

export interface Playback {
  timeline: Timeline;
  /** True once the coach has pressed play/seek; false means "show the editing view". */
  active: boolean;
  playing: boolean;
  t: number;
  speed: number;
  mode: PlayMode;
  stepIndex: number;
  frame: Frame;
  setSpeed: (s: number) => void;
  setMode: (m: PlayMode) => void;
  toggle: () => void;
  pause: () => void;
  stop: () => void;
  seek: (t: number) => void;
  goStep: (i: number) => void;
  /** Play just this step from its start. */
  playStep: (i: number) => void;
  next: () => void;
  prev: () => void;
}

export function usePlayback(doc: DrillDoc, editingStepIndex = 0): Playback {
  const timeline = useMemo(() => buildTimeline(doc), [doc]);
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState<PlayMode>('all');
  const ref = useRef({ t: 0, speed: 1, mode: 'all' as PlayMode, tl: timeline });
  ref.current.speed = speed;
  ref.current.mode = mode;
  ref.current.tl = timeline;

  const apply = useCallback((v: number) => {
    ref.current.t = v;
    setT(v);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const { tl, mode: m, speed: sp } = ref.current;
      const i = stepIndexAt(tl, ref.current.t);
      const limit = m === 'step' ? tl.starts[i] + tl.durations[i] : tl.total;
      const nt = ref.current.t + dt * sp;
      if (nt >= limit) {
        apply(limit);
        setPlaying(false);
        return;
      }
      apply(nt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, apply]);

  const stepIndex = active ? stepIndexAt(timeline, t) : Math.min(editingStepIndex, Math.max(0, doc.steps.length - 1));
  const frame = active
    ? frameAt(doc, timeline, t)
    : (timeline.startFrames[stepIndex] ?? timeline.endFrame);

  const toggle = useCallback(() => {
    const tl = ref.current.tl;
    if (playing) return setPlaying(false);
    let start = ref.current.t;
    if (!active) {
      start = ref.current.mode === 'step' ? (tl.starts[editingStepIndex] ?? 0) : 0;
    } else {
      const i = stepIndexAt(tl, start);
      const end = ref.current.mode === 'step' ? tl.starts[i] + tl.durations[i] : tl.total;
      if (start >= end - 0.001) start = ref.current.mode === 'step' ? tl.starts[i] : 0;
    }
    apply(start);
    setActive(true);
    setPlaying(true);
  }, [playing, active, editingStepIndex, apply]);

  const seek = useCallback(
    (v: number) => {
      setActive(true);
      setPlaying(false);
      apply(Math.max(0, Math.min(ref.current.tl.total, v)));
    },
    [apply],
  );

  const goStep = useCallback(
    (i: number) => {
      const tl = ref.current.tl;
      const idx = Math.max(0, Math.min(tl.starts.length - 1, i));
      seek(tl.starts[idx] ?? 0);
    },
    [seek],
  );

  const playStep = useCallback(
    (i: number) => {
      const tl = ref.current.tl;
      ref.current.mode = 'step';
      setMode('step');
      apply(tl.starts[i] ?? 0);
      setActive(true);
      setPlaying(true);
    },
    [apply],
  );

  return {
    timeline,
    playStep,
    active,
    playing,
    t,
    speed,
    mode,
    stepIndex,
    frame,
    setSpeed,
    setMode,
    toggle,
    pause: () => setPlaying(false),
    stop: () => {
      setPlaying(false);
      setActive(false);
      apply(0);
    },
    seek,
    goStep,
    next: () => goStep(stepIndex + 1),
    prev: () => {
      const tl = ref.current.tl;
      // first press rewinds to the start of the current step, second press goes back one
      const within = active && t - (tl.starts[stepIndex] ?? 0) > 0.3;
      goStep(within ? stepIndex : stepIndex - 1);
    },
  };
}
