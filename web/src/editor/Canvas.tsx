import { useCallback, useMemo, useRef, useState } from 'react';
import { cleanStroke, dist, pathLength, project } from '../../../shared/geometry';
import type { Frame } from '../../../shared/playback';
import type { DrawPath, PathKind, Pt, Team, TokenKind } from '../../../shared/types';
import { DrillView, tokenColor } from '../rink/DrillView';
import { RINK_L, RINK_W, unrotatePt } from '../rink/Rink';
import { ContextMenu, type MenuEntry } from './ContextMenu';
import { findSlot, isSkaterOrGoalie, teamName, uid, useEditor } from './store';

const PICK_RADIUS = 7;
const LONG_PRESS_MS = 500;
const LONG_PRESS_SLOP = 10;

type Hit = { kind: 'token' | 'path' | 'trigger'; id: string } | null;
interface MenuState {
  x: number;
  y: number;
  rink: Pt;
  target: Hit;
}

const POSITION_CHIPS: { label: string; kind: TokenKind }[] = [
  { label: 'C', kind: 'player' },
  { label: 'LW', kind: 'player' },
  { label: 'RW', kind: 'player' },
  { label: 'LD', kind: 'player' },
  { label: 'RD', kind: 'player' },
  { label: 'G', kind: 'goalie' },
  { label: 'X', kind: 'player' },
];

const DRAW_CHIPS: { kind: PathKind; label: string }[] = [
  { kind: 'skate', label: 'Skate' },
  { kind: 'carry', label: 'Carry' },
  { kind: 'back', label: 'Back' },
  { kind: 'pass', label: 'Pass' },
  { kind: 'shot', label: 'Shot' },
];

interface Props {
  frame: Frame;
  readOnly: boolean;
  svgRef: React.RefObject<SVGSVGElement | null>;
  activeIndex: number;
  /** In playback only the steps reached so far are drawn. */
  playback: boolean;
  /** The ice is drawn turned 90° (portrait screens). */
  rotated: boolean;
  /** Open the full details sheet for whatever is selected. */
  onInspect: () => void;
}

