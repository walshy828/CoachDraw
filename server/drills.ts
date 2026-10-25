import crypto from 'node:crypto';
import { db } from './db';
import type { Drill, DrillDoc, DrillMeta, RinkView } from '../shared/types';
import { DEFAULT_COLORS } from '../shared/types';

interface Row {
  id: number;
  owner_id: number;
  name: string;
  description: string;
  notes: string;
  category: string;
  age_group: string;
  duration_min: number;
  tags: string;
  rink_view: string;
  doc: string;
  share_token: string | null;
  created_at: string;
  updated_at: string;
}

export const toDrill = (r: Row): Drill => ({
  id: r.id,
  name: r.name,
  description: r.description,
  notes: r.notes,
  category: r.category,
  ageGroup: r.age_group,
  durationMin: r.duration_min,
  tags: JSON.parse(r.tags),
  rinkView: r.rink_view as RinkView,
  doc: JSON.parse(r.doc),
  shareToken: r.share_token,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const str = (v: unknown, max: number, fallback = '') =>
  typeof v === 'string' ? v.slice(0, max) : fallback;

const VIEWS = ['full', 'half-left', 'half-right'];

export function sanitizeMeta(b: Record<string, unknown>): DrillMeta {
  const tags = Array.isArray(b.tags) ? b.tags.filter((t): t is string => typeof t === 'string').map((t) => t.slice(0, 40)).slice(0, 20) : [];
  const dur = Number(b.durationMin);
  return {
    name: str(b.name, 200, 'Untitled drill').trim() || 'Untitled drill',
    description: str(b.description, 10_000),
    notes: str(b.notes, 20_000),
    category: str(b.category, 60, 'Other'),
    ageGroup: str(b.ageGroup, 60),
    durationMin: Number.isFinite(dur) ? Math.min(600, Math.max(0, Math.round(dur))) : 10,
    tags,
    rinkView: (VIEWS.includes(b.rinkView as string) ? b.rinkView : 'full') as RinkView,
  };
}

export function sanitizeDoc(d: unknown): DrillDoc | null {
  if (!d || typeof d !== 'object') return null;
  const o = d as Partial<DrillDoc>;
  if (!Array.isArray(o.tokens) || !Array.isArray(o.paths) || !Array.isArray(o.steps)) return null;
  if (o.tokens.length > 200 || o.paths.length > 1000 || o.steps.length > 100) return null;
  return {
    tokens: o.tokens,
    paths: o.paths,
    steps: o.steps,
    colors: { ...DEFAULT_COLORS, ...(o.colors ?? {}) },
  };
}

export function insertDrill(ownerId: number, meta: DrillMeta, doc: DrillDoc): number {
  const info = db
    .prepare(
      `INSERT INTO drills (owner_id, name, description, notes, category, age_group, duration_min, tags, rink_view, doc)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(ownerId, meta.name, meta.description, meta.notes, meta.category, meta.ageGroup, meta.durationMin, JSON.stringify(meta.tags), meta.rinkView, JSON.stringify(doc));
  return Number(info.lastInsertRowid);
}

export const newShareToken = () => crypto.randomBytes(16).toString('base64url');
export type { Row };
