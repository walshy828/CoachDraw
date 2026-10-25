import { useEffect, useRef, useState } from 'react';
import type { PathKind, TokenKind } from '../../../shared/types';
import { luminance } from '../rink/DrillView';
import { Icon, LineGlyph } from '../ui/Icon';
import { findSlot, teamName, useEditor, type Tool } from './store';

const PLAYERS: { label: string; kind: TokenKind; title: string }[] = [
  { label: 'C', kind: 'player', title: 'Center' },
  { label: 'LW', kind: 'player', title: 'Left wing' },
  { label: 'RW', kind: 'player', title: 'Right wing' },
  { label: 'LD', kind: 'player', title: 'Left defense' },
  { label: 'RD', kind: 'player', title: 'Right defense' },
  { label: 'G', kind: 'goalie', title: 'Goalie' },
  { label: 'X', kind: 'player', title: 'Generic player' },
];

const PATHS: { kind: PathKind; label: string; hint: string }[] = [
  { kind: 'skate', label: 'Skate', hint: 'Dashed' },
  { kind: 'carry', label: 'Carry', hint: 'Skate with puck' },
  { kind: 'back', label: 'Back', hint: 'Backward skating' },
  { kind: 'pass', label: 'Pass', hint: 'Moves the puck' },
  { kind: 'shot', label: 'Shot', hint: 'Heavy line' },
];

type Flyout = 'add' | 'draw' | null;

/** What the active tool is waiting for, shown as a pill over the ice so touch users always know the next tap. */
export function toolHint(tool: Tool, team: 'off' | 'def'): string | null {
  switch (tool.type) {
    case 'token':
      return `Tap the ice to place ${tool.kind === 'puck' ? 'the puck' : tool.kind === 'cone' ? 'a cone' : `${teamName(team)} ${tool.label}`}`;
    case 'path':
      return `Drag from ${tool.kind === 'pass' || tool.kind === 'shot' ? 'the puck' : 'a player'} to draw a ${tool.kind} line`;
    case 'erase':
      return 'Tap a player or line to delete it';
    default:
      return null;
  }
}

export function Toolbar({ disabled }: { disabled: boolean }) {
  const { tool, setTool, team, setTeam, cleanup, setCleanup, doc, addLineup } = useEditor();
  const [open, setOpen] = useState<Flyout>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const hasPuck = doc.tokens.some((t) => t.kind === 'puck');

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [open]);

  const pick = (t: Tool) => {
    setTool(t);
    setOpen(null);
  };

  return (
    <div className="rail" ref={rootRef} role="toolbar" aria-label="Tools">
      <button className={`rail-btn ${tool.type === 'select' ? 'on' : ''}`} disabled={disabled} onClick={() => pick({ type: 'select' })} aria-label="Select and move">
        <Icon name="select" />
        <span>Select</span>
      </button>
      <button
        className={`rail-btn ${tool.type === 'token' ? 'on' : ''} ${open === 'add' ? 'open' : ''}`}
        disabled={disabled}
        onClick={() => setOpen(open === 'add' ? null : 'add')}
        aria-expanded={open === 'add'}
        aria-label="Add players"
      >
        <Icon name="player" />
        <span>Players</span>
      </button>
      <button
        className={`rail-btn ${tool.type === 'path' ? 'on' : ''} ${open === 'draw' ? 'open' : ''}`}
        disabled={disabled}
        onClick={() => setOpen(open === 'draw' ? null : 'draw')}
        aria-expanded={open === 'draw'}
        aria-label="Draw movement"
      >
        <Icon name="draw" />
        <span>Draw</span>
      </button>
      <button className={`rail-btn ${tool.type === 'erase' ? 'on' : ''}`} disabled={disabled} onClick={() => pick({ type: 'erase' })} aria-label="Erase">
        <Icon name="erase" />
        <span>Erase</span>
      </button>

      {open === 'add' && (
        <div className="flyout" role="group" aria-label="Add players">
          <div className="seg big" role="group" aria-label="Team">
            {(['off', 'def'] as const).map((t) => (
              <button key={t} className={team === t ? 'on' : ''} onClick={() => setTeam(t)}>
                <i style={{ background: doc.colors[t] }} /> {teamName(t)}
              </button>
            ))}
          </div>
          <div className="pick-grid">
            {PLAYERS.map((p) => {
              const taken = !!findSlot(doc, team, p.label);
              return (
                <button
                  key={p.label}
                  className="pick"
                  disabled={taken}
                  title={taken ? `${teamName(team)} ${p.label} is already on the ice` : `Place ${teamName(team)} ${p.title}`}
                  onClick={() => pick({ type: 'token', kind: p.kind, label: p.label })}
                >
                  <b className="dot" style={{ background: doc.colors[team], color: luminance(doc.colors[team]) < 0.55 ? '#fff' : '#111' }}>{p.label}</b>
                </button>
              );
            })}
            <button className="pick" disabled={hasPuck} title={hasPuck ? 'The puck is already on the ice' : 'Place the puck'} onClick={() => pick({ type: 'token', kind: 'puck', label: '' })}>
              <b className="puck" />
              <small>Puck</small>
            </button>
            <button className="pick" title="Place a cone" onClick={() => pick({ type: 'token', kind: 'cone', label: '' })}>
              <b className="cone" />
              <small>Cone</small>
            </button>
          </div>
          <button
            className="btn wide"
            onClick={() => {
              addLineup();
              setOpen(null);
            }}
          >
            <Icon name="plus" size={18} /> Standard lineup (C, LW, RW, LD, RD)
          </button>
        </div>
      )}

      {open === 'draw' && (
        <div className="flyout" role="group" aria-label="Draw movement">
          {PATHS.map((p) => {
            const needsPuck = (p.kind === 'pass' || p.kind === 'shot') && !hasPuck;
            return (
              <button
                key={p.kind}
                className={`line-opt ${tool.type === 'path' && tool.kind === p.kind ? 'on' : ''}`}
                onClick={() => pick({ type: 'path', kind: p.kind })}
              >
                <LineGlyph kind={p.kind} />
                <span>
                  <b>{p.label}</b>
                  <small>{needsPuck ? 'Add the puck first' : p.hint}</small>
                </span>
              </button>
            );
          })}
          <label className="switch big" title="Straightens lines, rounds curves and snaps hand-drawn circles">
            <input type="checkbox" checked={cleanup} onChange={(e) => setCleanup(e.target.checked)} />
            <span>Clean up my lines</span>
          </label>
        </div>
      )}
    </div>
  );
}
