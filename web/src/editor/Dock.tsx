import type { DrillDoc } from '../../../shared/types';
import type { Playback } from '../lib/usePlayback';
import { Icon } from '../ui/Icon';
import type { SheetTab } from './Sheet';

const SPEEDS = [0.5, 1, 2];

interface Props {
  pb: Playback;
  doc: DrillDoc;
  activeIndex: number;
  /** Editor only. Without these the dock is a plain player: step buttons jump the playback. */
  sheet?: SheetTab | null;
  onSheet?: (t: SheetTab) => void;
  onSelectStep?: (stepId: string) => void;
  onAddStep?: () => void;
}

/** Everything about time in one thumb-reach strip: which step, play/pause, speed. */
export function Dock({ pb, doc, activeIndex, sheet = null, onSheet, onSelectStep, onAddStep }: Props) {
  const { timeline: tl } = pb;
  const step = doc.steps[activeIndex];
  const nextSpeed = () => pb.setSpeed(SPEEDS[(SPEEDS.indexOf(pb.speed) + 1) % SPEEDS.length]);

  return (
    <footer className="dock">
      <div className="dock-status" aria-live="polite">
        <b>{onAddStep ? `${pb.active ? 'Playing' : 'Editing'} · ` : ''}Step {activeIndex + 1} of {doc.steps.length}</b>
        {step?.title && <span> — {step.title}</span>}
        {(pb.active || !onAddStep) && step?.caption && <em> {step.caption}</em>}
      </div>

      <div className="dock-steps" role="tablist" aria-label="Steps">
        {doc.steps.map((s, i) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={i === activeIndex}
            className={`pill ${i === activeIndex ? 'on' : ''}`}
            title={s.title}
            onClick={() => (onSelectStep ? onSelectStep(s.id) : pb.goStep(i))}
          >
            {i + 1}
          </button>
        ))}
        {onAddStep && (
          <button className="pill add" onClick={onAddStep} aria-label="Add step">
            <Icon name="plus" size={20} />
          </button>
        )}
      </div>

      <div className="dock-transport">
        <button className="round" aria-label="Previous step" onClick={pb.prev}>
          <Icon name="prev" />
        </button>
        <button className="round play" aria-label={pb.playing ? 'Pause' : 'Play'} onClick={pb.toggle}>
          <Icon name={pb.playing ? 'pause' : 'play'} size={28} />
        </button>
        <button className="round" aria-label="Next step" onClick={pb.next} disabled={pb.stepIndex >= doc.steps.length - 1}>
          <Icon name="next" />
        </button>
        {pb.active && onAddStep && (
          <button className="round edit" aria-label="Back to editing" onClick={pb.stop}>
            <Icon name="edit" />
          </button>
        )}
      </div>

      <div className="dock-opts">
        <button className="chip-btn" onClick={nextSpeed} aria-label={`Playback speed ${pb.speed}×`}>
          {pb.speed}×
        </button>
        <button
          className="chip-btn mode"
          onClick={() => pb.setMode(pb.mode === 'all' ? 'step' : 'all')}
          aria-label={pb.mode === 'all' ? 'Playing all steps' : 'Playing one step'}
        >
          {pb.mode === 'all' ? 'All' : 'Step'}
        </button>
        {onSheet && (
          <>
            <button className={`chip-btn ${sheet === 'steps' ? 'on' : ''}`} onClick={() => onSheet('steps')} aria-label="Steps panel">
              <Icon name="steps" size={20} />
            </button>
            <button className={`chip-btn ${sheet === 'timing' ? 'on' : ''}`} onClick={() => onSheet('timing')} aria-label="Timing panel">
              <Icon name="timing" size={20} />
            </button>
          </>
        )}
      </div>

      {pb.active && (
        <input
          className="scrub"
          type="range"
          min={0}
          max={Math.max(0.01, tl.total)}
          step={0.01}
          value={pb.t}
          onChange={(e) => pb.seek(Number(e.target.value))}
          aria-label="Timeline"
        />
      )}
    </footer>
  );
}
