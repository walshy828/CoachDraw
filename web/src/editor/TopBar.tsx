import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RinkView } from '../../../shared/types';
import { api } from '../lib/api';
import { download, exportPng, safeName } from '../lib/exportImage';
import { Icon } from '../ui/Icon';
import { useEditor } from './store';

const VIEWS: [RinkView, string][] = [
  ['full', 'Full ice'],
  ['half-right', 'Half →'],
  ['half-left', '← Half'],
];

interface Props {
  saving: 'idle' | 'saving' | 'error';
  playing: boolean;
  rotated: boolean;
  onRotate: (v: boolean) => void;
  onSave: () => Promise<void>;
  onBack: () => void;
  onDetails: () => void;
  onView: () => void;
  sheetRef: React.RefObject<SVGSVGElement | null>;
}

export function TopBar({ saving, playing, rotated, onRotate, onSave, onBack, onDetails, onView, sheetRef }: Props) {
  const s = useEditor();
  const { meta, doc, dirty } = s;
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const away = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [menu]);

  const shareUrl = useMemo(() => (s.shareToken ? `${location.origin}/s/${s.shareToken}` : ''), [s.shareToken]);
  const toggleShare = async () => {
    if (!s.id) return;
    if (s.shareToken) {
      await api.unshare(s.id);
      s.setShareToken(null);
    } else {
      const r = await api.share(s.id);
      s.setShareToken(r.shareToken);
    }
  };

  const state = saving === 'saving' ? 'saving' : saving === 'error' ? 'error' : dirty ? 'dirty' : 'saved';
  const stateText = { saving: 'Saving…', error: 'Save failed – tap to retry', dirty: 'Unsaved changes', saved: 'Saved' }[state];

  return (
    <header className="topbar-float">
      <div className="bar-pill left">
        <Link
          to="/"
          className="icon-btn"
          aria-label="Back to your drills"
          onClick={(e) => {
            e.preventDefault();
            onBack();
          }}
        >
          <Icon name="back" />
        </Link>
        <input className="title-input" value={meta.name} onChange={(e) => s.setMeta({ name: e.target.value })} aria-label="Drill name" />
        <button className={`save-dot ${state}`} onClick={onSave} aria-label={stateText} title={stateText}>
          <i />
          <span>{stateText}</span>
        </button>
      </div>

      <div className="bar-pill right" ref={menuRef}>
        <button className="icon-btn" disabled={!s.past.length || playing} onClick={s.undo} aria-label="Undo">
          <Icon name="undo" />
        </button>
        <button className="icon-btn" disabled={!s.future.length || playing} onClick={s.redo} aria-label="Redo">
          <Icon name="redo" />
        </button>
        <button className="icon-btn" onClick={onView} aria-label="View mode (full screen)">
          <Icon name="eye" />
        </button>
        <button className={`icon-btn ${menu ? 'on' : ''}`} onClick={() => setMenu((v) => !v)} aria-label="More" aria-expanded={menu}>
          <Icon name="more" />
        </button>

        {menu && (
          <div className="menu-sheet" role="menu">
            <h5>Rink</h5>
            <div className="seg big" role="group" aria-label="Rink view">
              {VIEWS.map(([v, label]) => (
                <button key={v} className={meta.rinkView === v ? 'on' : ''} onClick={() => s.setMeta({ rinkView: v })}>
                  {label}
                </button>
              ))}
            </div>
            <button className="menu-row" onClick={() => onRotate(!rotated)}>
              <Icon name="rotate" size={20} />
              <span>{rotated ? 'Show ice sideways' : 'Turn ice upright (tall)'}</span>
            </button>
            <button
              className="menu-row"
              onClick={() => {
                setMenu(false);
                onDetails();
              }}
            >
              <Icon name="info" size={20} />
              <span>Drill details & notes</span>
            </button>

            <h5>Share</h5>
            <label className="switch big">
              <input type="checkbox" checked={!!s.shareToken} onChange={toggleShare} />
              <span>Anyone with the link can view</span>
            </label>
            {shareUrl && (
              <div className="share-link">
                <input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} />
                <button className="btn" onClick={() => navigator.clipboard?.writeText(shareUrl)}>Copy</button>
              </div>
            )}
            <button className="menu-row" onClick={() => sheetRef.current && exportPng(sheetRef.current, safeName(meta.name))}>
              <Icon name="share" size={20} />
              <span>Download PNG</span>
            </button>
            <button className="menu-row" onClick={() => window.print()}>
              <Icon name="share" size={20} />
              <span>Print / Save as PDF</span>
            </button>
            <button
              className="menu-row"
              onClick={() =>
                download(
                  new Blob([JSON.stringify({ app: 'coachdraw', version: 1, ...meta, doc }, null, 2)], { type: 'application/json' }),
                  `${safeName(meta.name)}.coachdraw.json`,
                )
              }
            >
              <Icon name="share" size={20} />
              <span>Export JSON</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
