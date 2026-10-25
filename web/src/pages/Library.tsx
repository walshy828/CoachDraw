import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildTimeline } from '../../../shared/playback';
import { CATEGORIES, type Drill, type RinkView } from '../../../shared/types';
import { blankDoc, blankMeta } from '../editor/store';
import { api, type User } from '../lib/api';
import { DrillView } from '../rink/DrillView';

function Thumb({ drill }: { drill: Drill }) {
  const frame = useMemo(() => buildTimeline(drill.doc).startFrames[0], [drill.doc]);
  if (!frame) return null;
  return <DrillView doc={drill.doc} view={drill.rinkView} frame={frame} className="thumb" />;
}

export default function LibraryPage({ user, onLogout }: { user: User; onLogout: () => void }) {
  const nav = useNavigate();
  const [drills, setDrills] = useState<Drill[] | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [error, setError] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => api.listDrills().then(setDrills).catch((e) => setError(e.message));
  useEffect(() => {
    refresh();
  }, []);

  const create = async (view: RinkView) => {
    const d = await api.createDrill({ ...blankMeta(view), doc: blankDoc() });
    nav(`/drill/${d.id}`);
  };

  const importFile = async (f: File) => {
    try {
      const j = JSON.parse(await f.text());
      if (!j?.doc?.tokens || !j?.doc?.steps) throw new Error('Not a CoachDraw drill file');
      const d = await api.createDrill({ ...blankMeta(), ...j, doc: j.doc });
      nav(`/drill/${d.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const filtered = (drills ?? []).filter((d) => {
    const hay = `${d.name} ${d.description} ${d.tags.join(' ')} ${d.category}`.toLowerCase();
    return (!q || hay.includes(q.toLowerCase())) && (!cat || d.category === cat);
  });
  const cats = [...new Set([...CATEGORIES, ...(drills ?? []).map((d) => d.category)])];

  return (
    <div className="library">
      <header className="topbar">
        <h1 className="brand">🏒 CoachDraw</h1>
        <div className="spacer" />
        <span className="muted">{user.name}</span>
        <button className="btn" onClick={onLogout}>Sign out</button>
      </header>
      <div className="lib-body">
        <div className="lib-controls">
          <input type="search" placeholder="Search drills…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {cats.map((c) => <option key={c}>{c}</option>)}
          </select>
          <div className="spacer" />
          <button className="btn" onClick={() => fileRef.current?.click()}>Import JSON</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          <div className="menu">
            <button className="btn primary" onClick={() => setNewOpen((v) => !v)}>+ New drill</button>
            {newOpen && (
              <div className="popover right">
                <button className="btn" onClick={() => create('full')}>Full ice</button>
                <button className="btn" onClick={() => create('half-right')}>Half ice (offensive right)</button>
                <button className="btn" onClick={() => create('half-left')}>Half ice (offensive left)</button>
              </div>
            )}
          </div>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {drills && drills.length === 0 && (
          <div className="empty">
            <p>No drills yet.</p>
            <button className="btn" onClick={() => api.addSamples().then(setDrills)}>Add sample drills</button>
          </div>
        )}
        <div className="grid">
          {filtered.map((d) => (
            <article key={d.id} className="card drill-card">
              <button className="thumb-btn" onClick={() => nav(`/drill/${d.id}`)} aria-label={`Open ${d.name}`}>
                <Thumb drill={d} />
              </button>
              <h3>{d.name}</h3>
              <p className="chips-row">
                <span className="tag">{d.category}</span>
                {d.ageGroup && <span className="tag">{d.ageGroup}</span>}
                <span className="tag">{d.doc.steps.length} step{d.doc.steps.length === 1 ? '' : 's'}</span>
                {d.shareToken && <span className="tag shared">Shared</span>}
              </p>
              <p className="desc">{d.description}</p>
              <div className="row">
                <button className="btn primary" onClick={() => nav(`/drill/${d.id}/view`)}>View</button>
                <button className="btn" onClick={() => nav(`/drill/${d.id}`)}>Edit</button>
                <button className="btn" onClick={async () => { await api.duplicateDrill(d.id); refresh(); }}>Duplicate</button>
                <button
                  className="btn danger"
                  onClick={async () => {
                    if (confirm(`Delete “${d.name}”? This cannot be undone.`)) {
                      await api.deleteDrill(d.id);
                      refresh();
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
        {drills && drills.length > 0 && filtered.length === 0 && <p className="muted">No drills match your search.</p>}
        {drills && drills.length > 0 && (
          <p className="muted foot">
            <button className="link" onClick={() => api.addSamples().then(setDrills)}>Add the sample drills again</button>
          </p>
        )}
      </div>
    </div>
  );
}
