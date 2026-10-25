import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Canvas } from '../editor/Canvas';
import { Dock } from '../editor/Dock';
import { DrillSheet } from '../editor/DrillSheet';
import { DetailsPanel, InspectorPanel, StepsPanel } from '../editor/Panels';
import { Sheet, type SheetTab } from '../editor/Sheet';
import { StepTimeline } from '../editor/StepTimeline';
import { Toolbar, toolHint } from '../editor/Toolbar';
import { TopBar } from '../editor/TopBar';
import { useEditor } from '../editor/store';
import { api } from '../lib/api';
import { useFitRotation } from '../lib/useFitRotation';
import { usePlayback } from '../lib/usePlayback';

export default function EditorPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const s = useEditor();
  const { doc, meta, dirty, notice, activeStepId } = s;
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetTab | null>(null);
  const [turn, setTurn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'error'>('idle');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const sheetRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    api
      .getDrill(Number(id))
      .then((d) => {
        if (!alive) return;
        s.load(d);
        setLoaded(true);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const editingIndex = Math.max(0, doc.steps.findIndex((x) => x.id === activeStepId));
  const pb = usePlayback(doc, editingIndex);
  const activeIndex = pb.active ? pb.stepIndex : editingIndex;

  const save = useCallback(async () => {
    const st = useEditor.getState();
    if (st.id == null) return;
    setSaving('saving');
    try {
      await api.updateDrill(st.id, { ...st.meta, doc: st.doc });
      st.markSaved();
      setSaving('idle');
    } catch {
      setSaving('error');
    }
  }, []);

  // debounced autosave
  useEffect(() => {
    if (!loaded || !dirty) return;
    const t = setTimeout(save, 1200);
    return () => clearTimeout(t);
  }, [doc, meta, dirty, loaded, save]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (useEditor.getState().dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => useEditor.getState().notify(null), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable) return;
      const st = useEditor.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? st.redo() : st.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        st.redo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && st.selection) {
        e.preventDefault();
        st.selection.kind === 'token' ? st.removeToken(st.selection.id) : st.removePath(st.selection.id);
        st.select(null);
      } else if (e.key === ' ' && el.tagName !== 'BUTTON') {
        e.preventDefault();
        pbToggle.current();
      } else if (e.key === 'Escape') {
        st.select(null);
        st.setTool({ type: 'select' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const pbToggle = useRef(pb.toggle);
  pbToggle.current = pb.toggle;

  const selectStep = (stepId: string) => {
    pb.stop();
    s.setActiveStep(stepId);
  };

  const toggleSheet = (t: SheetTab) => setSheet((cur) => (cur === t ? null : t));
  const openInspector = useCallback(() => setSheet('inspect'), []);
  const fit = useFitRotation(meta.rinkView, turn, loaded);

  if (error) {
    return (
      <div className="center-page">
        <p className="error">{error}</p>
        <Link to="/">Back to your drills</Link>
      </div>
    );
  }
  if (!loaded) return <div className="center-page">Loading…</div>;

  const hint = pb.active ? null : toolHint(s.tool, s.team);

  return (
    <div className={`editor ${sheet ? 'sheet-open' : ''}`}>
      <TopBar
        saving={saving}
        playing={pb.active}
        rotated={fit.rotated}
        onRotate={setTurn}
        onSave={save}
        onBack={async () => {
          if (useEditor.getState().dirty) await save();
          nav('/');
        }}
        onDetails={() => setSheet('details')}
        onView={async () => {
          if (useEditor.getState().dirty) await save();
          nav(`/drill/${id}/view`);
        }}
        sheetRef={sheetRef}
      />

      <Toolbar disabled={pb.active} />

      <main className="stage">
        <div className="canvas-wrap" ref={fit.ref}>
          <Canvas
            frame={pb.frame}
            readOnly={pb.active}
            playback={pb.active}
            activeIndex={activeIndex}
            svgRef={svgRef}
            rotated={fit.rotated}
            onInspect={openInspector}
          />
        </div>
        <div className="msgs">
          {hint && (
            <div className="hint-pill">
              <span>{hint}</span>
              <button onClick={() => s.setTool({ type: 'select' })}>Done</button>
            </div>
          )}
          {notice && <div className="toast" role="status">{notice}</div>}
        </div>
      </main>

      <Dock
        pb={pb}
        doc={doc}
        activeIndex={activeIndex}
        sheet={sheet}
        onSheet={toggleSheet}
        onSelectStep={selectStep}
        onAddStep={() => {
          pb.stop();
          s.addStep();
        }}
      />

      {sheet && (
        <Sheet tab={sheet} onTab={setSheet} onClose={() => setSheet(null)}>
          {sheet === 'steps' && <StepsPanel onSelect={selectStep} />}
          {sheet === 'timing' && <StepTimeline pb={pb} stepIndex={activeIndex} />}
          {sheet === 'inspect' && <InspectorPanel />}
          {sheet === 'details' && <DetailsPanel />}
        </Sheet>
      )}

      <DrillSheet ref={sheetRef} meta={meta} doc={doc} className="print-only" />
    </div>
  );
}
