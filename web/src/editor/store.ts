import { create } from 'zustand';
import type { Drill, DrillDoc, DrillMeta, DrawPath, PathKind, Team, Token, TokenKind } from '../../../shared/types';
import { DEFAULT_COLORS, UNIQUE_POSITIONS } from '../../../shared/types';
import type { Selection } from '../rink/DrillView';

export type Tool =
  | { type: 'select' }
  | { type: 'erase' }
  | { type: 'token'; kind: TokenKind; label: string }
  | { type: 'path'; kind: PathKind };

export const uid = (p: string) => `${p}${Math.random().toString(36).slice(2, 9)}`;

export const blankDoc = (): DrillDoc => ({
  tokens: [],
  paths: [],
  steps: [{ id: uid('s'), title: 'Step 1', caption: '' }],
  colors: { ...DEFAULT_COLORS },
});

export const blankMeta = (rinkView: DrillMeta['rinkView'] = 'full'): DrillMeta => ({
  name: 'Untitled drill',
  description: '',
  notes: '',
  category: 'Other',
  ageGroup: '',
  durationMin: 10,
  tags: [],
  rinkView,
});

const HISTORY_LIMIT = 100;

export const isSkaterOrGoalie = (t: Token) => t.kind === 'player' || t.kind === 'goalie';
export const isUniquePosition = (label: string) => (UNIQUE_POSITIONS as readonly string[]).includes(label);
export const teamName = (t: Team) => (t === 'off' ? 'Offense' : 'Defense');

/** The player already holding this position for the team, if any (generic labels never conflict). */
export function findSlot(doc: DrillDoc, team: Team, label: string, exceptId?: string): Token | undefined {
  if (!isUniquePosition(label)) return undefined;
  return doc.tokens.find((t) => isSkaterOrGoalie(t) && t.team === team && t.label === label && t.id !== exceptId);
}

export interface TokenSpec {
  kind: TokenKind;
  label: string;
}

interface EditorState {
  id: number | null;
  meta: DrillMeta;
  doc: DrillDoc;
  shareToken: string | null;
  tool: Tool;
  team: Team;
  cleanup: boolean;
  selection: Selection;
  activeStepId: string;
  past: DrillDoc[];
  future: DrillDoc[];
  dirty: boolean;
  notice: string | null;

  load: (d: Drill | { meta: DrillMeta; doc: DrillDoc }) => void;
  setTool: (t: Tool) => void;
  setTeam: (t: Team) => void;
  setCleanup: (v: boolean) => void;
  setMeta: (patch: Partial<DrillMeta>) => void;
  select: (s: Selection) => void;
  setActiveStep: (id: string) => void;
  notify: (msg: string | null) => void;
  setShareToken: (t: string | null) => void;
  markSaved: () => void;

  /** Apply a change to the document, recording an undo point. */
  edit: (fn: (doc: DrillDoc) => DrillDoc) => void;
  /** Record an undo point now, then apply changes without further history (drags). */
  beginGesture: () => void;
  patch: (fn: (doc: DrillDoc) => DrillDoc) => void;
  undo: () => void;
  redo: () => void;

  addToken: (x: number, y: number) => string | null;
  /** Place a token, enforcing one player per position per team and a single puck. */
  placeToken: (spec: TokenSpec, team: Team, x: number, y: number) => string | null;
  setPosition: (id: string, label: string) => void;
  setTokenTeam: (id: string, team: Team) => void;
  addLineup: () => void;
  removeToken: (id: string) => void;
  removePath: (id: string) => void;
  addStep: () => void;
  removeStep: (id: string) => void;
  moveStep: (id: string, dir: -1 | 1) => void;
  updateStep: (id: string, patch: { title?: string; caption?: string }) => void;
}

