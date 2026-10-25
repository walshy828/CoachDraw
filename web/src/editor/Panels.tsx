import { wouldCycle } from '../../../shared/playback';
import { CATEGORIES, type DrawPath, type DrillDoc, type PathKind, type Team } from '../../../shared/types';
import { isSkaterOrGoalie, isUniquePosition, useEditor } from './store';

export const pathLabel = (doc: DrillDoc, p: DrawPath) => {
  const t = doc.tokens.find((x) => x.id === p.tokenId);
  const who = t ? (t.kind === 'puck' ? 'Puck' : t.label || 'Player') : 'Line';
  return `${who} ${p.kind}`;
};

const POSITION_OPTIONS = ['C', 'LW', 'RW', 'LD', 'RD', 'G', 'X'];

function TimingSection({ path }: { path: DrawPath }) {
  const { doc, edit } = useEditor();
  const set = (patch: Partial<DrawPath>) =>
    edit((d) => ({ ...d, paths: d.paths.map((p) => (p.id === path.id ? { ...p, ...patch } : p)) }));
  const candidates = doc.paths.filter(
    (p) => p.id !== path.id && p.stepId === path.stepId && p.tokenId && p.points.length >= 2 && !wouldCycle(doc, path.id, p.id),
  );
  const trig = path.after && candidates.some((c) => c.id === path.after!.pathId) ? path.after : undefined;
  return (
    <div className="field-group timing">
      <h4>Timing</h4>
      <label>
        This line starts…
        <select
          value={trig ? 'trigger' : 'step'}
          onChange={(e) => {
            if (e.target.value === 'step') return set({ after: undefined });
            const first = candidates[0];
            if (first) set({ after: { pathId: first.id, at: 0.5 } });
          }}
        >
          <option value="step">As soon as the step starts (or the player's previous line ends)</option>
          <option value="trigger" disabled={!candidates.length}>When another line reaches a point…</option>
        </select>
      </label>
      {trig && (
        <>
          <label>
            When this line…
            <select value={trig.pathId} onChange={(e) => set({ after: { pathId: e.target.value, at: trig.at } })}>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>{pathLabel(doc, c)}</option>
              ))}
            </select>
          </label>
          <label>
            …is {Math.round(trig.at * 100)}% along
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(trig.at * 100)}
              onChange={(e) => set({ after: { pathId: trig.pathId, at: Number(e.target.value) / 100 } })}
            />
          </label>
          <p className="hint">The player holds in place until then. You can also drag the ◇ marker on the ice.</p>
        </>
      )}
      <label>
        {trig ? 'Then wait an extra (seconds)' : 'Hold in place first (seconds)'}
        <input
          type="number"
          min={0}
          max={30}
          step={0.25}
          value={path.delay ?? 0}
          onChange={(e) => set({ delay: Math.max(0, Number(e.target.value) || 0) || undefined })}
        />
      </label>
      <label>
        Speed
        <select value={path.speed ?? 1} onChange={(e) => set({ speed: Number(e.target.value) === 1 ? undefined : Number(e.target.value) })}>
          <option value={0.5}>Slow (0.5×)</option>
          <option value={0.75}>Easy (0.75×)</option>
          <option value={1}>Normal</option>
          <option value={1.5}>Fast (1.5×)</option>
          <option value={2}>Very fast (2×)</option>
        </select>
      </label>
    </div>
  );
}

export const PALETTE = ['#f2b705', '#d62839', '#1b6ec2', '#0b3c6f', '#111111', '#2e7d32', '#ff8a00', '#7ed321', '#e91e8c', '#8e44ad'];

function Swatches({ value, onPick }: { value?: string; onPick: (c: string) => void }) {
  return (
    <div className="swatches">
      {PALETTE.map((c) => (
        <button
          key={c}
          className={`swatch ${value?.toLowerCase() === c ? 'on' : ''}`}
          style={{ background: c }}
          title={c}
          aria-label={`Color ${c}`}
          onClick={() => onPick(c)}
        />
      ))}
      <input type="color" value={value ?? '#000000'} onChange={(e) => onPick(e.target.value)} aria-label="Custom color" />
    </div>
  );
}