export function Canvas({ frame, readOnly, svgRef, activeIndex, playback, rotated, onInspect }: Props) {
  const s = useEditor();
  const { doc, meta, tool, selection, activeStepId, cleanup, team } = s;
  const [draft, setDraft] = useState<{ points: Pt[]; color: string } | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const gesture = useRef<
    | { type: 'drag'; id: string; dx: number; dy: number; moved: boolean; tap?: boolean }
    | { type: 'trigger'; pathId: string; moved: boolean }
    | { type: 'tap'; target: Hit }
    | { type: 'draw'; raw: Pt[]; tokenId: string | null; color: string }
    | null
  >(null);
  const press = useRef<{ timer: number; cx: number; cy: number } | null>(null);

  const toRink = (e: { clientX: number; clientY: number }): Pt => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const root = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const r = rotated ? unrotatePt(root) : root;
    return { x: Math.max(0, Math.min(RINK_L, r.x)), y: Math.max(0, Math.min(RINK_W, r.y)) };
  };

  const hit = (target: EventTarget | null): Hit => {
    const el = (target as Element | null)?.closest?.('[data-id]') as SVGElement | null;
    return el ? { kind: el.dataset.kind as 'token' | 'path' | 'trigger', id: el.dataset.id! } : null;
  };

  const pickMover = (p: Pt, kind: DrawPath['kind']): string | null => {
    if (kind === 'pass' || kind === 'shot') return doc.tokens.find((t) => t.kind === 'puck')?.id ?? null;
    let best: string | null = null;
    let bestD = PICK_RADIUS;
    for (const t of doc.tokens) {
      if (!isSkaterOrGoalie(t)) continue;
      const d = dist(frame.pos[t.id] ?? t, p);
      if (d < bestD) {
        bestD = d;
        best = t.id;
      }
    }
    return best;
  };

  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };

  const openMenu = (clientX: number, clientY: number, target: Hit) => {
    gesture.current = null;
    setDraft(null);
    if (target && target.kind !== 'trigger') s.select({ kind: target.kind, id: target.id });
    setMenu({ x: clientX, y: clientY, rink: toRink({ clientX, clientY }), target });
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    cancelPress();
    if (readOnly) return;
    openMenu(e.clientX, e.clientY, hit(e.target));
  };

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (readOnly || e.button !== 0) return;
    if (menu) setMenu(null);
    const p = toRink(e);
    const target = hit(e.target);

    if (e.pointerType !== 'mouse') {
      cancelPress();
      const { clientX, clientY, pointerId } = e;
      const svg = e.currentTarget;
      press.current = {
        cx: clientX,
        cy: clientY,
        timer: window.setTimeout(() => {
          press.current = null;
          svg.releasePointerCapture?.(pointerId);
          openMenu(clientX, clientY, target);
        }, LONG_PRESS_MS),
      };
    }

    if (tool.type === 'erase') {
      if (target?.kind === 'token') s.removeToken(target.id);
      else if (target?.kind === 'path') s.removePath(target.id);
      return;
    }

    if (target?.kind === 'trigger' && tool.type === 'select') {
      gesture.current = { type: 'trigger', pathId: target.id, moved: false };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (tool.type === 'select') {
      if (!target || target.kind === 'trigger') return s.select(null);
      s.select({ kind: target.kind, id: target.id });
      // on touch a tap (no drag) opens the quick actions, so nothing depends on a long press
      if (e.pointerType !== 'mouse') gesture.current = { type: 'tap', target };
      if (target.kind === 'token') {
        if (activeIndex !== 0) {
          if (e.pointerType === 'mouse') s.notify('Starting positions can only be moved on Step 1. Select Step 1 to reposition players.');
          return;
        }
        const t = doc.tokens.find((x) => x.id === target.id)!;
        gesture.current = { type: 'drag', id: t.id, dx: t.x - p.x, dy: t.y - p.y, moved: false, tap: e.pointerType !== 'mouse' };
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      return;
    }

    if (tool.type === 'token') {
      s.addToken(p.x, p.y);
      return;
    }

    if (tool.type === 'path') {
      const tokenId = pickMover(p, tool.kind);
      const mover = doc.tokens.find((t) => t.id === tokenId);
      if (!tokenId && (tool.kind === 'pass' || tool.kind === 'shot')) {
        s.notify('Add a puck first (Puck button) so passes and shots can be animated.');
      } else if (!tokenId) {
        s.notify('Start the line on a player to attach it. Unattached lines are drawn but do not animate.');
      }
      const holder = frame.holder ? doc.tokens.find((t) => t.id === frame.holder) : undefined;
      const color =
        tool.kind === 'pass' || tool.kind === 'shot'
          ? holder
            ? tokenColor(doc, holder)
            : doc.colors[team]
          : mover
            ? tokenColor(doc, mover)
            : doc.colors[team];
      const start = tool.kind !== 'pass' && tool.kind !== 'shot' && mover ? (frame.pos[mover.id] ?? p) : p;
      gesture.current = { type: 'draw', raw: [start, p], tokenId, color };
      setDraft({ points: [start, p], color });
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (press.current && Math.hypot(e.clientX - press.current.cx, e.clientY - press.current.cy) > LONG_PRESS_SLOP) cancelPress();
    const g = gesture.current;
    if (!g) return;
    if (g.type === 'tap') {
      if (press.current === null) gesture.current = null;
      return;
    }
    const p = toRink(e);
    if (g.type === 'drag') {
      // a fingertip always wobbles: don't start dragging until it has clearly moved
      if (g.tap && !g.moved && press.current) return;
      if (!g.moved) {
        s.beginGesture();
        g.moved = true;
      }
      const x = Math.max(1, Math.min(RINK_L - 1, p.x + g.dx));
      const y = Math.max(1, Math.min(RINK_W - 1, p.y + g.dy));
      s.patch((d) => ({ ...d, tokens: d.tokens.map((t) => (t.id === g.id ? { ...t, x, y } : t)) }));
    } else if (g.type === 'trigger') {
      const target = useEditor.getState().doc.paths.find((q) => q.id === g.pathId);
      const src = target?.after && useEditor.getState().doc.paths.find((q) => q.id === target.after!.pathId);
      if (!target || !src) return;
      if (!g.moved) {
        s.beginGesture();
        g.moved = true;
      }
      const at = Math.round(project(src.points, p) * 20) / 20;
      s.patch((d) => ({ ...d, paths: d.paths.map((q) => (q.id === g.pathId ? { ...q, after: { pathId: src.id, at } } : q)) }));
    } else {
      g.raw.push(p);
      setDraft({ points: g.raw.slice(), color: g.color });
    }
  };

  const onUp = (e: React.PointerEvent<SVGSVGElement>) => {
    cancelPress();
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (e.type === 'pointerup' && ((g.type === 'tap' && g.target) || (g.type === 'drag' && g.tap && !g.moved))) {
      const target: Hit = g.type === 'tap' ? g.target : { kind: 'token', id: g.id };
      return openMenu(e.clientX, e.clientY, target);
    }
    if (g.type !== 'draw' || tool.type !== 'path') return;
    setDraft(null);
    if (pathLength(g.raw) < 3) return;
    let points = cleanStroke(g.raw, cleanup);
    if (points.length < 2) return;
    if (g.tokenId && tool.kind !== 'pass' && tool.kind !== 'shot') {
      // anchor the line exactly on the player's position at this step
      points = [g.raw[0], ...points.slice(1)];
    } else if (tool.kind === 'pass' || tool.kind === 'shot') {
      const puck = doc.tokens.find((t) => t.id === g.tokenId);
      if (puck) points = [frame.pos[puck.id] ?? points[0], ...points.slice(1)];
    }
    const path: DrawPath = {
      id: uid('p'),
      tokenId: g.tokenId,
      kind: tool.kind,
      stepId: activeStepId,
      points,
      color: g.color,
    };
    s.edit((d) => ({ ...d, paths: [...d.paths, path] }));
    s.select({ kind: 'path', id: path.id });
  };

  const startDrawing = (kind: PathKind) => s.setTool({ type: 'path', kind });

  const entries = useMemo((): MenuEntry[] => {
    if (!menu) return [];
    const { target, rink } = menu;
    const token = target?.kind === 'token' ? doc.tokens.find((t) => t.id === target.id) : undefined;
    const path = target?.kind === 'path' ? doc.paths.find((p) => p.id === target.id) : undefined;

    if (token && isSkaterOrGoalie(token)) {
      const other: Team = token.team === 'off' ? 'def' : 'off';
      return [
        { type: 'header', label: `${teamName(token.team)} ${token.label} — position` },
        {
          type: 'chips',
          items: POSITION_CHIPS.map((c) => {
            const taken = findSlot(doc, token.team, c.label, token.id);
            return {
              label: c.label,
              active: token.label === c.label,
              title: taken ? `Swap with the existing ${c.label}` : `Make this player ${c.label}`,
              onClick: () => s.setPosition(token.id, c.label),
            };
          }),
        },
        { type: 'item', label: `Switch to ${teamName(other)}`, onClick: () => s.setTokenTeam(token.id, other) },
        { type: 'header', label: 'Draw from this player' },
        { type: 'chips', items: DRAW_CHIPS.filter((c) => c.kind !== 'pass' && c.kind !== 'shot').map((c) => ({ label: c.label, onClick: () => startDrawing(c.kind) })) },
        { type: 'item', label: 'Color & more…', onClick: onInspect },
        { type: 'item', label: 'Delete player', danger: true, onClick: () => s.removeToken(token.id) },
      ];
    }
    if (token) {
      return [
        { type: 'header', label: token.kind === 'puck' ? 'Puck' : 'Cone' },
        ...(token.kind === 'puck'
          ? [{ type: 'chips', items: DRAW_CHIPS.filter((c) => c.kind === 'pass' || c.kind === 'shot').map((c) => ({ label: c.label, onClick: () => startDrawing(c.kind) })) } as MenuEntry]
          : []),
        { type: 'item', label: 'Delete', danger: true, onClick: () => s.removeToken(token.id) },
      ];
    }
    if (path) {
      const timed = !!path.after || (path.delay ?? 0) > 0;
      return [
        { type: 'header', label: 'Line' },
        {
          type: 'chips',
          items: DRAW_CHIPS.map((c) => ({
            label: c.label,
            active: path.kind === c.kind,
            onClick: () => s.edit((d) => ({ ...d, paths: d.paths.map((p) => (p.id === path.id ? { ...p, kind: c.kind } : p)) })),
          })),
        },
        {
          type: 'item',
          label: 'Timing, color & more…',
          onClick: () => {
            s.setTool({ type: 'select' });
            s.select({ kind: 'path', id: path.id });
            onInspect();
          },
        },
        ...(timed
          ? [
              {
                type: 'item',
                label: 'Start with the step (clear wait)',
                onClick: () =>
                  s.edit((d) => ({ ...d, paths: d.paths.map((p) => (p.id === path.id ? { ...p, after: undefined, delay: undefined } : p)) })),
              } as MenuEntry,
            ]
          : []),
        { type: 'item', label: 'Delete line', danger: true, onClick: () => s.removePath(path.id) },
      ];
    }

    // empty ice
    const adders = (t: Team): MenuEntry => ({
      type: 'chips',
      items: POSITION_CHIPS.map((c) => ({
        label: c.label,
        disabled: !!findSlot(doc, t, c.label),
        title: findSlot(doc, t, c.label) ? `${teamName(t)} ${c.label} is already on the ice` : `Add ${teamName(t)} ${c.label} here`,
        onClick: () => s.placeToken({ kind: c.kind, label: c.label }, t, rink.x, rink.y),
      })),
    });
    const hasPuck = doc.tokens.some((t) => t.kind === 'puck');
    return [
      { type: 'header', label: 'Add offense player here' },
      adders('off'),
      { type: 'header', label: 'Add defense player here' },
      adders('def'),
      {
        type: 'chips',
        items: [
          { label: 'Puck', disabled: hasPuck, onClick: () => s.placeToken({ kind: 'puck', label: '' }, 'off', rink.x, rink.y) },
          { label: 'Cone', onClick: () => s.placeToken({ kind: 'cone', label: '' }, 'off', rink.x, rink.y) },
        ],
      },
      { type: 'header', label: 'Draw movement' },
      { type: 'chips', items: DRAW_CHIPS.map((c) => ({ label: c.label, onClick: () => startDrawing(c.kind) })) },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, doc]);

  const cursor = useMemo(() => {
    if (readOnly) return 'default';
    if (tool.type === 'select') return 'default';
    if (tool.type === 'erase') return 'not-allowed';
    return 'crosshair';
  }, [tool, readOnly]);

  return (
    <>
      <DrillView
        ref={svgRef}
        doc={doc}
        view={meta.rinkView}
        frame={frame}
        activeStepId={doc.steps[activeIndex]?.id ?? activeStepId}
        pathMode={playback ? 'upto-active' : 'all'}
        selected={playback ? null : selection}
        badges
        timing={!playback}
        preview={draft}
        className="rink-svg"
        rotated={rotated}
        style={{ cursor, touchAction: 'none', WebkitTouchCallout: 'none' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={onContextMenu}
      />
      {menu && <ContextMenu x={menu.x} y={menu.y} entries={entries} onClose={closeMenu} />}
    </>
  );
}