export const useEditor = create<EditorState>((set, get) => ({
  id: null,
  meta: blankMeta(),
  doc: blankDoc(),
  shareToken: null,
  tool: { type: 'select' },
  team: 'off',
  cleanup: true,
  selection: null,
  activeStepId: '',
  past: [],
  future: [],
  dirty: false,
  notice: null,

  load: (d) => {
    const meta: DrillMeta =
      'meta' in d
        ? d.meta
        : {
            name: d.name,
            description: d.description,
            notes: d.notes,
            category: d.category,
            ageGroup: d.ageGroup,
            durationMin: d.durationMin,
            tags: d.tags,
            rinkView: d.rinkView,
          };
    const doc = d.doc.steps.length ? d.doc : { ...d.doc, steps: [{ id: uid('s'), title: 'Step 1', caption: '' }] };
    set({
      id: 'id' in d ? d.id : null,
      shareToken: 'shareToken' in d ? d.shareToken : null,
      meta,
      doc,
      past: [],
      future: [],
      selection: null,
      tool: { type: 'select' },
      activeStepId: doc.steps[0].id,
      dirty: false,
      notice: null,
    });
  },

  setTool: (tool) => set({ tool, selection: tool.type === 'select' ? get().selection : null }),
  setTeam: (team) => set({ team }),
  setCleanup: (cleanup) => set({ cleanup }),
  setMeta: (patch) => set((s) => ({ meta: { ...s.meta, ...patch }, dirty: true })),
  select: (selection) => set({ selection }),
  setActiveStep: (activeStepId) => set({ activeStepId, selection: null }),
  notify: (notice) => set({ notice }),
  setShareToken: (shareToken) => set({ shareToken }),
  markSaved: () => set({ dirty: false }),

  edit: (fn) =>
    set((s) => ({
      doc: fn(s.doc),
      past: [...s.past, s.doc].slice(-HISTORY_LIMIT),
      future: [],
      dirty: true,
    })),
  beginGesture: () => set((s) => ({ past: [...s.past, s.doc].slice(-HISTORY_LIMIT), future: [] })),
  patch: (fn) => set((s) => ({ doc: fn(s.doc), dirty: true })),

  undo: () =>
    set((s) => {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1];
      const stepOk = prev.steps.some((x) => x.id === s.activeStepId);
      return {
        doc: prev,
        past: s.past.slice(0, -1),
        future: [s.doc, ...s.future],
        selection: null,
        activeStepId: stepOk ? s.activeStepId : prev.steps[0].id,
        dirty: true,
      };
    }),
  redo: () =>
    set((s) => {
      if (!s.future.length) return s;
      const next = s.future[0];
      const stepOk = next.steps.some((x) => x.id === s.activeStepId);
      return {
        doc: next,
        past: [...s.past, s.doc],
        future: s.future.slice(1),
        selection: null,
        activeStepId: stepOk ? s.activeStepId : next.steps[0].id,
        dirty: true,
      };
    }),

  addToken: (x, y) => {
    const { tool, team, placeToken } = get();
    if (tool.type !== 'token') return null;
    return placeToken({ kind: tool.kind, label: tool.label }, team, x, y);
  },

  placeToken: (spec, team, x, y) => {
    const { doc, edit } = get();
    if (spec.kind === 'player' || spec.kind === 'goalie') {
      const existing = findSlot(doc, team, spec.label);
      if (existing) {
        set({
          selection: { kind: 'token', id: existing.id },
          notice: `${teamName(team)} ${spec.label} is already on the ice. Only one per position; drag or select it instead.`,
        });
        return null;
      }
    }
    if (spec.kind === 'puck') {
      const puck = doc.tokens.find((t) => t.kind === 'puck');
      if (puck) {
        set({ selection: { kind: 'token', id: puck.id }, notice: 'There is already a puck on the ice.' });
        return null;
      }
    }
    const id = uid('t');
    const token: Token = { id, kind: spec.kind, label: spec.label, team, x, y };
    edit((d) => ({ ...d, tokens: [...d.tokens, token] }));
    set({ selection: { kind: 'token', id } });
    return id;
  },

  setPosition: (id, label) => {
    const { doc, edit } = get();
    const t = doc.tokens.find((x) => x.id === id);
    if (!t || !isSkaterOrGoalie(t) || t.label === label) return;
    const kindFor = (l: string): TokenKind => (l === 'G' ? 'goalie' : 'player');
    const other = findSlot(doc, t.team, label, id);
    edit((d) => ({
      ...d,
      tokens: d.tokens.map((x) => {
        if (x.id === id) return { ...x, label, kind: kindFor(label) };
        if (other && x.id === other.id) return { ...x, label: t.label, kind: kindFor(t.label) };
        return x;
      }),
    }));
    if (other) set({ notice: `Swapped positions: ${t.label} ⇄ ${label}` });
  },

  setTokenTeam: (id, team) => {
    const { doc, edit } = get();
    const t = doc.tokens.find((x) => x.id === id);
    if (!t || t.team === team) return;
    if (isSkaterOrGoalie(t) && findSlot(doc, team, t.label, id)) {
      set({ notice: `${teamName(team)} already has a ${t.label}. Change this player's position first.` });
      return;
    }
    edit((d) => ({ ...d, tokens: d.tokens.map((x) => (x.id === id ? { ...x, team, color: undefined } : x)) }));
  },

  addLineup: () => {
    const { doc, meta, edit } = get();
    const base = meta.rinkView === 'full' ? 60 : meta.rinkView === 'half-right' ? 130 : 30;
    const wanted: [string, Team, number, number][] = [
      ['C', 'off', base, 42.5],
      ['LW', 'off', base, 22],
      ['RW', 'off', base, 63],
      ['LD', 'def', base + 25, 30],
      ['RD', 'def', base + 25, 55],
    ];
    const missing = wanted.filter(([label, team]) => !findSlot(doc, team, label));
    if (!missing.length) {
      set({ notice: 'The standard lineup is already on the ice.' });
      return;
    }
    const tokens: Token[] = missing.map(([label, team, x, y]) => ({ id: uid('t'), kind: 'player', label, team, x, y }));
    edit((d) => ({ ...d, tokens: [...d.tokens, ...tokens] }));
  },

  removeToken: (id) =>
    get().edit((d) => ({
      ...d,
      tokens: d.tokens.filter((t) => t.id !== id),
      paths: d.paths.filter((p) => p.tokenId !== id),
    })),
  removePath: (id) => get().edit((d) => ({ ...d, paths: d.paths.filter((p) => p.id !== id) })),

  addStep: () => {
    const id = uid('s');
    get().edit((d) => ({ ...d, steps: [...d.steps, { id, title: `Step ${d.steps.length + 1}`, caption: '' }] }));
    set({ activeStepId: id, selection: null });
  },
  removeStep: (id) => {
    const { doc } = get();
    if (doc.steps.length <= 1) return;
    const idx = doc.steps.findIndex((s) => s.id === id);
    get().edit((d) => ({
      ...d,
      steps: d.steps.filter((s) => s.id !== id),
      paths: d.paths.filter((p) => p.stepId !== id),
    }));
    if (get().activeStepId === id) {
      const remaining = get().doc.steps;
      set({ activeStepId: remaining[Math.max(0, idx - 1)].id, selection: null });
    }
  },
  moveStep: (id, dir) =>
    get().edit((d) => {
      const i = d.steps.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.steps.length) return d;
      const steps = d.steps.slice();
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...d, steps };
    }),
  updateStep: (id, p) =>
    get().patch((d) => ({ ...d, steps: d.steps.map((s) => (s.id === id ? { ...s, ...p } : s)) })),
}));

export type { DrawPath };