export function StepsPanel({ onSelect }: { onSelect: (stepId: string) => void }) {
  const { doc, activeStepId, addStep, removeStep, moveStep, updateStep } = useEditor();
  const active = doc.steps.find((s) => s.id === activeStepId);
  return (
    <div className="panel-body">
      <p className="hint">
        Each step is a chapter. Everything drawn in a step happens at the same time; steps play in order.
      </p>
      <ol className="steps">
        {doc.steps.map((s, i) => {
          const n = doc.paths.filter((p) => p.stepId === s.id).length;
          return (
            <li key={s.id} className={s.id === activeStepId ? 'on' : ''}>
              <button className="step-btn" onClick={() => onSelect(s.id)}>
                <b>{i + 1}</b>
                <span>{s.title || `Step ${i + 1}`}</span>
                <small>{n} line{n === 1 ? '' : 's'}</small>
              </button>
              <div className="step-actions">
                <button title="Move up" disabled={i === 0} onClick={() => moveStep(s.id, -1)}>↑</button>
                <button title="Move down" disabled={i === doc.steps.length - 1} onClick={() => moveStep(s.id, 1)}>↓</button>
                <button
                  title="Delete step and its lines"
                  disabled={doc.steps.length === 1}
                  onClick={() => {
                    if (n === 0 || confirm(`Delete step ${i + 1} and its ${n} line(s)?`)) removeStep(s.id);
                  }}
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <button className="btn" onClick={addStep}>+ Add step</button>
      {active && (
        <div className="field-group">
          <label>
            Step title
            <input value={active.title} onChange={(e) => updateStep(active.id, { title: e.target.value })} />
          </label>
          <label>
            What happens (coaching points)
            <textarea rows={4} value={active.caption} onChange={(e) => updateStep(active.id, { caption: e.target.value })} />
          </label>
        </div>
      )}
    </div>
  );
}

export function InspectorPanel() {
  const { doc, selection, edit, removeToken, removePath, setPosition, setTokenTeam, notify } = useEditor();
  const token = selection?.kind === 'token' ? doc.tokens.find((t) => t.id === selection.id) : undefined;
  const path = selection?.kind === 'path' ? doc.paths.find((p) => p.id === selection.id) : undefined;
  const setToken = (patch: object) =>
    edit((d) => ({ ...d, tokens: d.tokens.map((t) => (t.id === token!.id ? { ...t, ...patch } : t)) }));
  const setPath = (patch: Partial<DrawPath>) =>
    edit((d) => ({ ...d, paths: d.paths.map((p) => (p.id === path!.id ? { ...p, ...patch } : p)) }));

  if (token) {
    return (
      <div className="panel-body">
        <h3>{token.kind === 'puck' ? 'Puck' : token.kind === 'cone' ? 'Cone' : 'Player'}</h3>
        {(token.kind === 'player' || token.kind === 'goalie') && (
          <>
            <label>
              Position
              <select
                value={POSITION_OPTIONS.includes(token.label) ? token.label : 'X'}
                onChange={(e) => setPosition(token.id, e.target.value)}
              >
                {POSITION_OPTIONS.map((l) => (
                  <option key={l} value={l}>{l === 'X' ? 'Generic player' : l}</option>
                ))}
              </select>
            </label>
            {!isUniquePosition(token.label) && (
              <label>
                Label
                <input
                  maxLength={4}
                  value={token.label}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (isUniquePosition(v.toUpperCase())) return notify('Use the Position menu to assign C, LW, RW, LD, RD or G.');
                    setToken({ label: v });
                  }}
                />
              </label>
            )}
            <label>
              Team
              <select value={token.team} onChange={(e) => setTokenTeam(token.id, e.target.value as Team)}>
                <option value="off">Offense</option>
                <option value="def">Defense</option>
              </select>
            </label>
            <div>
              <span className="lbl">Color</span>
              <Swatches value={token.color ?? doc.colors[token.team]} onPick={(c) => setToken({ color: c })} />
            </div>
          </>
        )}
        <button className="btn danger" onClick={() => removeToken(token.id)}>Delete (also removes its lines)</button>
      </div>
    );
  }
  if (path) {
    return (
      <div className="panel-body">
        <h3>Line</h3>
        <label>
          Type
          <select value={path.kind} onChange={(e) => setPath({ kind: e.target.value as PathKind })}>
            <option value="skate">Skate</option>
            <option value="carry">Skate with puck</option>
            <option value="back">Skate backwards</option>
            <option value="pass">Pass</option>
            <option value="shot">Shot</option>
          </select>
        </label>
        <label>
          Step
          <select value={path.stepId} onChange={(e) => setPath({ stepId: e.target.value, after: undefined })}>
            {doc.steps.map((s, i) => (
              <option key={s.id} value={s.id}>{i + 1}. {s.title}</option>
            ))}
          </select>
        </label>
        <div>
          <span className="lbl">Color</span>
          <Swatches value={path.color} onPick={(c) => setPath({ color: c })} />
        </div>
        {!path.tokenId && <p className="hint">This line is not attached to a player, so it will not animate.</p>}
        {path.tokenId && <TimingSection path={path} />}
        <button className="btn danger" onClick={() => removePath(path.id)}>Delete line</button>
      </div>
    );
  }
  return (
    <div className="panel-body">
      <h3>Team colors</h3>
      <div>
        <span className="lbl">Offense</span>
        <Swatches value={doc.colors.off} onPick={(c) => edit((d) => ({ ...d, colors: { ...d.colors, off: c } }))} />
      </div>
      <div>
        <span className="lbl">Defense</span>
        <Swatches value={doc.colors.def} onPick={(c) => edit((d) => ({ ...d, colors: { ...d.colors, def: c } }))} />
      </div>
      <p className="hint">Select a player or line on the ice to edit it. Delete removes the selection; ⌘/Ctrl+Z undoes.</p>
    </div>
  );
}

export function DetailsPanel() {
  const { meta, setMeta } = useEditor();
  return (
    <div className="panel-body">
      <label>
        Drill name
        <input value={meta.name} onChange={(e) => setMeta({ name: e.target.value })} />
      </label>
      <label>
        Description
        <textarea rows={4} value={meta.description} onChange={(e) => setMeta({ description: e.target.value })} />
      </label>
      <label>
        Notes / what to follow
        <textarea rows={6} value={meta.notes} onChange={(e) => setMeta({ notes: e.target.value })} />
      </label>
      <label>
        Category
        <select value={meta.category} onChange={(e) => setMeta({ category: e.target.value })}>
          {[...new Set([meta.category, ...CATEGORIES])].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <div className="two">
        <label>
          Age group
          <input value={meta.ageGroup} onChange={(e) => setMeta({ ageGroup: e.target.value })} placeholder="e.g. U14" />
        </label>
        <label>
          Minutes
          <input type="number" min={0} max={600} value={meta.durationMin} onChange={(e) => setMeta({ durationMin: Number(e.target.value) || 0 })} />
        </label>
      </div>
      <label>
        Tags (comma separated)
        <input
          value={meta.tags.join(', ')}
          onChange={(e) => setMeta({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
        />
      </label>
    </div>
  );
}
